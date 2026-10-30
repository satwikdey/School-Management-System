import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// These checks exercise the real database permissions and calculations. Every
// write is enclosed in a transaction that is unconditionally rolled back.
const connectionString = process.env.DATABASE_URL;

beforeAll(() => {
  if (!connectionString || !['localhost', '127.0.0.1'].includes(new URL(connectionString).hostname)) {
    throw new Error('Verification regression tests require a local demo DATABASE_URL.');
  }
});

async function asUser(username: string, run: (db: Client) => Promise<void>) {
  const db = new Client({ connectionString });
  await db.connect();
  try {
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT id FROM public.profiles WHERE username = $1', [username]);
    expect(rows).toHaveLength(1);
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: rows[0].id, role: 'authenticated' }),
    ]);
    await db.query('SET LOCAL ROLE authenticated');
    await run(db);
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
}

async function expectRejected(db: Client, sql: string, parameters: unknown[]) {
  await db.query('SAVEPOINT rejected_write');
  let affected = 0;
  try {
    affected = (await db.query(sql, parameters)).rowCount ?? 0;
  } catch (error) {
    // Only a constraint / authorization rejection counts as successful validation.
    const code = (error as { code?: string }).code;
    expect(['23514', '23503', '42501', 'P0001']).toContain(code);
    return;
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT rejected_write');
  }
  expect(affected, 'The invalid write was accepted by the database').toBe(0);
}

describe('Additional verification: assessment integrity', () => {
  it('rejects publication when mandatory marks are missing', async () => {
    await asUser('superadmin', async (db) => {
      const { rows } = await db.query('SELECT id FROM exams WHERE NOT is_published LIMIT 1');
      expect(rows).toHaveLength(1);
      await expect(db.query('SELECT recalculate_and_publish_exam_tx($1, true)', [rows[0].id]))
        .rejects.toThrow('MISSING_MANDATORY_MARKS');
    });
  });

  it('rejects a score above the assessment component maximum', async () => {
    await asUser('teacher', async (db) => {
      const { rows } = await db.query(`
        SELECT m.id, c.max_marks FROM mark_entries m
        JOIN assessment_components c ON c.id = m.component_id
        JOIN exams e ON e.id = m.exam_id
        WHERE NOT e.is_published AND is_teacher_for_subject(m.subject_id) LIMIT 1
      `);
      expect(rows).toHaveLength(1);
      await expectRejected(db,
        "UPDATE mark_entries SET status = 'PRESENT', marks_obtained = $2 WHERE id = $1",
        [rows[0].id, Number(rows[0].max_marks) + 1]);
    });
  });

  it('protects a locked assessment configuration from in-place edits', async () => {
    await asUser('admin', async (db) => {
      const { rows } = await db.query('SELECT id FROM assessment_configs WHERE is_locked LIMIT 1');
      expect(rows).toHaveLength(1);
      await expectRejected(db, 'UPDATE assessment_configs SET pass_percentage = 99 WHERE id = $1', [rows[0].id]);
    });
  });

  it('enforces the configured component pass minimum in database-calculated results', async () => {
    await asUser('superadmin', async (db) => {
      const { rows: exams } = await db.query('SELECT id FROM exams WHERE is_published LIMIT 1');
      expect(exams).toHaveLength(1);
      const examId = exams[0].id;
      const { rows: drafts } = await db.query(
        "SELECT open_exam_correction_tx($1, 'Verify configured component pass minima') AS id",
        [examId]
      );
      expect(drafts[0].id).toBeTruthy();
      const { rows } = await db.query('SELECT enrollment_id FROM exam_student_summaries WHERE exam_id = $1 LIMIT 1', [examId]);
      expect(rows).toHaveLength(1);
      const enrollmentId = rows[0].enrollment_id;
      const { rows: components } = await db.query(`
        SELECT DISTINCT c.code, c.pass_marks FROM mark_entries m
        JOIN assessment_components c ON c.id = m.component_id
        WHERE m.exam_id = $1 AND m.enrollment_id = $2
      `, [examId, enrollmentId]);
      expect(components.find(c => c.code === 'IA')?.pass_marks).toBe('7.00');
      await db.query(`UPDATE mark_entries m SET status = 'PRESENT',
        marks_obtained = CASE WHEN c.code = 'IA' THEN 0 ELSE c.max_marks END
        FROM assessment_components c
        WHERE m.component_id = c.id AND m.exam_id = $1 AND m.enrollment_id = $2`, [examId, enrollmentId]);
      await db.query('SELECT publish_exam_revision_tx($1, $2)', [examId, drafts[0].id]);
      const { rows: results } = await db.query('SELECT is_passed FROM exam_student_summaries WHERE exam_id = $1 AND enrollment_id = $2', [examId, enrollmentId]);
      expect(results[0].is_passed, 'IA scores of 0/20 must fail their configured minimum of 7').toBe(false);
    });
  });

  it('rejects an exam whose term belongs to a different assessment configuration', async () => {
    await asUser('admin', async (db) => {
      const { rows: exams } = await db.query('SELECT * FROM exams WHERE is_published LIMIT 1');
      expect(exams).toHaveLength(1);
      const exam = exams[0];
      const { rows: terms } = await db.query('SELECT id FROM assessment_terms WHERE config_id <> $1 LIMIT 1', [exam.config_id]);
      expect(terms).toHaveLength(1);
      await expectRejected(db, `INSERT INTO exams (academic_year_id, class_id, config_id, term_id, name)
        VALUES ($1, $2, $3, $4, 'Verification: mismatched term')`,
        [exam.academic_year_id, exam.class_id, exam.config_id, terms[0].id]);
    });
  });

  it('rolls back an entire mixed-validity marks submission', async () => {
    await asUser('superadmin', async (db) => {
      const { rows: exams } = await db.query('SELECT id FROM exams WHERE current_revision_id IS NOT NULL LIMIT 1');
      const examId = exams[0].id;
      const { rows: drafts } = await db.query("SELECT open_exam_correction_tx($1, 'Atomic batch rollback verification') id", [examId]);
      const draftId = drafts[0].id;
      const { rows: subjects } = await db.query('SELECT subject_id FROM mark_entries WHERE exam_id=$1 LIMIT 1', [examId]);
      const subjectId = subjects[0].subject_id;
      const { rows: marks } = await db.query(`
        SELECT m.enrollment_id,m.student_id,m.component_id,m.status,m.marks_obtained,c.max_marks
        FROM mark_entries m JOIN assessment_components c ON c.id=m.component_id
        WHERE m.exam_id=$1 AND m.subject_id=$2 ORDER BY m.enrollment_id,m.component_id
      `, [examId, subjectId]);
      expect(marks.length).toBeGreaterThan(1);
      const original = marks[0].marks_obtained;
      const entries = marks.map((mark) => ({
        enrollment_id: mark.enrollment_id,
        student_id: mark.student_id,
        component_id: mark.component_id,
        status: mark.status,
        marks_obtained: mark.status === 'PRESENT' ? Number(mark.marks_obtained) : null,
      }));
      entries[0] = { ...entries[0], status: 'PRESENT', marks_obtained: 0 };
      entries[1] = { ...entries[1], status: 'PRESENT', marks_obtained: Number(marks[1].max_marks) + 1 };
      await expectRejected(db, 'SELECT save_exam_marks_draft_tx($1,$2,$3,$4::jsonb)',
        [examId, draftId, subjectId, JSON.stringify(entries)]);
      const { rows: unchanged } = await db.query(`SELECT marks_obtained FROM mark_entries
        WHERE exam_id=$1 AND subject_id=$2 AND enrollment_id=$3 AND component_id=$4`,
        [examId, subjectId, marks[0].enrollment_id, marks[0].component_id]);
      expect(unchanged[0].marks_obtained).toBe(original);
    });
  });

  it('rejects malformed scores, statuses, and stale draft identifiers', async () => {
    await asUser('superadmin', async (db) => {
      const { rows: exams } = await db.query('SELECT id FROM exams WHERE current_revision_id IS NOT NULL LIMIT 1');
      const examId = exams[0].id;
      const { rows: drafts } = await db.query("SELECT open_exam_correction_tx($1, 'Malformed payload verification') id", [examId]);
      const draftId = drafts[0].id;
      const { rows: subjectRows } = await db.query('SELECT subject_id FROM mark_entries WHERE exam_id=$1 LIMIT 1', [examId]);
      const subjectId = subjectRows[0].subject_id;
      const { rows: marks } = await db.query(`SELECT m.enrollment_id,m.student_id,m.component_id,m.status,m.marks_obtained
        FROM mark_entries m WHERE m.exam_id=$1 AND m.subject_id=$2 ORDER BY m.enrollment_id,m.component_id`, [examId, subjectId]);
      const valid = marks.map((mark) => ({
        enrollment_id: mark.enrollment_id,student_id: mark.student_id,component_id: mark.component_id,
        status: mark.status,marks_obtained: mark.status === 'PRESENT' ? Number(mark.marks_obtained) : null,
      }));
      const malformedStatus = valid.map((entry, index) => index ? entry : { ...entry, status: 'INVALID' });
      await expectRejected(db, 'SELECT save_exam_marks_draft_tx($1,$2,$3,$4::jsonb)',
        [examId, draftId, subjectId, JSON.stringify(malformedStatus)]);
      const excessPrecision = valid.map((entry, index) => index ? entry : { ...entry, status: 'PRESENT', marks_obtained: 1.234 });
      await expectRejected(db, 'SELECT save_exam_marks_draft_tx($1,$2,$3,$4::jsonb)',
        [examId, draftId, subjectId, JSON.stringify(excessPrecision)]);
      await db.query('SELECT discard_exam_correction_tx($1,$2)', [examId, draftId]);
      await expectRejected(db, 'SELECT save_exam_marks_draft_tx($1,$2,$3,$4::jsonb)',
        [examId, draftId, subjectId, JSON.stringify(valid)]);
    });
  });

  it('keeps revision 1 byte-for-byte unchanged when revision 2 is published', async () => {
    await asUser('superadmin', async (db) => {
      const { rows: exams } = await db.query(`SELECT id,current_revision_id FROM exams
        WHERE current_revision_id IS NOT NULL LIMIT 1`);
      const examId = exams[0].id;
      const revision1 = exams[0].current_revision_id;
      const { rows: before } = await db.query(`SELECT md5(string_agg(report_snapshot::text,'' ORDER BY enrollment_id)) hash,
        count(*)::int count FROM exam_result_revision_students WHERE revision_id=$1`, [revision1]);
      const { rows: drafts } = await db.query("SELECT open_exam_correction_tx($1, 'Correct a verified component score') id", [examId]);
      const { rows: markRows } = await db.query(`SELECT m.id,m.marks_obtained,c.max_marks FROM mark_entries m
        JOIN assessment_components c ON c.id=m.component_id
        WHERE m.exam_id=$1 AND m.status='PRESENT' LIMIT 1`, [examId]);
      const mark = markRows[0];
      const replacement = Number(mark.marks_obtained) === Number(mark.max_marks)
        ? Number(mark.marks_obtained) - 0.01 : Number(mark.marks_obtained) + 0.01;
      await db.query('UPDATE mark_entries SET marks_obtained=$2 WHERE id=$1', [mark.id, replacement]);
      const { rows: publications } = await db.query('SELECT publish_exam_revision_tx($1,$2) result', [examId, drafts[0].id]);
      const revision2 = publications[0].result.revision_id;
      expect(publications[0].result.revision_number).toBe(2);
      const { rows: after } = await db.query(`SELECT md5(string_agg(report_snapshot::text,'' ORDER BY enrollment_id)) hash,
        count(*)::int count FROM exam_result_revision_students WHERE revision_id=$1`, [revision1]);
      expect(after[0]).toEqual(before[0]);
      const { rows: current } = await db.query('SELECT current_revision_id,active_draft_id FROM exams WHERE id=$1', [examId]);
      expect(current[0].current_revision_id).toBe(revision2);
      expect(current[0].active_draft_id).toBeNull();
      const { rows: revisionCount } = await db.query('SELECT count(*)::int count FROM exam_result_revisions WHERE exam_id=$1', [examId]);
      expect(revisionCount[0].count).toBe(2);
      const { rows: newSnapshots } = await db.query('SELECT count(*)::int count FROM exam_result_revision_students WHERE revision_id=$1', [revision2]);
      expect(newSnapshots[0].count).toBe(before[0].count);
    });
  });

  it('discards corrections by restoring the current immutable revision', async () => {
    await asUser('admin', async (db) => {
      const { rows: exams } = await db.query('SELECT id,current_revision_id FROM exams WHERE current_revision_id IS NOT NULL LIMIT 1');
      const exam = exams[0];
      const { rows: expected } = await db.query(`SELECT m->>'marks_obtained' marks
        FROM exam_result_revision_students rs CROSS JOIN LATERAL jsonb_array_elements(rs.report_snapshot->'marks') m
        WHERE rs.revision_id=$1 AND m->>'status'='PRESENT' LIMIT 1`, [exam.current_revision_id]);
      const { rows: drafts } = await db.query("SELECT open_exam_correction_tx($1, 'Discard workflow verification') id", [exam.id]);
      await db.query(`UPDATE mark_entries SET marks_obtained=0 WHERE id=(SELECT id FROM mark_entries
        WHERE exam_id=$1 AND status='PRESENT' LIMIT 1)`, [exam.id]);
      await db.query('SELECT discard_exam_correction_tx($1,$2)', [exam.id, drafts[0].id]);
      const { rows: state } = await db.query('SELECT active_draft_id,current_revision_id FROM exams WHERE id=$1', [exam.id]);
      expect(state[0].active_draft_id).toBeNull();
      expect(state[0].current_revision_id).toBe(exam.current_revision_id);
      const { rows: restored } = await db.query(`SELECT marks_obtained::text marks FROM mark_entries
        WHERE exam_id=$1 AND status='PRESENT' ORDER BY id LIMIT 1`, [exam.id]);
      // Compare the complete working-copy multiset because UUID ordering differs from JSON array ordering.
      const { rows: mismatches } = await db.query(`SELECT count(*)::int count FROM mark_entries me
        WHERE me.exam_id=$1 AND NOT EXISTS (
          SELECT 1 FROM exam_result_revision_students rs CROSS JOIN LATERAL jsonb_array_elements(rs.report_snapshot->'marks') m
          WHERE rs.revision_id=$2 AND m->>'enrollment_id'=me.enrollment_id::text
            AND m->>'subject_id'=me.subject_id::text AND m->>'component_id'=me.component_id::text
            AND m->>'status'=me.status::text
            AND COALESCE(m->>'marks_obtained','')=COALESCE(me.marks_obtained::text,'')
        )`, [exam.id, exam.current_revision_id]);
      expect(mismatches[0].count).toBe(0);
      expect(expected).toHaveLength(1);
      expect(restored).toHaveLength(1);
    });
  });

  it('locks child rules and clones terms/components with remapped identifiers', async () => {
    await asUser('admin', async (db) => {
      const { rows: configs } = await db.query('SELECT id FROM assessment_configs WHERE is_locked LIMIT 1');
      const configId = configs[0].id;
      const { rows: children } = await db.query(`SELECT
        (SELECT id FROM assessment_terms WHERE config_id=$1 LIMIT 1) term_id,
        (SELECT id FROM assessment_components WHERE config_id=$1 LIMIT 1) component_id,
        (SELECT id FROM grade_bands WHERE config_id=$1 LIMIT 1) grade_id`, [configId]);
      await expectRejected(db, 'UPDATE assessment_terms SET name=name||$2 WHERE id=$1', [children[0].term_id, ' changed']);
      await expectRejected(db, 'DELETE FROM assessment_components WHERE id=$1', [children[0].component_id]);
      await expectRejected(db, 'UPDATE grade_bands SET remark=$2 WHERE id=$1', [children[0].grade_id, 'changed']);
      const { rows: cloneRows } = await db.query("SELECT clone_assessment_config_version_tx($1,NULL,'Cloned verification config') id", [configId]);
      const cloneId = cloneRows[0].id;
      const { rows: counts } = await db.query(`SELECT
        (SELECT count(*)::int FROM assessment_terms WHERE config_id=$1) old_terms,
        (SELECT count(*)::int FROM assessment_terms WHERE config_id=$2) new_terms,
        (SELECT count(*)::int FROM assessment_components WHERE config_id=$1) old_components,
        (SELECT count(*)::int FROM assessment_components WHERE config_id=$2) new_components,
        (SELECT count(*)::int FROM assessment_components c LEFT JOIN assessment_terms t ON t.id=c.term_id
          WHERE c.config_id=$2 AND c.term_id IS NOT NULL AND (t.id IS NULL OR t.config_id<>$2)) bad_component_terms`,
        [configId, cloneId]);
      expect(counts[0].new_terms).toBe(counts[0].old_terms);
      expect(counts[0].new_components).toBe(counts[0].old_components);
      expect(counts[0].bad_component_terms).toBe(0);
      await db.query('UPDATE assessment_components SET pass_marks=pass_marks WHERE config_id=$1', [cloneId]);
    });
  });

  it('rejects direct publication-state changes and snapshot mutation', async () => {
    await asUser('admin', async (db) => {
      const { rows: exams } = await db.query('SELECT id,current_revision_id FROM exams WHERE current_revision_id IS NOT NULL LIMIT 1');
      await expectRejected(db, 'UPDATE exams SET is_published=false WHERE id=$1', [exams[0].id]);
      await expectRejected(db, `UPDATE exam_result_revisions
        SET correction_reason='tampered' WHERE id=$1`, [exams[0].current_revision_id]);
      await expectRejected(db, 'DELETE FROM exam_result_revision_students WHERE revision_id=$1', [exams[0].current_revision_id]);
    });
  });
});
