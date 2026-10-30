-- =============================================================================
-- Final revision-state access controls and database-level snapshot immutability
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.protect_exam_revision_state()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF current_user='authenticated' THEN
    IF TG_OP='INSERT' AND (
      NEW.is_published OR NEW.current_revision_id IS NOT NULL OR NEW.active_draft_id IS NULL
      OR NEW.published_at IS NOT NULL OR NEW.published_by IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'EXAM_REVISION_STATE_REQUIRES_TRANSACTIONAL_RPC';
    END IF;
    IF TG_OP='UPDATE' AND
      (OLD.current_revision_id,OLD.active_draft_id,OLD.draft_reason,OLD.is_published,OLD.published_at,OLD.published_by)
      IS DISTINCT FROM
      (NEW.current_revision_id,NEW.active_draft_id,NEW.draft_reason,NEW.is_published,NEW.published_at,NEW.published_by)
    THEN
      RAISE EXCEPTION 'EXAM_REVISION_STATE_REQUIRES_TRANSACTIONAL_RPC';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_exam_revision_state ON public.exams;
CREATE TRIGGER trg_protect_exam_revision_state
BEFORE INSERT OR UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.protect_exam_revision_state();

CREATE OR REPLACE FUNCTION public.reject_published_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  RAISE EXCEPTION 'PUBLISHED_RESULT_SNAPSHOTS_ARE_IMMUTABLE';
END; $$;
DROP TRIGGER IF EXISTS trg_reject_revision_mutation ON public.exam_result_revisions;
CREATE TRIGGER trg_reject_revision_mutation BEFORE UPDATE OR DELETE ON public.exam_result_revisions
FOR EACH ROW EXECUTE FUNCTION public.reject_published_snapshot_mutation();
DROP TRIGGER IF EXISTS trg_reject_revision_student_mutation ON public.exam_result_revision_students;
CREATE TRIGGER trg_reject_revision_student_mutation BEFORE UPDATE OR DELETE ON public.exam_result_revision_students
FOR EACH ROW EXECUTE FUNCTION public.reject_published_snapshot_mutation();

DROP POLICY IF EXISTS "result_revisions_select_authorized" ON public.exam_result_revisions;
CREATE POLICY "result_revisions_select_authorized" ON public.exam_result_revisions FOR SELECT TO authenticated USING (
  public.is_admin_or_super()
  OR (
    public.current_user_role()='teacher'
    AND EXISTS(SELECT 1 FROM public.exams e WHERE e.id=exam_id AND public.is_teacher_for_class(e.class_id))
  )
  OR EXISTS(
    SELECT 1 FROM public.exam_result_revision_students rs
    WHERE rs.revision_id=id AND public.can_view_student_exam_result(rs.student_id,exam_id)
  )
);

COMMIT;
