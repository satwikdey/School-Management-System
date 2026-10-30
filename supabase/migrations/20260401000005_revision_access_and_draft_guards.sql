BEGIN;

-- Working marks and summaries are draft state. Students and parents read only
-- immutable revision snapshots, so an open correction can never leak early.
DROP POLICY IF EXISTS "mark_entries_select" ON public.mark_entries;
CREATE POLICY "mark_entries_select_staff" ON public.mark_entries FOR SELECT TO authenticated
USING (
  public.is_admin_or_super()
  OR EXISTS (SELECT 1 FROM public.exams e WHERE e.id=exam_id AND public.is_teacher_for_class(e.class_id))
);

DROP POLICY IF EXISTS "exam_summaries_select" ON public.exam_student_summaries;
CREATE POLICY "exam_summaries_select_staff" ON public.exam_student_summaries FOR SELECT TO authenticated
USING (
  public.is_admin_or_super()
  OR EXISTS (SELECT 1 FROM public.exams e WHERE e.id=exam_id AND public.is_teacher_for_class(e.class_id))
);

CREATE OR REPLACE FUNCTION public.protect_locked_assessment_config()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.is_locked THEN RAISE EXCEPTION 'LOCKED_ASSESSMENT_CONFIG'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_locked AND (
    NEW.is_locked=false OR
    (OLD.academic_year_id,OLD.class_id,OLD.board_code,OLD.custom_board_name,OLD.version,
     OLD.parent_config_id,OLD.pass_percentage,OLD.skill_definitions)
    IS DISTINCT FROM
    (NEW.academic_year_id,NEW.class_id,NEW.board_code,NEW.custom_board_name,NEW.version,
     NEW.parent_config_id,NEW.pass_percentage,NEW.skill_definitions)
  ) THEN RAISE EXCEPTION 'LOCKED_ASSESSMENT_CONFIG'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.protect_locked_assessment_child()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_old_config uuid; v_new_config uuid;
BEGIN
  v_old_config:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.config_id END;
  v_new_config:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE NEW.config_id END;
  IF EXISTS(SELECT 1 FROM public.assessment_configs WHERE id IN(v_old_config,v_new_config) AND is_locked) THEN
    RAISE EXCEPTION 'LOCKED_ASSESSMENT_RULES';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.protect_exam_draft_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.exams WHERE id=OLD.exam_id AND active_draft_id IS NOT NULL) THEN
    RAISE EXCEPTION 'EXAM_HAS_NO_OPEN_DRAFT';
  END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_mark_delete ON public.mark_entries;
CREATE TRIGGER trg_protect_mark_delete BEFORE DELETE ON public.mark_entries
FOR EACH ROW EXECUTE FUNCTION public.protect_exam_draft_delete();

CREATE OR REPLACE FUNCTION public.protect_exam_summary_draft_write()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_exam_id uuid;
BEGIN
  v_exam_id:=CASE WHEN TG_OP='DELETE' THEN OLD.exam_id ELSE NEW.exam_id END;
  IF NOT EXISTS(SELECT 1 FROM public.exams WHERE id=v_exam_id AND active_draft_id IS NOT NULL) THEN
    RAISE EXCEPTION 'EXAM_HAS_NO_OPEN_DRAFT';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_exam_summary_draft ON public.exam_student_summaries;
CREATE TRIGGER trg_protect_exam_summary_draft BEFORE INSERT OR UPDATE OR DELETE ON public.exam_student_summaries
FOR EACH ROW EXECUTE FUNCTION public.protect_exam_summary_draft_write();

-- A restored correction draft must resolve from live draft values, not the
-- previous published snapshot stored on the legacy summary row.
CREATE OR REPLACE FUNCTION public.restore_exam_working_copy_from_revision(p_exam_id uuid,p_revision_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM public.mark_entries WHERE exam_id=p_exam_id;
  DELETE FROM public.exam_student_summaries WHERE exam_id=p_exam_id;
  INSERT INTO public.mark_entries(exam_id,enrollment_id,student_id,subject_id,component_id,status,marks_obtained,updated_at)
  SELECT p_exam_id,rs.enrollment_id,rs.student_id,(m->>'subject_id')::uuid,(m->>'component_id')::uuid,
    (m->>'status')::public.mark_status,CASE WHEN m->>'status'='PRESENT' THEN (m->>'marks_obtained')::numeric END,now()
  FROM public.exam_result_revision_students rs CROSS JOIN LATERAL jsonb_array_elements(rs.report_snapshot->'marks') m
  WHERE rs.revision_id=p_revision_id;
  INSERT INTO public.exam_student_summaries(exam_id,enrollment_id,student_id,total_obtained,total_max,percentage,annual_weighted_percentage,
    overall_grade,grade_remark,is_passed,section_rank,class_rank,teacher_comment,principal_comment,skill_ratings,published_snapshot,updated_at)
  SELECT p_exam_id,rs.enrollment_id,rs.student_id,(x->>'total_obtained')::numeric,(x->>'total_max')::numeric,(x->>'percentage')::numeric,
    NULLIF(x->>'annual_weighted_percentage','')::numeric,x->>'overall_grade',x->>'grade_remark',(x->>'is_passed')::boolean,
    (x->>'section_rank')::integer,(x->>'class_rank')::integer,x->>'teacher_comment',x->>'principal_comment',
    COALESCE(x->'skill_ratings','{}'::jsonb),NULL,now()
  FROM public.exam_result_revision_students rs CROSS JOIN LATERAL (SELECT rs.report_snapshot->'summary' x) q
  WHERE rs.revision_id=p_revision_id;
END; $$;

COMMIT;
