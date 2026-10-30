-- =============================================================================
-- Assessment integrity, atomic draft writes, and immutable result revisions
-- =============================================================================
BEGIN;

-- Abort before changing the schema when the existing data cannot be migrated safely.
DO $$
DECLARE
  v_bad_scores text;
  v_bad_exams text;
  v_bad_snapshots text;
BEGIN
  SELECT string_agg(m.id::text, ', ' ORDER BY m.id::text)
  INTO v_bad_scores
  FROM public.mark_entries m
  JOIN public.assessment_components c ON c.id = m.component_id
  WHERE m.status = 'PRESENT'
    AND (m.marks_obtained < 0 OR m.marks_obtained > c.max_marks);

  SELECT string_agg(e.id::text, ', ' ORDER BY e.id::text)
  INTO v_bad_exams
  FROM public.exams e
  JOIN public.assessment_configs c ON c.id = e.config_id
  JOIN public.assessment_terms t ON t.id = e.term_id
  WHERE t.config_id <> e.config_id
     OR c.class_id IS DISTINCT FROM e.class_id
     OR c.academic_year_id IS DISTINCT FROM e.academic_year_id;

  SELECT string_agg(s.id::text, ', ' ORDER BY s.id::text)
  INTO v_bad_snapshots
  FROM public.exam_student_summaries s
  JOIN public.exams e ON e.id = s.exam_id
  WHERE e.is_published
    AND (
      s.published_snapshot IS NULL
      OR (s.published_snapshot->>'total_obtained')::numeric IS DISTINCT FROM (
        SELECT COALESCE(SUM(CASE WHEN m.status = 'PRESENT' THEN m.marks_obtained ELSE 0 END), 0)
        FROM public.mark_entries m
        WHERE m.exam_id = s.exam_id AND m.enrollment_id = s.enrollment_id
      )
    );

  IF v_bad_scores IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT_INVALID_MARK_SCORES: %', v_bad_scores;
  END IF;
  IF v_bad_exams IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT_INCOMPATIBLE_EXAMS: %', v_bad_exams;
  END IF;
  IF v_bad_snapshots IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT_SNAPSHOT_MISMATCHES: %', v_bad_snapshots;
  END IF;
END;
$$;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS active_draft_id uuid,
  ADD COLUMN IF NOT EXISTS draft_reason text;

UPDATE public.exams
SET active_draft_id = gen_random_uuid(),
    draft_reason = 'Initial result preparation'
WHERE NOT is_published AND active_draft_id IS NULL;

CREATE TABLE IF NOT EXISTS public.exam_result_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  source_draft_id uuid NOT NULL,
  correction_reason text NOT NULL,
  is_legacy_import boolean NOT NULL DEFAULT false,
  published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  exam_snapshot jsonb NOT NULL,
  UNIQUE (exam_id, revision_number),
  UNIQUE (exam_id, source_draft_id)
);

CREATE TABLE IF NOT EXISTS public.exam_result_revision_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.exam_result_revisions(id) ON DELETE RESTRICT,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE RESTRICT,
  enrollment_id uuid NOT NULL REFERENCES public.student_enrollments(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  report_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (revision_id, enrollment_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_result_revisions_exam
  ON public.exam_result_revisions(exam_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_exam_revision_students_student
  ON public.exam_result_revision_students(student_id, revision_id);

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS current_revision_id uuid REFERENCES public.exam_result_revisions(id) ON DELETE RESTRICT;

-- Build the complete immutable report payload used by the UI and PDF endpoints.
CREATE OR REPLACE FUNCTION public.build_result_revision_student_snapshot(
  p_exam_id uuid,
  p_enrollment_id uuid,
  p_revision_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  SELECT jsonb_build_object(
    'schema_version', 2,
    'summary', jsonb_build_object(
      'total_obtained', ess.total_obtained,
      'total_max', ess.total_max,
      'percentage', ess.percentage,
      'annual_weighted_percentage', ess.annual_weighted_percentage,
      'overall_grade', ess.overall_grade,
      'grade_remark', ess.grade_remark,
      'is_passed', ess.is_passed,
      'section_rank', ess.section_rank,
      'class_rank', ess.class_rank,
      'teacher_comment', ess.teacher_comment,
      'principal_comment', ess.principal_comment,
      'skill_ratings', ess.skill_ratings
    ),
    'student', jsonb_build_object(
      'student_id', st.id,
      'enrollment_id', se.id,
      'full_name', p.full_name,
      'admission_no', st.admission_no,
      'student_code', p.code,
      'roll_no', se.roll_no,
      'class_name', sc.name,
      'class_code', sc.code,
      'section_name', sec.name,
      'academic_year', ay.name,
      'house', st.house
    ),
    'school', to_jsonb(ss),
    'exam', jsonb_build_object(
      'exam_id', e.id,
      'name', e.name,
      'start_date', e.start_date,
      'end_date', e.end_date,
      'term_id', term.id,
      'term_code', term.code,
      'term_name', term.name,
      'term_weight_percent', term.weight_percent,
      'config_id', cfg.id,
      'config_name', cfg.name,
      'config_version', cfg.version,
      'board_code', cfg.board_code,
      'custom_board_name', cfg.custom_board_name,
      'pass_percentage', cfg.pass_percentage
    ),
    'assessment_rules', jsonb_build_object(
      'components', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', c.id, 'term_id', c.term_id, 'code', c.code, 'name', c.name,
          'max_marks', c.max_marks, 'pass_marks', c.pass_marks,
          'is_mandatory', c.is_mandatory, 'display_order', c.display_order
        ) ORDER BY c.display_order, c.code)
        FROM public.assessment_components c
        WHERE c.config_id = e.config_id AND (c.term_id IS NULL OR c.term_id = e.term_id)
      ), '[]'::jsonb),
      'grade_bands', COALESCE((
        SELECT jsonb_agg(to_jsonb(g) ORDER BY g.display_order, g.min_percentage DESC)
        FROM public.grade_bands g WHERE g.config_id = e.config_id
      ), '[]'::jsonb)
    ),
    'marks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'exam_id', m.exam_id,
        'enrollment_id', m.enrollment_id,
        'student_id', m.student_id,
        'subject_id', m.subject_id,
        'subject_code', sub.code,
        'subject_name', sub.name,
        'component_id', m.component_id,
        'component_code', comp.code,
        'component_name', comp.name,
        'component_max_marks', comp.max_marks,
        'component_pass_marks', comp.pass_marks,
        'component_is_mandatory', comp.is_mandatory,
        'status', m.status,
        'marks_obtained', m.marks_obtained
      ) ORDER BY sub.code, comp.display_order, comp.code)
      FROM public.mark_entries m
      JOIN public.subjects sub ON sub.id = m.subject_id
      JOIN public.assessment_components comp ON comp.id = m.component_id
      WHERE m.exam_id = e.id AND m.enrollment_id = se.id
    ), '[]'::jsonb),
    'subject_results', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'subject_id', q.subject_id,
        'subject_code', q.subject_code,
        'subject_name', q.subject_name,
        'obtained_marks', q.obtained_marks,
        'max_marks', q.max_marks,
        'percentage', CASE WHEN q.max_marks > 0 THEN ROUND(q.obtained_marks * 100 / q.max_marks, 2) ELSE 0 END,
        'is_passed', q.component_passed AND
          (CASE WHEN q.max_marks > 0 THEN ROUND(q.obtained_marks * 100 / q.max_marks, 2) ELSE 0 END) >= cfg.pass_percentage
      ) ORDER BY q.subject_code)
      FROM (
        SELECT sub.id subject_id, sub.code subject_code, sub.name subject_name,
          SUM(CASE WHEN m.status = 'PRESENT' THEN m.marks_obtained ELSE 0 END) obtained_marks,
          SUM(comp.max_marks) max_marks,
          BOOL_AND(
            CASE
              WHEN NOT comp.is_mandatory AND m.status = 'MISSING' THEN true
              WHEN comp.pass_marks <= 0 THEN true
              WHEN m.status = 'PRESENT' THEN m.marks_obtained >= comp.pass_marks
              ELSE false
            END
          ) component_passed
        FROM public.subjects sub
        CROSS JOIN public.assessment_components comp
        LEFT JOIN public.mark_entries m
          ON m.exam_id = e.id AND m.enrollment_id = se.id
          AND m.subject_id = sub.id AND m.component_id = comp.id
        WHERE sub.class_id = e.class_id
          AND comp.config_id = e.config_id
          AND (comp.term_id IS NULL OR comp.term_id = e.term_id)
        GROUP BY sub.id, sub.code, sub.name
      ) q
    ), '[]'::jsonb),
    'source_term_revision_ids', COALESCE((
      SELECT jsonb_object_agg(t2.code,
        CASE WHEN e2.id = e.id THEN p_revision_id ELSE e2.current_revision_id END)
      FROM public.exams e2
      JOIN public.assessment_terms t2 ON t2.id = e2.term_id
      WHERE e2.academic_year_id = e.academic_year_id
        AND e2.class_id = e.class_id
        AND (e2.current_revision_id IS NOT NULL OR e2.id = e.id)
    ), '{}'::jsonb)
  )
  INTO v_payload
  FROM public.exam_student_summaries ess
  JOIN public.exams e ON e.id = ess.exam_id
  JOIN public.assessment_configs cfg ON cfg.id = e.config_id
  JOIN public.assessment_terms term ON term.id = e.term_id
  JOIN public.student_enrollments se ON se.id = ess.enrollment_id
  JOIN public.students st ON st.id = se.student_id
  JOIN public.profiles p ON p.id = st.user_id
  JOIN public.school_classes sc ON sc.id = se.class_id
  JOIN public.sections sec ON sec.id = se.section_id
  JOIN public.academic_years ay ON ay.id = se.academic_year_id
  CROSS JOIN LATERAL (SELECT s.* FROM public.school_settings s LIMIT 1) ss
  WHERE ess.exam_id = p_exam_id AND ess.enrollment_id = p_enrollment_id;

  RETURN v_payload;
END;
$$;

-- Validate exam/config/term/class/year compatibility and lock a configuration as soon as it is used.
CREATE OR REPLACE FUNCTION public.validate_exam_assessment_binding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_config public.assessment_configs%ROWTYPE; v_term public.assessment_terms%ROWTYPE;
BEGIN
  SELECT * INTO v_config FROM public.assessment_configs WHERE id = NEW.config_id;
  SELECT * INTO v_term FROM public.assessment_terms WHERE id = NEW.term_id;
  IF NOT FOUND OR v_config.id IS NULL THEN RAISE EXCEPTION 'INVALID_EXAM_CONFIGURATION'; END IF;
  IF v_config.class_id IS NULL OR v_config.academic_year_id IS NULL THEN
    RAISE EXCEPTION 'UNASSIGNED_ASSESSMENT_CONFIGURATION';
  END IF;
  IF v_config.class_id <> NEW.class_id OR v_config.academic_year_id <> NEW.academic_year_id
     OR v_term.config_id <> NEW.config_id THEN
    RAISE EXCEPTION 'INCOMPATIBLE_EXAM_CONFIGURATION';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.current_revision_id IS NOT NULL AND
     (OLD.class_id, OLD.academic_year_id, OLD.config_id, OLD.term_id) IS DISTINCT FROM
     (NEW.class_id, NEW.academic_year_id, NEW.config_id, NEW.term_id) THEN
    RAISE EXCEPTION 'PUBLISHED_EXAM_BINDING_IMMUTABLE';
  END IF;
  UPDATE public.assessment_configs SET is_locked = true, updated_at = now() WHERE id = NEW.config_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_exam_assessment_binding ON public.exams;
CREATE TRIGGER trg_validate_exam_assessment_binding
BEFORE INSERT OR UPDATE OF academic_year_id, class_id, config_id, term_id ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.validate_exam_assessment_binding();

-- Locked rule sets are immutable. is_active/name/description remain administrative metadata.
CREATE OR REPLACE FUNCTION public.protect_locked_assessment_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_locked THEN RAISE EXCEPTION 'LOCKED_ASSESSMENT_CONFIG'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_locked AND (
    NEW.is_locked = false OR
    (OLD.academic_year_id, OLD.class_id, OLD.board_code, OLD.custom_board_name,
     OLD.version, OLD.parent_config_id, OLD.pass_percentage, OLD.skill_definitions)
    IS DISTINCT FROM
    (NEW.academic_year_id, NEW.class_id, NEW.board_code, NEW.custom_board_name,
     NEW.version, NEW.parent_config_id, NEW.pass_percentage, NEW.skill_definitions)
  ) THEN RAISE EXCEPTION 'LOCKED_ASSESSMENT_CONFIG'; END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_locked_assessment_config ON public.assessment_configs;
CREATE TRIGGER trg_protect_locked_assessment_config
BEFORE UPDATE OR DELETE ON public.assessment_configs
FOR EACH ROW EXECUTE FUNCTION public.protect_locked_assessment_config();

CREATE OR REPLACE FUNCTION public.protect_locked_assessment_child()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_old_config uuid; v_new_config uuid;
BEGIN
  v_old_config := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.config_id END;
  v_new_config := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.config_id END;
  IF EXISTS (SELECT 1 FROM public.assessment_configs c WHERE c.id IN (v_old_config, v_new_config) AND c.is_locked) THEN
    RAISE EXCEPTION 'LOCKED_ASSESSMENT_RULES';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$ DECLARE v_table text; BEGIN
  FOREACH v_table IN ARRAY ARRAY['assessment_terms','assessment_components','grade_bands'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_protect_locked_rules ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER trg_protect_locked_rules BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.protect_locked_assessment_child()', v_table);
  END LOOP;
END $$;

-- Direct writes must satisfy every relationship and score boundary, and may only target an open draft.
CREATE OR REPLACE FUNCTION public.validate_mark_entry_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_exam public.exams%ROWTYPE;
  v_enrollment public.student_enrollments%ROWTYPE;
  v_subject public.subjects%ROWTYPE;
  v_component public.assessment_components%ROWTYPE;
BEGIN
  SELECT * INTO v_exam FROM public.exams WHERE id = NEW.exam_id;
  SELECT * INTO v_enrollment FROM public.student_enrollments WHERE id = NEW.enrollment_id;
  SELECT * INTO v_subject FROM public.subjects WHERE id = NEW.subject_id;
  SELECT * INTO v_component FROM public.assessment_components WHERE id = NEW.component_id;

  IF v_exam.active_draft_id IS NULL THEN RAISE EXCEPTION 'EXAM_HAS_NO_OPEN_DRAFT'; END IF;
  IF v_enrollment.student_id <> NEW.student_id OR v_enrollment.class_id <> v_exam.class_id
     OR v_enrollment.academic_year_id <> v_exam.academic_year_id THEN
    RAISE EXCEPTION 'INVALID_MARK_ENROLLMENT';
  END IF;
  IF v_subject.class_id <> v_exam.class_id THEN RAISE EXCEPTION 'INVALID_MARK_SUBJECT'; END IF;
  IF v_component.config_id <> v_exam.config_id OR
     (v_component.term_id IS NOT NULL AND v_component.term_id <> v_exam.term_id) THEN
    RAISE EXCEPTION 'INVALID_MARK_COMPONENT';
  END IF;
  IF NEW.status = 'PRESENT' AND (NEW.marks_obtained IS NULL OR NEW.marks_obtained < 0 OR NEW.marks_obtained > v_component.max_marks) THEN
    RAISE EXCEPTION 'MARK_OUT_OF_RANGE: expected 0..%', v_component.max_marks;
  END IF;
  IF NEW.status <> 'PRESENT' AND NEW.marks_obtained IS NOT NULL THEN
    RAISE EXCEPTION 'NON_PRESENT_MARK_MUST_BE_NULL';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_mark_entry_integrity ON public.mark_entries;
CREATE TRIGGER trg_validate_mark_entry_integrity
BEFORE INSERT OR UPDATE ON public.mark_entries
FOR EACH ROW EXECUTE FUNCTION public.validate_mark_entry_integrity();

-- Draft recalculation is kept separate so saving and calculation can share one transaction.
CREATE OR REPLACE FUNCTION public.recalculate_exam_draft_core(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam public.exams%ROWTYPE; v_config public.assessment_configs%ROWTYPE;
  v_total_max_per_subject numeric; v_subject_count integer; v_total_exam_max numeric;
  v_enroll record; v_obtained numeric; v_pct numeric; v_grade record;
  v_subject_failed boolean; v_is_passed boolean; v_annual_pct numeric;
BEGIN
  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXAM_NOT_FOUND'; END IF;
  IF v_exam.active_draft_id IS NULL THEN RAISE EXCEPTION 'EXAM_HAS_NO_OPEN_DRAFT'; END IF;
  SELECT * INTO v_config FROM public.assessment_configs WHERE id = v_exam.config_id;
  SELECT COALESCE(SUM(max_marks),0) INTO v_total_max_per_subject
  FROM public.assessment_components WHERE config_id=v_exam.config_id AND (term_id IS NULL OR term_id=v_exam.term_id);
  SELECT COUNT(*) INTO v_subject_count FROM public.subjects WHERE class_id=v_exam.class_id;
  v_total_exam_max := v_total_max_per_subject * v_subject_count;

  FOR v_enroll IN SELECT * FROM public.student_enrollments
    WHERE academic_year_id=v_exam.academic_year_id AND class_id=v_exam.class_id
      AND status IN ('active','promoted','retained','graduated')
  LOOP
    SELECT COALESCE(SUM(CASE WHEN status='PRESENT' THEN marks_obtained ELSE 0 END),0)
    INTO v_obtained FROM public.mark_entries
    WHERE exam_id=v_exam.id AND enrollment_id=v_enroll.id;
    v_pct := CASE WHEN v_total_exam_max>0 THEN ROUND(v_obtained*100/v_total_exam_max,2) ELSE 0 END;

    SELECT EXISTS (
      SELECT 1 FROM public.subjects sub WHERE sub.class_id=v_exam.class_id AND (
        (SELECT CASE WHEN SUM(c.max_marks)>0 THEN
          ROUND(SUM(CASE WHEN m.status='PRESENT' THEN m.marks_obtained ELSE 0 END)*100/SUM(c.max_marks),2)
          ELSE 0 END
         FROM public.assessment_components c
         LEFT JOIN public.mark_entries m ON m.exam_id=v_exam.id AND m.enrollment_id=v_enroll.id
           AND m.subject_id=sub.id AND m.component_id=c.id
         WHERE c.config_id=v_exam.config_id AND (c.term_id IS NULL OR c.term_id=v_exam.term_id)
        ) < v_config.pass_percentage
        OR EXISTS (
          SELECT 1 FROM public.assessment_components c
          LEFT JOIN public.mark_entries m ON m.exam_id=v_exam.id AND m.enrollment_id=v_enroll.id
            AND m.subject_id=sub.id AND m.component_id=c.id
          WHERE c.config_id=v_exam.config_id AND (c.term_id IS NULL OR c.term_id=v_exam.term_id)
            AND (
              (c.is_mandatory AND (m.id IS NULL OR m.status='MISSING'))
              OR (c.pass_marks>0 AND m.status IN ('PRESENT','ABSENT')
                AND CASE WHEN m.status='PRESENT' THEN m.marks_obtained ELSE 0 END < c.pass_marks)
            )
        )
      )
    ) INTO v_subject_failed;

    SELECT grade,remark,is_passing INTO v_grade FROM public.grade_bands
    WHERE config_id=v_exam.config_id AND v_pct BETWEEN min_percentage AND max_percentage
    ORDER BY min_percentage DESC LIMIT 1;
    v_is_passed := COALESCE(v_grade.is_passing,v_pct>=v_config.pass_percentage) AND NOT COALESCE(v_subject_failed,false);

    INSERT INTO public.exam_student_summaries(exam_id,enrollment_id,student_id,total_obtained,total_max,percentage,overall_grade,grade_remark,is_passed,updated_at)
    VALUES(v_exam.id,v_enroll.id,v_enroll.student_id,v_obtained,v_total_exam_max,v_pct,COALESCE(v_grade.grade,'N/A'),COALESCE(v_grade.remark,''),v_is_passed,now())
    ON CONFLICT(exam_id,enrollment_id) DO UPDATE SET
      total_obtained=EXCLUDED.total_obtained,total_max=EXCLUDED.total_max,percentage=EXCLUDED.percentage,
      overall_grade=EXCLUDED.overall_grade,grade_remark=EXCLUDED.grade_remark,is_passed=EXCLUDED.is_passed,updated_at=now();
  END LOOP;

  WITH ranked AS (
    SELECT ess.id,
      RANK() OVER(PARTITION BY se.section_id ORDER BY ess.percentage DESC,ess.total_obtained DESC) sec_rk,
      RANK() OVER(ORDER BY ess.percentage DESC,ess.total_obtained DESC) cls_rk
    FROM public.exam_student_summaries ess JOIN public.student_enrollments se ON se.id=ess.enrollment_id
    WHERE ess.exam_id=v_exam.id
  ) UPDATE public.exam_student_summaries ess SET section_rank=r.sec_rk,class_rank=r.cls_rk FROM ranked r WHERE ess.id=r.id;

  FOR v_enroll IN SELECT id,enrollment_id FROM public.exam_student_summaries WHERE exam_id=v_exam.id LOOP
    SELECT CASE WHEN SUM(t.weight_percent)>0 THEN ROUND(SUM(s.percentage*t.weight_percent)/SUM(t.weight_percent),2) END
    INTO v_annual_pct FROM public.exam_student_summaries s
    JOIN public.exams e ON e.id=s.exam_id JOIN public.assessment_terms t ON t.id=e.term_id
    WHERE s.enrollment_id=v_enroll.enrollment_id AND e.academic_year_id=v_exam.academic_year_id AND e.class_id=v_exam.class_id;
    UPDATE public.exam_student_summaries SET annual_weighted_percentage=v_annual_pct WHERE id=v_enroll.id;
  END LOOP;
  RETURN jsonb_build_object('exam_id',v_exam.id,'draft_id',v_exam.active_draft_id,'total_exam_max',v_total_exam_max);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_exam_marks_draft_tx(
  p_exam_id uuid, p_draft_id uuid, p_subject_id uuid, p_entries jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_exam public.exams%ROWTYPE; v_role public.user_role; v_expected integer; v_entry jsonb;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('super_admin','admin','teacher') THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR UPDATE;
  IF v_exam.active_draft_id IS NULL OR v_exam.active_draft_id<>p_draft_id THEN RAISE EXCEPTION 'STALE_EXAM_DRAFT'; END IF;
  IF NOT public.is_teacher_for_subject(p_subject_id) THEN RAISE EXCEPTION 'UNAUTHORIZED_SUBJECT'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.subjects WHERE id=p_subject_id AND class_id=v_exam.class_id) THEN RAISE EXCEPTION 'INVALID_MARK_SUBJECT'; END IF;
  IF jsonb_typeof(p_entries)<>'array' THEN RAISE EXCEPTION 'INVALID_MARK_PAYLOAD'; END IF;

  SELECT COUNT(*) INTO v_expected FROM public.student_enrollments se
  CROSS JOIN public.assessment_components c
  WHERE se.academic_year_id=v_exam.academic_year_id AND se.class_id=v_exam.class_id
    AND se.status IN ('active','promoted','retained','graduated')
    AND c.config_id=v_exam.config_id AND (c.term_id IS NULL OR c.term_id=v_exam.term_id);
  IF jsonb_array_length(p_entries)<>v_expected THEN RAISE EXCEPTION 'INCOMPLETE_MARK_PAYLOAD'; END IF;
  IF (SELECT COUNT(*) FROM (SELECT e->>'enrollment_id',e->>'component_id' FROM jsonb_array_elements(p_entries)e GROUP BY 1,2)q)<>v_expected THEN
    RAISE EXCEPTION 'DUPLICATE_MARK_PAYLOAD';
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    IF (v_entry->>'status') NOT IN ('PRESENT','ABSENT','MISSING') THEN RAISE EXCEPTION 'INVALID_MARK_STATUS'; END IF;
    IF (v_entry->>'status')='PRESENT' AND (NOT (v_entry ? 'marks_obtained') OR (v_entry->>'marks_obtained') IS NULL) THEN
      RAISE EXCEPTION 'PRESENT_MARK_REQUIRES_SCORE';
    END IF;
    IF (v_entry->>'status')<>'PRESENT' AND (v_entry->'marks_obtained') IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'NON_PRESENT_MARK_MUST_BE_NULL';
    END IF;
    INSERT INTO public.mark_entries(exam_id,enrollment_id,student_id,subject_id,component_id,status,marks_obtained,entered_by,updated_at)
    VALUES(p_exam_id,(v_entry->>'enrollment_id')::uuid,(v_entry->>'student_id')::uuid,p_subject_id,
      (v_entry->>'component_id')::uuid,(v_entry->>'status')::public.mark_status,
      CASE WHEN (v_entry->>'status')='PRESENT' THEN (v_entry->>'marks_obtained')::numeric ELSE NULL END,auth.uid(),now())
    ON CONFLICT(exam_id,enrollment_id,subject_id,component_id) DO UPDATE SET
      student_id=EXCLUDED.student_id,status=EXCLUDED.status,marks_obtained=EXCLUDED.marks_obtained,entered_by=auth.uid(),updated_at=now();
  END LOOP;
  PERFORM public.recalculate_exam_draft_core(p_exam_id);
  RETURN jsonb_build_object('saved',v_expected,'draft_id',p_draft_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_exam_revision_tx(p_exam_id uuid,p_draft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_exam public.exams%ROWTYPE; v_revision_id uuid:=gen_random_uuid(); v_revision_no integer; v_missing integer; v_actor_role public.user_role;
BEGIN
  v_actor_role:=public.current_user_role();
  IF v_actor_role NOT IN ('super_admin','admin') THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR UPDATE;
  IF v_exam.active_draft_id IS NULL OR v_exam.active_draft_id<>p_draft_id THEN RAISE EXCEPTION 'STALE_EXAM_DRAFT'; END IF;
  PERFORM public.recalculate_exam_draft_core(p_exam_id);
  SELECT COUNT(*) INTO v_missing FROM public.student_enrollments se CROSS JOIN public.subjects sub CROSS JOIN public.assessment_components c
  LEFT JOIN public.mark_entries m ON m.exam_id=v_exam.id AND m.enrollment_id=se.id AND m.subject_id=sub.id AND m.component_id=c.id
  WHERE se.academic_year_id=v_exam.academic_year_id AND se.class_id=v_exam.class_id
    AND se.status IN ('active','promoted','retained','graduated') AND sub.class_id=v_exam.class_id
    AND c.config_id=v_exam.config_id AND (c.term_id IS NULL OR c.term_id=v_exam.term_id)
    AND c.is_mandatory AND (m.id IS NULL OR m.status='MISSING');
  IF v_missing>0 THEN RAISE EXCEPTION 'MISSING_MANDATORY_MARKS: %',v_missing; END IF;
  SELECT COALESCE(MAX(revision_number),0)+1 INTO v_revision_no FROM public.exam_result_revisions WHERE exam_id=v_exam.id;
  INSERT INTO public.exam_result_revisions(id,exam_id,revision_number,source_draft_id,correction_reason,published_by,published_at,exam_snapshot)
  SELECT v_revision_id,v_exam.id,v_revision_no,p_draft_id,COALESCE(NULLIF(v_exam.draft_reason,''),'Initial publication'),auth.uid(),now(),
    jsonb_build_object('exam_id',v_exam.id,'name',v_exam.name,'academic_year_id',v_exam.academic_year_id,'class_id',v_exam.class_id,
      'config_id',v_exam.config_id,'term_id',v_exam.term_id,'revision_number',v_revision_no)
  ;
  INSERT INTO public.exam_result_revision_students(revision_id,exam_id,enrollment_id,student_id,report_snapshot)
  SELECT v_revision_id,v_exam.id,s.enrollment_id,s.student_id,
    public.build_result_revision_student_snapshot(v_exam.id,s.enrollment_id,v_revision_id)
  FROM public.exam_student_summaries s WHERE s.exam_id=v_exam.id;
  UPDATE public.exams SET current_revision_id=v_revision_id,is_published=true,published_at=now(),published_by=auth.uid(),
    active_draft_id=NULL,draft_reason=NULL,updated_at=now() WHERE id=v_exam.id;
  INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,after_state)
  VALUES(auth.uid(),v_actor_role,'EXAM_REVISION_PUBLISHED','exam_result_revisions',v_revision_id::text,
    jsonb_build_object('exam_id',v_exam.id,'revision_number',v_revision_no));
  RETURN jsonb_build_object('revision_id',v_revision_id,'revision_number',v_revision_no);
END;
$$;

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
    COALESCE(x->'skill_ratings','{}'::jsonb),x,now()
  FROM public.exam_result_revision_students rs CROSS JOIN LATERAL (SELECT rs.report_snapshot->'summary' x) q
  WHERE rs.revision_id=p_revision_id;
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
  UPDATE public.exams SET active_draft_id=v_draft,draft_reason=trim(p_reason),updated_at=now() WHERE id=p_exam_id;
  PERFORM public.restore_exam_working_copy_from_revision(p_exam_id,v_exam.current_revision_id);
  RETURN v_draft;
END; $$;

CREATE OR REPLACE FUNCTION public.discard_exam_correction_tx(p_exam_id uuid,p_draft_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_exam public.exams%ROWTYPE;
BEGIN
  IF NOT public.is_admin_or_super() THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id FOR UPDATE;
  IF v_exam.active_draft_id IS NULL OR v_exam.active_draft_id<>p_draft_id OR v_exam.current_revision_id IS NULL THEN RAISE EXCEPTION 'STALE_EXAM_DRAFT'; END IF;
  PERFORM public.restore_exam_working_copy_from_revision(p_exam_id,v_exam.current_revision_id);
  UPDATE public.exams SET active_draft_id=NULL,draft_reason=NULL,updated_at=now() WHERE id=p_exam_id;
END; $$;

-- Legacy adapter: recalculation remains available for open drafts, unpublishing is permanently rejected.
CREATE OR REPLACE FUNCTION public.recalculate_and_publish_exam_tx(p_exam_id uuid,p_publish boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_exam public.exams%ROWTYPE;
BEGIN
  IF public.current_user_role() NOT IN ('super_admin','admin','teacher') THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  SELECT * INTO v_exam FROM public.exams WHERE id=p_exam_id;
  IF p_publish=false THEN RAISE EXCEPTION 'LEGACY_UNPUBLISH_DISABLED'; END IF;
  IF p_publish=true THEN RETURN public.publish_exam_revision_tx(p_exam_id,v_exam.active_draft_id); END IF;
  RETURN public.recalculate_exam_draft_core(p_exam_id);
END; $$;

-- Import every existing published exam as revision 1 without recalculating it.
DO $$ DECLARE v_exam record; v_revision_id uuid; v_draft uuid; BEGIN
  FOR v_exam IN SELECT * FROM public.exams WHERE is_published AND current_revision_id IS NULL LOOP
    v_revision_id:=gen_random_uuid(); v_draft:=gen_random_uuid();
    INSERT INTO public.exam_result_revisions(id,exam_id,revision_number,source_draft_id,correction_reason,is_legacy_import,published_by,published_at,exam_snapshot)
    VALUES(v_revision_id,v_exam.id,1,v_draft,'Legacy published result imported during revision migration',true,v_exam.published_by,
      COALESCE(v_exam.published_at,v_exam.updated_at,now()),
      COALESCE(v_exam.config_snapshot,'{}'::jsonb)||jsonb_build_object('exam_id',v_exam.id,'name',v_exam.name,'revision_number',1));
    INSERT INTO public.exam_result_revision_students(revision_id,exam_id,enrollment_id,student_id,report_snapshot)
    SELECT v_revision_id,v_exam.id,s.enrollment_id,s.student_id,public.build_result_revision_student_snapshot(v_exam.id,s.enrollment_id,v_revision_id)
    FROM public.exam_student_summaries s WHERE s.exam_id=v_exam.id;
    UPDATE public.exams SET current_revision_id=v_revision_id,active_draft_id=NULL,draft_reason=NULL WHERE id=v_exam.id;
  END LOOP;
END $$;

ALTER TABLE public.exam_result_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_result_revision_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "result_revisions_select_authorized" ON public.exam_result_revisions FOR SELECT TO authenticated USING (
  public.is_admin_or_super() OR public.current_user_role()='teacher' OR EXISTS(
    SELECT 1 FROM public.exam_result_revision_students rs
    WHERE rs.revision_id=id AND public.can_view_student_exam_result(rs.student_id,exam_id)
  )
);
CREATE POLICY "result_revision_students_select_authorized" ON public.exam_result_revision_students FOR SELECT TO authenticated USING (
  public.can_view_student_exam_result(student_id,exam_id)
);

REVOKE ALL ON public.exam_result_revisions,public.exam_result_revision_students FROM anon;
GRANT SELECT ON public.exam_result_revisions,public.exam_result_revision_students TO authenticated;
REVOKE ALL ON FUNCTION public.build_result_revision_student_snapshot(uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_exam_draft_core(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_exam_working_copy_from_revision(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_exam_marks_draft_tx(uuid,uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_exam_revision_tx(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_exam_correction_tx(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.discard_exam_correction_tx(uuid,uuid) TO authenticated;

COMMIT;
