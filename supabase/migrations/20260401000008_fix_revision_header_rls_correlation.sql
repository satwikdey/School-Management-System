-- Fully qualify outer revision columns so the correlated EXISTS cannot resolve
-- `id` to exam_result_revision_students.id.
BEGIN;

DROP POLICY IF EXISTS "result_revisions_select_authorized" ON public.exam_result_revisions;
CREATE POLICY "result_revisions_select_authorized" ON public.exam_result_revisions FOR SELECT TO authenticated USING (
  public.is_admin_or_super()
  OR (
    public.current_user_role()='teacher'
    AND EXISTS(
      SELECT 1 FROM public.exams e
      WHERE e.id=exam_result_revisions.exam_id AND public.is_teacher_for_class(e.class_id)
    )
  )
  OR EXISTS(
    SELECT 1 FROM public.exam_result_revision_students rs
    WHERE rs.revision_id=exam_result_revisions.id
      AND public.can_view_student_exam_result(rs.student_id,exam_result_revisions.exam_id)
  )
);

COMMIT;
