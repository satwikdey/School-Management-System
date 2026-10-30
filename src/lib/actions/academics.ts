'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, requireRole } from '@/lib/auth';
import type { BoardCode } from '@/lib/utils';

const createSubjectSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().trim().min(2),
  code: z.string().trim().min(2),
  shortName: z.string().trim().optional(),
  hasPractical: z.boolean().default(false),
  teacherId: z.string().uuid().optional().or(z.literal('')),
  sectionId: z.string().uuid().optional().or(z.literal('')),
  academicYearId: z.string().uuid(),
});

export async function createSubjectAndAssignmentAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin']);
  const parsed = createSubjectSchema.safeParse({
    classId: formData.get('classId'),
    name: formData.get('name'),
    code: formData.get('code'),
    shortName: formData.get('shortName') || undefined,
    hasPractical: formData.get('hasPractical') === 'true' || formData.get('hasPractical') === 'on',
    teacherId: formData.get('teacherId') || '',
    sectionId: formData.get('sectionId') || '',
    academicYearId: formData.get('academicYearId'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid subject input.' };
  }

  const d = parsed.data;
  const supabase = createClient();
  const { data: subjectRow, error } = await supabase
    .from('subjects')
    .insert({
      class_id: d.classId,
      name: d.name,
      code: d.code.toUpperCase(),
      short_name: d.shortName || d.code.slice(0, 4).toUpperCase(),
      has_practical: d.hasPractical,
      teacher_id: d.teacherId || null,
    })
    .select('id')
    .single();

  if (error || !subjectRow) {
    return { error: error?.message || 'Failed creating subject.' };
  }

  if (d.teacherId && d.sectionId) {
    await supabase.from('teacher_assignments').upsert(
      {
        academic_year_id: d.academicYearId,
        teacher_id: d.teacherId,
        class_id: d.classId,
        section_id: d.sectionId,
        subject_id: subjectRow.id,
        is_class_teacher: false,
      },
      { onConflict: 'academic_year_id,class_id,section_id,subject_id' }
    );
  }

  await supabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'SUBJECT_CREATED',
    entity_type: 'subjects',
    entity_id: subjectRow.id,
    after_state: d,
  });

  revalidatePath('/academics');
  revalidatePath('/exams');
  return { success: `Subject ${d.name} (${d.code}) created successfully.` };
}

const classBoardOverrideSchema = z.object({
  classId: z.string().uuid(),
  boardOverride: z.enum(['DEFAULT', 'CBSE', 'ICSE', 'WBBSE', 'WBCHSE', 'CUSTOM']),
  customBoardName: z.string().trim().optional(),
});

export async function updateClassBoardOverrideAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin']);
  const parsed = classBoardOverrideSchema.safeParse({
    classId: formData.get('classId'),
    boardOverride: formData.get('boardOverride') || 'DEFAULT',
    customBoardName: formData.get('customBoardName') || '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid board override.' };
  }

  const d = parsed.data;
  if (d.boardOverride === 'CUSTOM' && !d.customBoardName) {
    return { error: 'Please specify a custom board display name when selecting CUSTOM.' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('school_classes')
    .update({
      board_override: d.boardOverride === 'DEFAULT' ? null : (d.boardOverride as BoardCode),
      custom_board_name: d.boardOverride === 'CUSTOM' ? d.customBoardName : null,
    })
    .eq('id', d.classId);

  if (error) {
    return { error: error.message };
  }

  await supabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'CLASS_BOARD_OVERRIDE_UPDATED',
    entity_type: 'school_classes',
    entity_id: d.classId,
    after_state: d,
  });

  revalidatePath('/academics');
  revalidatePath('/boards');
  return { success: 'Class board profile updated.' };
}

const cloneConfigSchema = z.object({
  configId: z.string().uuid(),
  newPassPercentage: z.coerce.number().min(1).max(100),
  newName: z.string().trim().min(3),
});

export async function versionAssessmentConfigAction(formData: FormData) {
  await requireRole(['super_admin', 'admin']);
  const parsed = cloneConfigSchema.safeParse({
    configId: formData.get('configId'),
    newPassPercentage: formData.get('newPassPercentage'),
    newName: formData.get('newName'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid assessment configuration parameters.' };
  }

  const supabase = createClient();
  const { data: newId, error } = await supabase.rpc('clone_assessment_config_version_tx', {
    p_config_id: parsed.data.configId,
    p_new_pass_percentage: parsed.data.newPassPercentage,
    p_new_name: parsed.data.newName,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/boards');
  revalidatePath('/exams');
  return {
    success: `Created new assessment configuration version (${newId}). Historical published exams remain bound to their immutable prior version.`,
  };
}

const createExamSchema = z.object({
  academicYearId: z.string().uuid(),
  classId: z.string().uuid(),
  configId: z.string().uuid(),
  termId: z.string().uuid(),
  name: z.string().trim().min(3, 'Exam name is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function createExamAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin']);
  const parsed = createExamSchema.safeParse({
    academicYearId: formData.get('academicYearId'),
    classId: formData.get('classId'),
    configId: formData.get('configId'),
    termId: formData.get('termId'),
    name: formData.get('name'),
    startDate: formData.get('startDate') || undefined,
    endDate: formData.get('endDate') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid exam parameters.' };
  }

  const d = parsed.data;
  const supabase = createClient();
  const [{ data: config }, { data: term }] = await Promise.all([
    supabase
      .from('assessment_configs')
      .select('id, class_id, academic_year_id')
      .eq('id', d.configId)
      .maybeSingle(),
    supabase
      .from('assessment_terms')
      .select('id, config_id')
      .eq('id', d.termId)
      .maybeSingle(),
  ]);
  if (
    !config ||
    !term ||
    config.class_id !== d.classId ||
    config.academic_year_id !== d.academicYearId ||
    term.config_id !== d.configId
  ) {
    return { error: 'The class, academic year, assessment configuration, and term must belong together.' };
  }
  const { data: examRow, error } = await supabase
    .from('exams')
    .insert({
      academic_year_id: d.academicYearId,
      class_id: d.classId,
      config_id: d.configId,
      term_id: d.termId,
      name: d.name,
      start_date: d.startDate || null,
      end_date: d.endDate || null,
      is_published: false,
    })
    .select('id')
    .single();

  if (error || !examRow) {
    return { error: error?.message || 'Failed creating examination.' };
  }

  await supabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'EXAM_CREATED',
    entity_type: 'exams',
    entity_id: examRow.id,
    after_state: d,
  });

  revalidatePath('/exams');
  return { success: `Examination "${d.name}" created.` };
}

const bulkMarksSchema = z.object({
  examId: z.string().uuid(),
  draftId: z.string().uuid(),
  subjectId: z.string().uuid(),
  entriesJson: z.string().min(2),
});

const twoDecimalNumber = z.number().finite().min(0).refine(
  (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
  'Scores may have at most two decimal places.'
);

const markEntrySchema = z.discriminatedUnion('status', [
  z.object({
    enrollment_id: z.string().uuid(),
    student_id: z.string().uuid(),
    component_id: z.string().uuid(),
    status: z.literal('PRESENT'),
    marks_obtained: twoDecimalNumber,
  }),
  z.object({
    enrollment_id: z.string().uuid(),
    student_id: z.string().uuid(),
    component_id: z.string().uuid(),
    status: z.enum(['ABSENT', 'MISSING']),
    marks_obtained: z.null(),
  }),
]);

export async function saveBulkMarksAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin', 'teacher']);
  const parsed = bulkMarksSchema.safeParse({
    examId: formData.get('examId'),
    draftId: formData.get('draftId'),
    subjectId: formData.get('subjectId'),
    entriesJson: formData.get('entriesJson'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid marks payload.' };
  }

  let entries: z.infer<typeof markEntrySchema>[];

  try {
    const decoded = JSON.parse(parsed.data.entriesJson);
    const validated = z.array(markEntrySchema).min(1).safeParse(decoded);
    if (!validated.success) {
      return { error: validated.error.issues[0]?.message || 'Invalid marks payload.' };
    }
    entries = validated.data;
  } catch {
    return { error: 'Malformed marks JSON payload.' };
  }

  const supabase = createClient();
  const { data, error } = await (supabase as any).rpc('save_exam_marks_draft_tx', {
    p_exam_id: parsed.data.examId,
    p_draft_id: parsed.data.draftId,
    p_subject_id: parsed.data.subjectId,
    p_entries: entries,
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/exams');
  return { success: `Saved ${Number(data?.saved ?? entries.length)} component mark entries and recalculated class rankings.` };
}

const saveCommentsSchema = z.object({
  summaryId: z.string().uuid(),
  examId: z.string().uuid(),
  draftId: z.string().uuid(),
  teacherComment: z.string().trim().max(500).optional(),
  principalComment: z.string().trim().max(500).optional(),
  skillRatingsJson: z.string().optional(),
});

const skillRatingsSchema = z.record(z.number().int().min(1).max(5));

export async function saveRemarksAndSkillsAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin', 'teacher']);
  const parsed = saveCommentsSchema.safeParse({
    summaryId: formData.get('summaryId'),
    examId: formData.get('examId'),
    draftId: formData.get('draftId'),
    teacherComment: formData.get('teacherComment') || '',
    principalComment: formData.get('principalComment') || '',
    skillRatingsJson: formData.get('skillRatingsJson') || '{}',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid comment/skill input.' };
  }

  let skillRatings: Record<string, number> = {};
  try {
    const decoded = JSON.parse(parsed.data.skillRatingsJson || '{}');
    const validated = skillRatingsSchema.safeParse(decoded);
    if (!validated.success) {
      return { error: 'Skill ratings must be a JSON object whose values are whole numbers from 1 to 5.' };
    }
    skillRatings = validated.data;
  } catch {
    return { error: 'Skill ratings must be valid JSON.' };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc('save_exam_summary_comments_draft_tx', {
    p_exam_id: parsed.data.examId,
    p_draft_id: parsed.data.draftId,
    p_summary_id: parsed.data.summaryId,
    p_teacher_comment: parsed.data.teacherComment || '',
    p_principal_comment:
      actor.role === 'super_admin' || actor.role === 'admin'
        ? parsed.data.principalComment || ''
        : '',
    p_skill_ratings: skillRatings,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/exams');
  return { success: 'Comments and skill ratings updated.' };
}

const publishExamSchema = z.object({
  examId: z.string().uuid(),
  draftId: z.string().uuid(),
});

export async function publishExamToggleAction(formData: FormData) {
  await requireRole(['super_admin', 'admin']);
  const parsed = publishExamSchema.safeParse({
    examId: formData.get('examId'),
    draftId: formData.get('draftId'),
  });

  if (!parsed.success) {
    return { error: 'Invalid exam publication request.' };
  }

  const supabase = createClient();
  const { data, error } = await (supabase as any).rpc('publish_exam_revision_tx', {
    p_exam_id: parsed.data.examId,
    p_draft_id: parsed.data.draftId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/exams');
  revalidatePath('/dashboard');
  return {
    success: `Published immutable result revision ${Number(data?.revision_number ?? 1)}.`,
  };
}

const correctionSchema = z.object({
  examId: z.string().uuid(),
  reason: z.string().trim().min(5, 'Enter a correction reason of at least 5 characters.'),
});

export async function openExamCorrectionAction(formData: FormData) {
  await requireRole(['super_admin', 'admin']);
  const parsed = correctionSchema.safeParse({
    examId: formData.get('examId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Invalid correction request.' };
  const supabase = createClient();
  const { error } = await (supabase as any).rpc('open_exam_correction_tx', {
    p_exam_id: parsed.data.examId,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: error.message };
  revalidatePath('/exams');
  return { success: 'Correction draft opened. The current published revision remains visible.' };
}

const discardDraftSchema = z.object({ examId: z.string().uuid(), draftId: z.string().uuid() });

export async function discardExamCorrectionAction(formData: FormData) {
  await requireRole(['super_admin', 'admin']);
  const parsed = discardDraftSchema.safeParse({ examId: formData.get('examId'), draftId: formData.get('draftId') });
  if (!parsed.success) return { error: 'Invalid correction draft.' };
  const supabase = createClient();
  const { error } = await (supabase as any).rpc('discard_exam_correction_tx', {
    p_exam_id: parsed.data.examId,
    p_draft_id: parsed.data.draftId,
  });
  if (error) return { error: error.message };
  revalidatePath('/exams');
  return { success: 'Correction draft discarded. Published revisions were not changed.' };
}

const generatePinsSchema = z.object({
  academicYearId: z.string().uuid(),
  count: z.coerce.number().int().min(1).max(100),
});

export async function generateResultPinsAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin']);
  const parsed = generatePinsSchema.safeParse({
    academicYearId: formData.get('academicYearId'),
    count: formData.get('count') || 5,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid PIN count.' };
  }

  const supabase = createClient();
  const pins = Array.from({ length: parsed.data.count }, () => {
    const part1 = Math.random().toString(36).substring(2, 7).toUpperCase();
    const part2 = Math.random().toString(36).substring(2, 8).toUpperCase();
    return {
      pin_code: `VBM26-${part1}-${part2}`,
      academic_year_id: parsed.data.academicYearId,
      max_uses: 5,
      created_by: actor.id,
    };
  });

  const { error } = await supabase.from('result_pins').insert(pins);
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/exams');
  return { success: `Generated ${pins.length} new Result PIN(s).` };
}

const verifyPinSchema = z.object({
  pinCode: z.string().trim().min(5, 'Enter a valid Result PIN'),
  studentId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});

export async function verifyResultPinAction(formData: FormData) {
  await requireAuth();
  const parsed = verifyPinSchema.safeParse({
    pinCode: formData.get('pinCode'),
    studentId: formData.get('studentId'),
    academicYearId: formData.get('academicYearId'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid Result PIN.' };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc('verify_result_pin_tx', {
    p_pin_code: parsed.data.pinCode,
    p_student_id: parsed.data.studentId,
    p_academic_year_id: parsed.data.academicYearId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/exams');
  return { success: 'Result PIN verified! You now have access to published results for this academic year.' };
}
