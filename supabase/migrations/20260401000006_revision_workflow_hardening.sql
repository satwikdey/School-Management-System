-- =============================================================================
-- Revision workflow hardening: stable rosters, stale-write guards, and complete
-- component/grade-band pass rules.
-- =============================================================================
BEGIN;

ALTER TABLE public.exams ALTER COLUMN active_draft_id SET DEFAULT gen_random_uuid();
UPDATE public.exams
SET active_draft_id=gen_random_uuid(), draft_reason=COALESCE(draft_reason,'Initial result preparation')
WHERE current_revision_id IS NULL AND active_draft_id IS NULL;

-- A published correction always keeps the roster captured by the current
-- revision. An exam that has never been published uses its eligible live roster.
CREATE OR REPLACE FUNCTION public.exam_result_roster(p_exam_id uuid)
RETURNS TABLE(enrollment_id uuid,student_id uuid,section_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT se.id,se.student_id,se.section_id
  FROM public.exams e
  JOIN public.student_enrollments se
    ON se.academic_year_id=e.academic_year_id AND se.class_id=e.class_id
  WHERE e.id=p_exam_id
    AND (
      (e.current_revision_id IS NULL AND se.status IN ('active','promoted','retained','graduated'))
      OR
      (e.current_revision_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM public.exam_result_revision_students rs
        WHERE rs.revision_id=e.current_revision_id
          AND rs.enrollment_id=se.id AND rs.student_id=se.student_id
      ))
    );
$$;
REVOKE ALL ON FUNCTION public.exam_result_roster(uuid) FROM PUBLIC;

-- Application clients may not bypass immutable publication by directly
-- changing the exam's revision state. The transactional RPCs opt in via a
-- transaction-local flag; trusted seed/migration sessions have no auth.uid().
CREATE OR REPLACE FUNCTION public.protect_exam_revision_state()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND COALESCE(current_setting('app.exam_revision_operation',true),'')<>'on'
     AND (OLD.current_revision_id,OLD.active_draft_id,OLD.draft_reason,OLD.is_published,OLD.published_at,OLD.published_by)
       IS DISTINCT FROM
         (NEW.current_revision_id,NEW.active_draft_id,NEW.draft_reason,NEW.is_published,NEW.published_at,NEW.published_by)
  THEN
    RAISE EXCEPTION 'EXAM_REVISION_STATE_REQUIRES_TRANSACTIONAL_RPC';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_exam_revision_state ON public.exams;
CREATE TRIGGER trg_protect_exam_revision_state
BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.protect_exam_revision_state();

CREATE OR REPLACE FUNCTION public.validate_mark_entry_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  v_exam public.exams%ROWTYPE;
  v_enrollment public.student_enrollments%ROWTYPE;
  v_subject public.subjects%ROWTYPE;
  v_component public.assessment_components%ROWTYPE;
BEGIN
  SELECT * INTO v_exam FROM public.exams WHERE id=NEW.exam_id;
  SELECT * INTO v_enrollment FROM public.student_enrollments WHERE id=NEW.enrollment_id;
  SELECT * INTO v_subject FROM public.subjects WHERE id=NEW.subject_id;
  SELECT * INTO v_component FROM public.assessment_components WHERE id=NEW.component_id;
  IF v_exam.id IS NULL OR v_exam.active_draft_id IS NULL THEN RAISE EXCEPTION 'EXAM_HAS_NO_OPEN_DRAFT'; END IF;
  IF v_enrollment.id IS NULL OR v_enrollment.student_id<>NEW.student_id
     OR NOT EXISTS(SELECT 1 FROM public.exam_result_roster(v_exam.id) r
                   WHERE r.enrollment_id=NEW.enrollment_id AND r.student_id=NEW.student_id)
  THEN RAISE EXCEPTION 'INVALID_MARK_ENROLLMENT'; END IF;
  IF v_subject.id IS NULL OR v_subject.class_id<>v_exam.class_id THEN RAISE EXCEPTION 'INVALID_MARK_SUBJECT'; END IF;
  IF v_component.id IS NULL OR v_component.config_id<>v_exam.config_id
     OR (v_component.term_id IS NOT NULL AND v_component.term_id<>v_exam.term_id)
  THEN RAISE EXCEPTION 'INVALID_MARK_COMPONENT'; END IF;
  IF NEW.status='PRESENT' AND
     (NEW.marks_obtained IS NULL OR NEW.marks_obtained<0 OR NEW.marks_obtained>v_component.max_marks)
  THEN RAISE EXCEPTION 'MARK_OUT_OF_RANGE: expected 0..%',v_component.max_marks; END IF;
  IF NEW.status<>'PRESENT' AND NEW.marks_obtained IS NOT NULL THEN
    RAISE EXCEPTION 'NON_PRESENT_MARK_MUST_BE_NULL';
  END IF;
  RETURN NEW;
END; $$;

-- Preserve the legacy-imported snapshots exactly as they were, while making
-- every newly published snapshot include subject grade-band pass decisions.
ALTER FUNCTION public.build_result_revision_student_snapshot(uuid,uuid,uuid)
  RENAME TO build_result_revision_student_snapshot_v2_base;
REVOKE ALL ON FUNCTION public.build_result_revision_student_snapshot_v2_base(uuid,uuid,uuid) FROM PUBLIC;

CREATE FUNCTION public.build_result_revision_student_snapshot(
  p_exam_id uuid,p_enrollment_id uuid,p_revision_id uuid
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_payload jsonb; v_subjects jsonb;
BEGIN
  v_payload:=public.build_result_revision_student_snapshot_v2_base(p_exam_id,p_enrollment_id,p_revision_id);
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'subject_id',q.subject_id,'subject_code',q.subject_code,'subject_name',q.subject_name,
    'obtained_marks',q.obtained_marks,'max_marks',q.max_marks,'percentage',q.percentage,
    'grade',COALESCE(g.grade,'N/A'),'grade_remark',COALESCE(g.remark,''),
    'is_passed',q.component_passed AND q.percentage>=q.pass_percentage AND COALESCE(g.is_passing,false)
  ) ORDER BY q.subject_code),'[]'::jsonb) INTO v_subjects
  FROM (
    SELECT sub.id subject_id,sub.code subject_code,sub.name subject_name,cfg.pass_percentage,
      SUM(CASE WHEN m.status='PRESENT' THEN m.marks_obtained ELSE 0 END) obtained_marks,
      SUM(comp.max_marks) max_marks,
      CASE WHEN SUM(comp.max_marks)>0 THEN
        ROUND(SUM(CASE WHEN m.status='PRESENT' THEN m.marks_obtained ELSE 0 END)*100/SUM(comp.max_marks),2)
      ELSE 0 END percentage,
      BOOL_AND(CASE
        WHEN NOT comp.is_mandatory AND (m.id IS NULL OR m.status='MISSING') THEN true
        WHEN comp.is_mandatory AND (m.id IS NULL OR m.status='MISSING') THEN false
        WHEN comp.pass_marks<=0 THEN true
        WHEN m.status='PRESENT' THEN m.marks_obtained>=comp.pass_marks
        ELSE false END) component_passed
    FROM public.exams e
    JOIN public.assessment_configs cfg ON cfg.id=e.config_id
    JOIN public.subjects sub ON sub.class_id=e.class_id
    JOIN public.assessment_components comp ON comp.config_id=e.config_id
      AND (comp.term_id IS NULL OR comp.term_id=e.term_id)
    LEFT JOIN public.mark_entries m ON m.exam_id=e.id AND m.enrollment_id=p_enrollment_id
      AND m.subject_id=sub.id AND m.component_id=comp.id
    WHERE e.id=p_exam_id
    GROUP BY sub.id,sub.code,sub.name,cfg.pass_percentage
  ) q
  LEFT JOIN LATERAL (
    SELECT gb.grade,gb.remark,gb.is_passing FROM public.exams e2
    JOIN public.grade_bands gb ON gb.config_id=e2.config_id
    WHERE e2.id=p_exam_id AND q.percentage BETWEEN gb.min_percentage AND gb.max_percentage
    ORDER BY gb.min_percentage DESC LIMIT 1
  ) g ON true;
  RETURN jsonb_set(v_payload,'{subject_results}',v_subjects,true);
END; $$;
REVOKE ALL ON FUNCTION public.build_result_revision_student_snapshot(uuid,uuid,uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.recalculate_exam_draft_core(p_exam_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_exam public.exams%ROWTYPE; v_config public.assessment_configs%ROWTYPE;
  v_total_max_per_subject numeric; v_subject_count integer; v_total_exam_max numeric;
  v_enroll record; v_obtained numeric; v_pct numeric; v_grade record;
  v_subject_failed boolean; v_is_passed boolean; v_annual_pct numeric;
BEGIN
  SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXAM_NOT_FOUND'; END IF;
  IF v_exam.active_draft_id IS NULL THEN RAISE EXCEPTION 'EXAM_HAS_NO_OPEN_DRAFT'; END IF;
  SELECT * INTO v_config FROM public.assessment_configs WHERE id=v_exam.config_id;
  SELECT COALESCE(SUM(max_marks),0) INTO v_total_max_per_subject
  FROM public.assessment_components WHERE config_id=v_exam.config_id AND (term_id IS NULL OR term_id=v_exam.term_id);
  SELECT COUNT(*) INTO v_subject_count FROM public.subjects WHERE class_id=v_exam.class_id;
  v_total_exam_max:=v_total_max_per_subject*v_subject_count;

  DELETE FROM public.mark_entries m WHERE m.exam_id=v_exam.id
    AND NOT EXISTS(SELECT 1 FROM public.exam_result_roster(v_exam.id) r WHERE r.enrollment_id=m.enrollment_id AND r.student_id=m.student_id);
  DELETE FROM public.exam_student_summaries s WHERE s.exam_id=v_exam.id
    AND NOT EXISTS(SELECT 1 FROM public.exam_result_roster(v_exam.id) r WHERE r.enrollment_id=s.enrollment_id AND r.student_id=s.student_id);

  FOR v_enroll IN SELECT * FROM public.exam_result_roster(v_exam.id) LOOP
    SELECT COALESCE(SUM(CASE WHEN status='PRESENT' THEN marks_obtained ELSE 0 END),0)
      INTO v_obtained FROM public.mark_entries WHERE exam_id=v_exam.id AND enrollment_id=v_enroll.enrollment_id;
    v_pct:=CASE WHEN v_total_exam_max>0 THEN ROUND(v_obtained*100/v_total_exam_max,2) ELSE 0 END;

    SELECT EXISTS(
      SELECT 1 FROM (
        SELECT sub.id,
          CASE WHEN SUM(c.max_marks)>0 THEN
            ROUND(SUM(CASE WHEN m.status='PRESENT' THEN m.marks_obtained ELSE 0 END)*100/SUM(c.max_marks),2)
          ELSE 0 END subject_pct,
          BOOL_OR(CASE
            WHEN NOT c.is_mandatory AND (m.id IS NULL OR m.status='MISSING') THEN false
            WHEN c.is_mandatory AND (m.id IS NULL OR m.status='MISSING') THEN true
            WHEN c.pass_marks<=0 THEN false
            WHEN m.status='PRESENT' THEN m.marks_obtained<c.pass_marks
            ELSE true END) component_failed
        FROM public.subjects sub
        CROSS JOIN public.assessment_components c
        LEFT JOIN public.mark_entries m ON m.exam_id=v_exam.id AND m.enrollment_id=v_enroll.enrollment_id
          AND m.subject_id=sub.id AND m.component_id=c.id
        WHERE sub.class_id=v_exam.class_id AND c.config_id=v_exam.config_id
          AND (c.term_id IS NULL OR c.term_id=v_exam.term_id)
        GROUP BY sub.id
      ) sr
      LEFT JOIN LATERAL (
        SELECT gb.is_passing FROM public.grade_bands gb
        WHERE gb.config_id=v_exam.config_id AND sr.subject_pct BETWEEN gb.min_percentage AND gb.max_percentage
        ORDER BY gb.min_percentage DESC LIMIT 1
      ) band ON true
      WHERE sr.subject_pct<v_config.pass_percentage OR sr.component_failed OR NOT COALESCE(band.is_passing,false)
    ) INTO v_subject_failed;

    SELECT grade,remark,is_passing INTO v_grade FROM public.grade_bands
    WHERE config_id=v_exam.config_id AND v_pct BETWEEN min_percentage AND max_percentage
    ORDER BY min_percentage DESC LIMIT 1;
    v_is_passed:=COALESCE(v_grade.is_passing,false) AND v_pct>=v_config.pass_percentage AND NOT COALESCE(v_subject_failed,false);

    INSERT INTO public.exam_student_summaries(exam_id,enrollment_id,student_id,total_obtained,total_max,percentage,
      overall_grade,grade_remark,is_passed,updated_at)
    VALUES(v_exam.id,v_enroll.enrollment_id,v_enroll.student_id,v_obtained,v_total_exam_max,v_pct,
      COALESCE(v_grade.grade,'N/A'),COALESCE(v_grade.remark,''),v_is_passed,now())
    ON CONFLICT(exam_id,enrollment_id) DO UPDATE SET student_id=EXCLUDED.student_id,
      total_obtained=EXCLUDED.total_obtained,total_max=EXCLUDED.total_max,percentage=EXCLUDED.percentage,
      overall_grade=EXCLUDED.overall_grade,grade_remark=EXCLUDED.grade_remark,is_passed=EXCLUDED.is_passed,updated_at=now();
  END LOOP;

  WITH ranked AS (
    SELECT s.id,RANK() OVER(PARTITION BY r.section_id ORDER BY s.percentage DESC,s.total_obtained DESC) sec_rk,
      RANK() OVER(ORDER BY s.percentage DESC,s.total_obtained DESC) cls_rk
    FROM public.exam_student_summaries s JOIN public.exam_result_roster(v_exam.id) r ON r.enrollment_id=s.enrollment_id
    WHERE s.exam_id=v_exam.id
  ) UPDATE public.exam_student_summaries s SET section_rank=r.sec_rk,class_rank=r.cls_rk FROM ranked r WHERE s.id=r.id;

  FOR v_enroll IN SELECT id,enrollment_id FROM public.exam_student_summaries WHERE exam_id=v_exam.id LOOP
    SELECT CASE WHEN SUM(x.weight_percent)>0 THEN ROUND(SUM(x.percentage*x.weight_percent)/SUM(x.weight_percent),2) END
      INTO v_annual_pct
    FROM (
      SELECT v_pct2.percentage,t.weight_percent
      FROM (SELECT s.percentage FROM public.exam_student_summaries s
            WHERE s.exam_id=v_exam.id AND s.enrollment_id=v_enroll.enrollment_id) v_pct2
      JOIN public.assessment_terms t ON t.id=v_exam.term_id
      UNION ALL
      SELECT (rs.report_snapshot->'summary'->>'percentage')::numeric,t.weight_percent
      FROM public.exams e2
      JOIN public.assessment_terms t ON t.id=e2.term_id
      JOIN public.exam_result_revision_students rs ON rs.revision_id=e2.current_revision_id
        AND rs.enrollment_id=v_enroll.enrollment_id
      WHERE e2.id<>v_exam.id AND e2.academic_year_id=v_exam.academic_year_id AND e2.class_id=v_exam.class_id
    ) x;
    UPDATE public.exam_student_summaries SET annual_weighted_percentage=v_annual_pct WHERE id=v_enroll.id;
  END LOOP;
  RETURN jsonb_build_object('exam_id',v_exam.id,'draft_id',v_exam.active_draft_id,'total_exam_max',v_total_exam_max);
END; $$;
REVOKE ALL ON FUNCTION public.recalculate_exam_draft_core(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.save_exam_marks_draft_tx(
  p_exam_id uuid,p_draft_id uuid,p_subject_id uuid,p_entries jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_exam public.exams%ROWTYPE; v_role public.user_role; v_expected integer; v_entry jsonb; v_score_text text;
BEGIN
  v_role:=public.current_user_role();
  IF v_role NOT IN ('super_admin','admin','teacher') THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR UPDATE;
  IF v_exam.active_draft_id IS NULL OR v_exam.active_draft_id<>p_draft_id THEN RAISE EXCEPTION 'STALE_EXAM_DRAFT'; END IF;
  IF NOT public.is_teacher_for_subject(p_subject_id) THEN RAISE EXCEPTION 'UNAUTHORIZED_SUBJECT'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.subjects WHERE id=p_subject_id AND class_id=v_exam.class_id) THEN RAISE EXCEPTION 'INVALID_MARK_SUBJECT'; END IF;
  IF jsonb_typeof(p_entries)<>'array' THEN RAISE EXCEPTION 'INVALID_MARK_PAYLOAD'; END IF;
  SELECT COUNT(*) INTO v_expected FROM public.exam_result_roster(v_exam.id) r
    CROSS JOIN public.assessment_components c
    WHERE c.config_id=v_exam.config_id AND (c.term_id IS NULL OR c.term_id=v_exam.term_id);
  IF jsonb_array_length(p_entries)<>v_expected THEN RAISE EXCEPTION 'INCOMPLETE_MARK_PAYLOAD'; END IF;
  IF (SELECT COUNT(*) FROM (SELECT e->>'enrollment_id',e->>'component_id'
      FROM jsonb_array_elements(p_entries)e GROUP BY 1,2)q)<>v_expected THEN RAISE EXCEPTION 'DUPLICATE_MARK_PAYLOAD'; END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    IF (v_entry->>'status') NOT IN ('PRESENT','ABSENT','MISSING') THEN RAISE EXCEPTION 'INVALID_MARK_STATUS'; END IF;
    IF (v_entry->>'status')='PRESENT' THEN
      v_score_text:=v_entry->>'marks_obtained';
      IF v_score_text IS NULL OR v_score_text!~'^-?[0-9]+([.][0-9]{1,2})?$' THEN RAISE EXCEPTION 'INVALID_MARK_SCORE'; END IF;
    ELSIF (v_entry->'marks_obtained') IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'NON_PRESENT_MARK_MUST_BE_NULL';
    END IF;
    INSERT INTO public.mark_entries(exam_id,enrollment_id,student_id,subject_id,component_id,status,marks_obtained,entered_by,updated_at)
    VALUES(p_exam_id,(v_entry->>'enrollment_id')::uuid,(v_entry->>'student_id')::uuid,p_subject_id,
      (v_entry->>'component_id')::uuid,(v_entry->>'status')::public.mark_status,
      CASE WHEN (v_entry->>'status')='PRESENT' THEN v_score_text::numeric ELSE NULL END,auth.uid(),now())
    ON CONFLICT(exam_id,enrollment_id,subject_id,component_id) DO UPDATE SET student_id=EXCLUDED.student_id,
      status=EXCLUDED.status,marks_obtained=EXCLUDED.marks_obtained,entered_by=auth.uid(),updated_at=now();
  END LOOP;
  PERFORM public.recalculate_exam_draft_core(p_exam_id);
  RETURN jsonb_build_object('saved',v_expected,'draft_id',p_draft_id);
END; $$;

CREATE OR REPLACE FUNCTION public.publish_exam_revision_tx(p_exam_id uuid,p_draft_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_exam public.exams%ROWTYPE; v_revision_id uuid:=gen_random_uuid(); v_revision_no integer;
  v_missing integer; v_actor_role public.user_role;
BEGIN
  v_actor_role:=public.current_user_role();
  IF v_actor_role NOT IN ('super_admin','admin') THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR UPDATE;
  IF v_exam.active_draft_id IS NULL OR v_exam.active_draft_id<>p_draft_id THEN RAISE EXCEPTION 'STALE_EXAM_DRAFT'; END IF;
  PERFORM public.recalculate_exam_draft_core(p_exam_id);
  SELECT COUNT(*) INTO v_missing FROM public.exam_result_roster(v_exam.id) r
  CROSS JOIN public.subjects sub CROSS JOIN public.assessment_components c
  LEFT JOIN public.mark_entries m ON m.exam_id=v_exam.id AND m.enrollment_id=r.enrollment_id
    AND m.subject_id=sub.id AND m.component_id=c.id
  WHERE sub.class_id=v_exam.class_id AND c.config_id=v_exam.config_id AND (c.term_id IS NULL OR c.term_id=v_exam.term_id)
    AND c.is_mandatory AND (m.id IS NULL OR m.status='MISSING');
  IF v_missing>0 THEN RAISE EXCEPTION 'MISSING_MANDATORY_MARKS: %',v_missing; END IF;
  SELECT COALESCE(MAX(revision_number),0)+1 INTO v_revision_no FROM public.exam_result_revisions WHERE exam_id=v_exam.id;
  INSERT INTO public.exam_result_revisions(id,exam_id,revision_number,source_draft_id,correction_reason,published_by,published_at,exam_snapshot)
  VALUES(v_revision_id,v_exam.id,v_revision_no,p_draft_id,COALESCE(NULLIF(v_exam.draft_reason,''),'Initial publication'),auth.uid(),now(),
    jsonb_build_object('exam_id',v_exam.id,'name',v_exam.name,'academic_year_id',v_exam.academic_year_id,'class_id',v_exam.class_id,
      'config_id',v_exam.config_id,'term_id',v_exam.term_id,'revision_number',v_revision_no));
  INSERT INTO public.exam_result_revision_students(revision_id,exam_id,enrollment_id,student_id,report_snapshot)
  SELECT v_revision_id,v_exam.id,s.enrollment_id,s.student_id,
    public.build_result_revision_student_snapshot(v_exam.id,s.enrollment_id,v_revision_id)
  FROM public.exam_student_summaries s WHERE s.exam_id=v_exam.id;
  PERFORM set_config('app.exam_revision_operation','on',true);
  UPDATE public.exams SET current_revision_id=v_revision_id,is_published=true,published_at=now(),published_by=auth.uid(),
    active_draft_id=NULL,draft_reason=NULL,updated_at=now() WHERE id=v_exam.id;
  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,after_state)
  VALUES(auth.uid(),v_actor_role,'EXAM_REVISION_PUBLISHED','exam_result_revisions',v_revision_id::text,
    jsonb_build_object('exam_id',v_exam.id,'revision_number',v_revision_no));
  RETURN jsonb_build_object('revision_id',v_revision_id,'revision_number',v_revision_no);
END; $$;

CREATE OR REPLACE FUNCTION public.open_exam_correction_tx(p_exam_id uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_exam public.exams%ROWTYPE; v_draft uuid:=gen_random_uuid();
BEGIN
  IF NOT public.is_admin_or_super() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF length(trim(COALESCE(p_reason,'')))<5 THEN RAISE EXCEPTION 'CORRECTION_REASON_REQUIRED'; END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR UPDATE;
  IF v_exam.current_revision_id IS NULL THEN RAISE EXCEPTION 'NO_PUBLISHED_REVISION'; END IF;
  IF v_exam.active_draft_id IS NOT NULL THEN RAISE EXCEPTION 'CORRECTION_ALREADY_OPEN'; END IF;
  PERFORM set_config('app.exam_revision_operation','on',true);
  UPDATE public.exams SET active_draft_id=v_draft,draft_reason=trim(p_reason),updated_at=now() WHERE id=p_exam_id;
  PERFORM public.restore_exam_working_copy_from_revision(p_exam_id,v_exam.current_revision_id);
  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,after_state)
  VALUES(auth.uid(),public.current_user_role(),'EXAM_CORRECTION_OPENED','exams',p_exam_id::text,
    jsonb_build_object('draft_id',v_draft,'reason',trim(p_reason),'source_revision_id',v_exam.current_revision_id));
  RETURN v_draft;
END; $$;

CREATE OR REPLACE FUNCTION public.discard_exam_correction_tx(p_exam_id uuid,p_draft_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_exam public.exams%ROWTYPE;
BEGIN
  IF NOT public.is_admin_or_super() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR UPDATE;
  IF v_exam.active_draft_id IS NULL OR v_exam.active_draft_id<>p_draft_id OR v_exam.current_revision_id IS NULL
  THEN RAISE EXCEPTION 'STALE_EXAM_DRAFT'; END IF;
  PERFORM public.restore_exam_working_copy_from_revision(p_exam_id,v_exam.current_revision_id);
  PERFORM set_config('app.exam_revision_operation','on',true);
  UPDATE public.exams SET active_draft_id=NULL,draft_reason=NULL,updated_at=now() WHERE id=p_exam_id;
  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,after_state)
  VALUES(auth.uid(),public.current_user_role(),'EXAM_CORRECTION_DISCARDED','exams',p_exam_id::text,
    jsonb_build_object('discarded_draft_id',p_draft_id,'restored_revision_id',v_exam.current_revision_id));
END; $$;

CREATE OR REPLACE FUNCTION public.save_exam_summary_comments_draft_tx(
  p_exam_id uuid,p_draft_id uuid,p_summary_id uuid,p_teacher_comment text,
  p_principal_comment text,p_skill_ratings jsonb
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_exam public.exams%ROWTYPE; v_role public.user_role;
BEGIN
  v_role:=public.current_user_role();
  IF v_role NOT IN ('super_admin','admin','teacher') THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR UPDATE;
  IF v_exam.active_draft_id IS NULL OR v_exam.active_draft_id<>p_draft_id THEN RAISE EXCEPTION 'STALE_EXAM_DRAFT'; END IF;
  IF v_role='teacher' AND NOT public.is_teacher_for_class(v_exam.class_id) THEN RAISE EXCEPTION 'UNAUTHORIZED_CLASS'; END IF;
  IF jsonb_typeof(COALESCE(p_skill_ratings,'{}'::jsonb))<>'object' OR EXISTS(
    SELECT 1 FROM jsonb_each_text(COALESCE(p_skill_ratings,'{}'::jsonb)) x WHERE x.value!~'^[1-5]$'
  ) THEN RAISE EXCEPTION 'INVALID_SKILL_RATINGS'; END IF;
  UPDATE public.exam_student_summaries SET teacher_comment=NULLIF(trim(COALESCE(p_teacher_comment,'')),''),
    principal_comment=CASE WHEN v_role IN ('super_admin','admin') THEN NULLIF(trim(COALESCE(p_principal_comment,'')),'') ELSE principal_comment END,
    skill_ratings=COALESCE(p_skill_ratings,'{}'::jsonb),updated_at=now()
  WHERE id=p_summary_id AND exam_id=p_exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUMMARY_NOT_FOUND'; END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.save_exam_marks_draft_tx(uuid,uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_exam_revision_tx(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_exam_correction_tx(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.discard_exam_correction_tx(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_exam_summary_comments_draft_tx(uuid,uuid,uuid,text,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.save_exam_summary_comments_draft_tx(uuid,uuid,uuid,text,text,jsonb) FROM anon;

COMMIT;
