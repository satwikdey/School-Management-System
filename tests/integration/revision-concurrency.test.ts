import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const isolatedConnection = process.env.REVISION_TEST_DATABASE_URL;
const describeIsolated = isolatedConnection ? describe : describe.skip;

async function connectAsAdmin() {
  const db = new Client({ connectionString: isolatedConnection });
  await db.connect();
  await db.query("SELECT set_config('request.jwt.claims',(SELECT json_build_object('sub',id,'role','authenticated')::text FROM profiles WHERE username='admin'),false)");
  await db.query('SET ROLE authenticated');
  return db;
}

async function connectAsDatabaseOwner() {
  const db = new Client({ connectionString: isolatedConnection });
  await db.connect();
  return db;
}

describeIsolated('Isolated immutable-revision concurrency', () => {
  it('serializes simultaneous publication so exactly one request creates revision 2', async () => {
    const setup = await connectAsDatabaseOwner();
    const adminSetup = await connectAsAdmin();
    const publisherA = await connectAsAdmin();
    const publisherB = await connectAsAdmin();
    try {
      const { rows: exams } = await setup.query(`SELECT id FROM exams
        WHERE current_revision_id IS NOT NULL AND active_draft_id IS NULL LIMIT 1`);
      expect(exams).toHaveLength(1);
      const examId = exams[0].id;
      const { rows: drafts } = await adminSetup.query(
        "SELECT open_exam_correction_tx($1,'Concurrent publication verification') draft_id",
        [examId]
      );
      const draftId = drafts[0].draft_id;

      const outcomes = await Promise.allSettled([
        publisherA.query('SELECT publish_exam_revision_tx($1,$2) result', [examId, draftId]),
        publisherB.query('SELECT publish_exam_revision_tx($1,$2) result', [examId, draftId]),
      ]);
      const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
      const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(String((rejected[0] as PromiseRejectedResult).reason?.message)).toContain('STALE_EXAM_DRAFT');

      const { rows: state } = await setup.query(`SELECT e.active_draft_id,e.current_revision_id,
        (SELECT count(*)::int FROM exam_result_revisions r WHERE r.exam_id=e.id) revision_count,
        (SELECT max(revision_number)::int FROM exam_result_revisions r WHERE r.exam_id=e.id) latest_revision
        FROM exams e WHERE e.id=$1`, [examId]);
      expect(state[0].active_draft_id).toBeNull();
      expect(state[0].current_revision_id).toBeTruthy();
      expect(state[0].revision_count).toBe(2);
      expect(state[0].latest_revision).toBe(2);
    } finally {
      await Promise.all([setup.end(), adminSetup.end(), publisherA.end(), publisherB.end()]);
    }
  });
});
