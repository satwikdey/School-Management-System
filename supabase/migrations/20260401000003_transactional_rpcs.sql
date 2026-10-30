-- =============================================================================
-- School Management System v2 — Transactional RPCs & Domain Triggers
-- Payments, Promotions, Result Publication, Book Circulation, PINs, Timetables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TIMETABLE CONFLICT VALIDATION TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_timetable_teacher_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_academic_year_id uuid;
  v_start_time time;
  v_end_time time;
  v_conflict_class text;
BEGIN
  IF NEW.teacher_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tt.academic_year_id INTO v_academic_year_id
  FROM public.timetables tt
  WHERE tt.id = NEW.timetable_id;

  SELECT ts.start_time, ts.end_time INTO v_start_time, v_end_time
  FROM public.time_slots ts
  WHERE ts.id = NEW.time_slot_id;

  -- Check if the same teacher is already scheduled in an overlapping time slot
  -- on the same day_of_week or exam_date in the same academic year
  SELECT sc.name || COALESCE(' (' || sec.name || ')', '')
  INTO v_conflict_class
  FROM public.timetable_entries te
  JOIN public.timetables tt ON tt.id = te.timetable_id
  JOIN public.time_slots ts ON ts.id = te.time_slot_id
  JOIN public.school_classes sc ON sc.id = tt.class_id
  LEFT JOIN public.sections sec ON sec.id = tt.section_id
  WHERE te.id IS DISTINCT FROM NEW.id
    AND te.teacher_id = NEW.teacher_id
    AND tt.academic_year_id = v_academic_year_id
    AND tt.is_active = true
    AND (
      (NEW.day_of_week IS NOT NULL AND te.day_of_week = NEW.day_of_week)
      OR (NEW.exam_date IS NOT NULL AND te.exam_date = NEW.exam_date)
    )
    AND ts.start_time < v_end_time
    AND ts.end_time > v_start_time
  LIMIT 1;

  IF v_conflict_class IS NOT NULL THEN
    RAISE EXCEPTION 'TIMETABLE_TEACHER_CONFLICT: Teacher is already scheduled for % during an overlapping time slot.', v_conflict_class;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_timetable_teacher_conflict ON public.timetable_entries;
CREATE TRIGGER trg_check_timetable_teacher_conflict
  BEFORE INSERT OR UPDATE ON public.timetable_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_timetable_teacher_conflict();

-- -----------------------------------------------------------------------------
-- 2. TRANSACTIONAL FEE PAYMENT & REVERSAL RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_fee_payment_tx(
  p_invoice_id uuid,
  p_amount numeric(12,2),
  p_payment_method public.payment_method,
  p_idempotency_key text,
  p_reference_no text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.user_role;
  v_invoice public.student_invoices%ROWTYPE;
  v_new_paid numeric(12,2);
  v_new_balance numeric(12,2);
  v_new_status public.invoice_status;
  v_tx_id uuid;
  v_receipt_id uuid;
  v_receipt_no text;
  v_seq bigint;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.current_user_role();

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('super_admin', 'admin', 'accountant') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only accountant, admin, or super_admin can record fee payments.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Payment amount must be greater than zero.';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY: Idempotency key is required.';
  END IF;

  -- Lock the invoice row first so concurrent requests for the same invoice serialize cleanly
  SELECT * INTO v_invoice
  FROM public.student_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND: Student invoice % does not exist.', p_invoice_id;
  END IF;

  -- Check duplicate submission via idempotency key
  IF EXISTS (
    SELECT 1 FROM public.payment_transactions
    WHERE idempotency_key = trim(p_idempotency_key)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_PAYMENT_SUBMISSION: A payment with idempotency key % has already been processed.', p_idempotency_key;
  END IF;

  IF v_invoice.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'INVOICE_CANCELLED: Cannot record payment against a cancelled invoice.';
  END IF;

  IF v_invoice.balance <= 0 OR v_invoice.status = 'PAID' THEN
    RAISE EXCEPTION 'INVOICE_ALREADY_PAID: This invoice has already been paid in full.';
  END IF;

  IF p_amount > v_invoice.balance THEN
    RAISE EXCEPTION 'OVERPAYMENT_NOT_ALLOWED: Payment amount (%) exceeds remaining balance (%).', p_amount, v_invoice.balance;
  END IF;

  v_new_paid := ROUND(v_invoice.amount_paid + p_amount, 2);
  v_new_balance := ROUND(v_invoice.net_amount - v_new_paid, 2);
  v_new_status := CASE WHEN v_new_balance = 0 THEN 'PAID'::public.invoice_status ELSE 'PARTIAL'::public.invoice_status END;

  UPDATE public.student_invoices
  SET
    amount_paid = v_new_paid,
    balance = v_new_balance,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.payment_transactions (
    invoice_id,
    student_id,
    academic_year_id,
    amount,
    payment_method,
    reference_no,
    idempotency_key,
    notes,
    recorded_by,
    balance_after
  ) VALUES (
    v_invoice.id,
    v_invoice.student_id,
    v_invoice.academic_year_id,
    p_amount,
    p_payment_method,
    NULLIF(trim(p_reference_no), ''),
    trim(p_idempotency_key),
    NULLIF(trim(p_notes), ''),
    v_actor_id,
    v_new_balance
  ) RETURNING id INTO v_tx_id;

  v_seq := nextval('public.receipt_number_seq');
  v_receipt_no := 'RCP-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.payment_receipts (
    receipt_no,
    transaction_id,
    invoice_id,
    student_id,
    academic_year_id,
    amount_paid,
    balance_remaining,
    payment_method,
    reference_no,
    issued_by
  ) VALUES (
    v_receipt_no,
    v_tx_id,
    v_invoice.id,
    v_invoice.student_id,
    v_invoice.academic_year_id,
    p_amount,
    v_new_balance,
    p_payment_method,
    NULLIF(trim(p_reference_no), ''),
    v_actor_id
  ) RETURNING id INTO v_receipt_id;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    reason
  ) VALUES (
    v_actor_id,
    v_actor_role,
    'FEE_PAYMENT_RECORDED',
    'student_invoices',
    v_invoice.id::text,
    jsonb_build_object('amount_paid', v_invoice.amount_paid, 'balance', v_invoice.balance, 'status', v_invoice.status),
    jsonb_build_object('amount_paid', v_new_paid, 'balance', v_new_balance, 'status', v_new_status, 'receipt_no', v_receipt_no, 'method', p_payment_method),
    p_notes
  );

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'receipt_id', v_receipt_id,
    'receipt_no', v_receipt_no,
    'amount_paid', p_amount,
    'total_paid', v_new_paid,
    'balance_remaining', v_new_balance,
    'invoice_status', v_new_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_fee_payment_tx(
  p_transaction_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.user_role;
  v_tx public.payment_transactions%ROWTYPE;
  v_invoice public.student_invoices%ROWTYPE;
  v_new_paid numeric(12,2);
  v_new_balance numeric(12,2);
  v_new_status public.invoice_status;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.current_user_role();

  IF v_actor_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only super_admin can reverse recorded payments.';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'REVERSAL_REASON_REQUIRED: Please provide a valid reason for reversing the payment.';
  END IF;

  SELECT * INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_FOUND: Payment transaction % does not exist.', p_transaction_id;
  END IF;

  IF v_tx.is_reversed THEN
    RAISE EXCEPTION 'PAYMENT_ALREADY_REVERSED: This payment transaction has already been reversed.';
  END IF;

  SELECT * INTO v_invoice
  FROM public.student_invoices
  WHERE id = v_tx.invoice_id
  FOR UPDATE;

  v_new_paid := GREATEST(0.00, ROUND(v_invoice.amount_paid - v_tx.amount, 2));
  v_new_balance := ROUND(v_invoice.net_amount - v_new_paid, 2);
  v_new_status := CASE
    WHEN v_new_paid = 0 THEN 'UNPAID'::public.invoice_status
    WHEN v_new_balance = 0 THEN 'PAID'::public.invoice_status
    ELSE 'PARTIAL'::public.invoice_status
  END;

  UPDATE public.payment_transactions
  SET
    is_reversed = true,
    reversed_by = v_actor_id,
    reversed_at = now(),
    reversal_reason = trim(p_reason)
  WHERE id = p_transaction_id;

  UPDATE public.payment_receipts
  SET
    is_void = true,
    voided_at = now(),
    void_reason = trim(p_reason)
  WHERE transaction_id = p_transaction_id;

  UPDATE public.student_invoices
  SET
    amount_paid = v_new_paid,
    balance = v_new_balance,
    status = v_new_status,
    updated_at = now()
  WHERE id = v_invoice.id;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    reason
  ) VALUES (
    v_actor_id,
    v_actor_role,
    'FEE_PAYMENT_REVERSED',
    'payment_transactions',
    p_transaction_id::text,
    jsonb_build_object('invoice_id', v_invoice.id, 'amount_paid', v_invoice.amount_paid, 'balance', v_invoice.balance),
    jsonb_build_object('invoice_id', v_invoice.id, 'amount_paid', v_new_paid, 'balance', v_new_balance, 'reversed_amount', v_tx.amount),
    trim(p_reason)
  );

  RETURN jsonb_build_object(
    'transaction_id', p_transaction_id,
    'invoice_id', v_invoice.id,
    'amount_reversed', v_tx.amount,
    'new_amount_paid', v_new_paid,
    'new_balance', v_new_balance,
    'invoice_status', v_new_status
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. TRANSACTIONAL EXAM RECALCULATION & PUBLICATION RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_and_publish_exam_tx(
  p_exam_id uuid,
  p_publish boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.user_role;
  v_exam public.exams%ROWTYPE;
  v_config public.assessment_configs%ROWTYPE;
  v_term public.assessment_terms%ROWTYPE;
  v_missing_count integer;
  v_total_max_per_subject numeric(8,2);
  v_subject_count integer;
  v_total_exam_max numeric(8,2);
  v_enroll record;
  v_obtained numeric(8,2);
  v_pct numeric(5,2);
  v_annual_pct numeric(5,2);
  v_grade record;
  v_subject_failed boolean;
  v_is_passed boolean;
  v_snapshot jsonb;
  v_new_published boolean;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.current_user_role();

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('super_admin', 'admin', 'teacher') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Insufficient permissions to recalculate exam results.';
  END IF;

  IF p_publish IS NOT NULL AND v_actor_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only administrators can publish or unpublish examination results.';
  END IF;

  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXAM_NOT_FOUND: Exam % does not exist.', p_exam_id;
  END IF;

  SELECT * INTO v_config FROM public.assessment_configs WHERE id = v_exam.config_id;
  SELECT * INTO v_term FROM public.assessment_terms WHERE id = v_exam.term_id;

  -- Calculate max marks per subject from components applicable to this term
  SELECT COALESCE(SUM(ac.max_marks), 0)
  INTO v_total_max_per_subject
  FROM public.assessment_components ac
  WHERE ac.config_id = v_exam.config_id
    AND (ac.term_id IS NULL OR ac.term_id = v_exam.term_id);

  SELECT COUNT(*)
  INTO v_subject_count
  FROM public.subjects s
  WHERE s.class_id = v_exam.class_id;

  v_total_exam_max := ROUND(v_total_max_per_subject * v_subject_count, 2);

  -- If publishing, ensure all mandatory components have non-MISSING entries for all active enrolled students
  IF p_publish = true THEN
    SELECT COUNT(*)
    INTO v_missing_count
    FROM public.student_enrollments se
    CROSS JOIN public.subjects sub
    CROSS JOIN public.assessment_components ac
    LEFT JOIN public.mark_entries me
      ON me.exam_id = v_exam.id
      AND me.enrollment_id = se.id
      AND me.subject_id = sub.id
      AND me.component_id = ac.id
    WHERE se.academic_year_id = v_exam.academic_year_id
      AND se.class_id = v_exam.class_id
      AND se.status IN ('active', 'promoted', 'retained', 'graduated')
      AND sub.class_id = v_exam.class_id
      AND ac.config_id = v_exam.config_id
      AND (ac.term_id IS NULL OR ac.term_id = v_exam.term_id)
      AND ac.is_mandatory = true
      AND (me.id IS NULL OR me.status = 'MISSING');

    IF v_missing_count > 0 THEN
      RAISE EXCEPTION 'MISSING_MANDATORY_MARKS: Cannot publish exam while % mandatory mark entries are still missing.', v_missing_count;
    END IF;
  END IF;

  -- Upsert summaries for each enrolled student
  FOR v_enroll IN
    SELECT se.id AS enrollment_id, se.student_id, se.section_id
    FROM public.student_enrollments se
    WHERE se.academic_year_id = v_exam.academic_year_id
      AND se.class_id = v_exam.class_id
      AND se.status IN ('active', 'promoted', 'retained', 'graduated')
  LOOP
    SELECT COALESCE(SUM(
      CASE
        WHEN me.status = 'PRESENT' THEN COALESCE(me.marks_obtained, 0)
        ELSE 0
      END
    ), 0)
    INTO v_obtained
    FROM public.mark_entries me
    JOIN public.assessment_components ac ON ac.id = me.component_id
    WHERE me.exam_id = v_exam.id
      AND me.enrollment_id = v_enroll.enrollment_id
      AND (ac.term_id IS NULL OR ac.term_id = v_exam.term_id);

    IF v_total_exam_max > 0 THEN
      v_pct := ROUND((v_obtained / v_total_exam_max) * 100.0, 2);
    ELSE
      v_pct := 0.00;
    END IF;

    -- Check if student failed any individual component/subject pass threshold
    SELECT EXISTS (
      SELECT 1
      FROM public.subjects sub
      LEFT JOIN (
        SELECT me.subject_id,
               SUM(CASE WHEN me.status = 'PRESENT' THEN COALESCE(me.marks_obtained, 0) ELSE 0 END) AS subj_obtained
        FROM public.mark_entries me
        WHERE me.exam_id = v_exam.id AND me.enrollment_id = v_enroll.enrollment_id
        GROUP BY me.subject_id
      ) sm ON sm.subject_id = sub.id
      WHERE sub.class_id = v_exam.class_id
        AND v_total_max_per_subject > 0
        AND ROUND((COALESCE(sm.subj_obtained, 0) / v_total_max_per_subject) * 100.0, 2) < v_config.pass_percentage
    ) INTO v_subject_failed;

    -- Match grade band
    SELECT gb.grade, gb.remark, gb.is_passing
    INTO v_grade
    FROM public.grade_bands gb
    WHERE gb.config_id = v_exam.config_id
      AND v_pct >= gb.min_percentage
      AND v_pct <= gb.max_percentage
    ORDER BY gb.min_percentage DESC
    LIMIT 1;

    v_is_passed := COALESCE(v_grade.is_passing, v_pct >= v_config.pass_percentage) AND NOT COALESCE(v_subject_failed, false);

    INSERT INTO public.exam_student_summaries (
      exam_id,
      enrollment_id,
      student_id,
      total_obtained,
      total_max,
      percentage,
      overall_grade,
      grade_remark,
      is_passed,
      updated_at
    ) VALUES (
      v_exam.id,
      v_enroll.enrollment_id,
      v_enroll.student_id,
      v_obtained,
      v_total_exam_max,
      v_pct,
      COALESCE(v_grade.grade, 'N/A'),
      COALESCE(v_grade.remark, ''),
      v_is_passed,
      now()
    )
    ON CONFLICT (exam_id, enrollment_id) DO UPDATE SET
      total_obtained = EXCLUDED.total_obtained,
      total_max = EXCLUDED.total_max,
      percentage = EXCLUDED.percentage,
      overall_grade = EXCLUDED.overall_grade,
      grade_remark = EXCLUDED.grade_remark,
      is_passed = EXCLUDED.is_passed,
      updated_at = now();
  END LOOP;

  -- Compute shared competition ranks (1, 1, 3 for ties) within section and across class
  WITH ranked AS (
    SELECT
      ess.id,
      RANK() OVER (PARTITION BY se.section_id ORDER BY ess.percentage DESC, ess.total_obtained DESC) AS sec_rk,
      RANK() OVER (ORDER BY ess.percentage DESC, ess.total_obtained DESC) AS cls_rk
    FROM public.exam_student_summaries ess
    JOIN public.student_enrollments se ON se.id = ess.enrollment_id
    WHERE ess.exam_id = v_exam.id
  )
  UPDATE public.exam_student_summaries ess
  SET
    section_rank = ranked.sec_rk,
    class_rank = ranked.cls_rk
  FROM ranked
  WHERE ess.id = ranked.id;

  -- Compute annual weighted percentage across terms for each enrollment in this class & year
  FOR v_enroll IN
    SELECT ess.id AS summary_id, ess.enrollment_id
    FROM public.exam_student_summaries ess
    WHERE ess.exam_id = v_exam.id
  LOOP
    SELECT
      CASE
        WHEN SUM(at2.weight_percent) > 0 THEN
          ROUND(SUM(ess2.percentage * at2.weight_percent) / SUM(at2.weight_percent), 2)
        ELSE NULL
      END
    INTO v_annual_pct
    FROM public.exam_student_summaries ess2
    JOIN public.exams e2 ON e2.id = ess2.exam_id
    JOIN public.assessment_terms at2 ON at2.id = e2.term_id
    WHERE ess2.enrollment_id = v_enroll.enrollment_id
      AND e2.academic_year_id = v_exam.academic_year_id
      AND e2.class_id = v_exam.class_id;

    UPDATE public.exam_student_summaries
    SET annual_weighted_percentage = v_annual_pct
    WHERE id = v_enroll.summary_id;
  END LOOP;

  -- Handle publication & immutable snapshots
  v_new_published := COALESCE(p_publish, v_exam.is_published);

  IF p_publish = true THEN
    -- Lock the assessment config so later edits must create a new version
    UPDATE public.assessment_configs
    SET is_locked = true, updated_at = now()
    WHERE id = v_exam.config_id;

    v_snapshot := jsonb_build_object(
      'config_id', v_config.id,
      'board_code', v_config.board_code,
      'custom_board_name', v_config.custom_board_name,
      'config_name', v_config.name,
      'version', v_config.version,
      'pass_percentage', v_config.pass_percentage,
      'term_code', v_term.code,
      'term_name', v_term.name,
      'term_weight_percent', v_term.weight_percent,
      'captured_at', now()
    );

    UPDATE public.exams
    SET
      is_published = true,
      published_at = now(),
      published_by = v_actor_id,
      config_snapshot = v_snapshot,
      updated_at = now()
    WHERE id = v_exam.id;

    -- Save immutable per-student snapshot on exam_student_summaries
    UPDATE public.exam_student_summaries ess
    SET published_snapshot = jsonb_build_object(
      'total_obtained', ess.total_obtained,
      'total_max', ess.total_max,
      'percentage', ess.percentage,
      'annual_weighted_percentage', ess.annual_weighted_percentage,
      'overall_grade', ess.overall_grade,
      'grade_remark', ess.grade_remark,
      'is_passed', ess.is_passed,
      'section_rank', ess.section_rank,
      'class_rank', ess.class_rank,
      'config', v_snapshot
    )
    WHERE ess.exam_id = v_exam.id;

    INSERT INTO public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, after_state
    ) VALUES (
      v_actor_id, v_actor_role, 'EXAM_PUBLISHED', 'exams', v_exam.id::text, v_snapshot
    );
  ELSIF p_publish = false THEN
    UPDATE public.exams
    SET is_published = false, updated_at = now()
    WHERE id = v_exam.id;

    INSERT INTO public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, after_state
    ) VALUES (
      v_actor_id, v_actor_role, 'EXAM_UNPUBLISHED', 'exams', v_exam.id::text, jsonb_build_object('is_published', false)
    );
  END IF;

  RETURN jsonb_build_object(
    'exam_id', v_exam.id,
    'is_published', v_new_published,
    'total_exam_max', v_total_exam_max
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. VERSIONED ASSESSMENT CONFIG CLONING RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clone_assessment_config_version_tx(
  p_config_id uuid,
  p_new_pass_percentage numeric(5,2) DEFAULT NULL,
  p_new_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.user_role;
  v_old public.assessment_configs%ROWTYPE;
  v_new_id uuid;
  v_term record;
  v_new_term_id uuid;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.current_user_role();

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only administrators can version assessment configurations.';
  END IF;

  SELECT * INTO v_old FROM public.assessment_configs WHERE id = p_config_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: Assessment configuration % not found.', p_config_id;
  END IF;

  UPDATE public.assessment_configs
  SET is_active = false, is_locked = true, updated_at = now()
  WHERE id = p_config_id;

  INSERT INTO public.assessment_configs (
    academic_year_id,
    class_id,
    board_code,
    custom_board_name,
    name,
    description,
    version,
    parent_config_id,
    pass_percentage,
    is_template,
    is_active,
    is_locked,
    skill_definitions,
    created_by
  ) VALUES (
    v_old.academic_year_id,
    v_old.class_id,
    v_old.board_code,
    v_old.custom_board_name,
    COALESCE(NULLIF(trim(p_new_name), ''), v_old.name),
    v_old.description,
    v_old.version + 1,
    v_old.id,
    COALESCE(p_new_pass_percentage, v_old.pass_percentage),
    v_old.is_template,
    true,
    false,
    v_old.skill_definitions,
    v_actor_id
  ) RETURNING id INTO v_new_id;

  -- Clone terms and map components
  FOR v_term IN
    SELECT * FROM public.assessment_terms WHERE config_id = v_old.id ORDER BY display_order
  LOOP
    INSERT INTO public.assessment_terms (
      config_id, code, name, semester_number, weight_percent, display_order
    ) VALUES (
      v_new_id, v_term.code, v_term.name, v_term.semester_number, v_term.weight_percent, v_term.display_order
    ) RETURNING id INTO v_new_term_id;

    INSERT INTO public.assessment_components (
      config_id, term_id, code, name, max_marks, pass_marks, is_mandatory, display_order
    )
    SELECT
      v_new_id, v_new_term_id, code, name, max_marks, pass_marks, is_mandatory, display_order
    FROM public.assessment_components
    WHERE config_id = v_old.id AND term_id = v_term.id;
  END LOOP;

  -- Clone shared components (term_id IS NULL)
  INSERT INTO public.assessment_components (
    config_id, term_id, code, name, max_marks, pass_marks, is_mandatory, display_order
  )
  SELECT
    v_new_id, NULL, code, name, max_marks, pass_marks, is_mandatory, display_order
  FROM public.assessment_components
  WHERE config_id = v_old.id AND term_id IS NULL;

  -- Clone grade bands
  INSERT INTO public.grade_bands (
    config_id, grade, min_percentage, max_percentage, grade_point, remark, is_passing, display_order
  )
  SELECT
    v_new_id, grade, min_percentage, max_percentage, grade_point, remark, is_passing, display_order
  FROM public.grade_bands
  WHERE config_id = v_old.id;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before_state, after_state
  ) VALUES (
    v_actor_id, v_actor_role, 'ASSESSMENT_CONFIG_VERSIONED', 'assessment_configs', v_new_id::text,
    jsonb_build_object('previous_config_id', v_old.id, 'previous_version', v_old.version),
    jsonb_build_object('new_config_id', v_new_id, 'new_version', v_old.version + 1)
  );

  RETURN v_new_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. TRANSACTIONAL STUDENT PROMOTION & REVERSAL RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_students_tx(
  p_from_academic_year_id uuid,
  p_to_academic_year_id uuid,
  p_from_class_id uuid,
  p_from_section_id uuid,
  p_to_class_id uuid,
  p_to_section_id uuid,
  p_decisions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.user_role;
  v_item jsonb;
  v_student_id uuid;
  v_action public.promotion_action;
  v_remarks text;
  v_from_enroll public.student_enrollments%ROWTYPE;
  v_new_enroll_id uuid;
  v_target_class_id uuid;
  v_target_section_id uuid;
  v_next_roll integer;
  v_processed_count integer := 0;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.current_user_role();

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only administrators can promote, retain, or graduate students.';
  END IF;

  IF p_from_academic_year_id = p_to_academic_year_id THEN
    RAISE EXCEPTION 'INVALID_ACADEMIC_YEAR: Target academic year must be different from source academic year.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_decisions)
  LOOP
    v_student_id := (v_item->>'student_id')::uuid;
    v_action := (v_item->>'action')::public.promotion_action;
    v_remarks := v_item->>'remarks';
    v_new_enroll_id := NULL;

    SELECT * INTO v_from_enroll
    FROM public.student_enrollments
    WHERE student_id = v_student_id
      AND academic_year_id = p_from_academic_year_id
      AND class_id = p_from_class_id
      AND section_id = p_from_section_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ENROLLMENT_NOT_FOUND: Student % is not enrolled in the specified source class/section.', v_student_id;
    END IF;

    IF v_action = 'PROMOTE' THEN
      v_target_class_id := p_to_class_id;
      v_target_section_id := p_to_section_id;

      SELECT COALESCE(MAX(roll_no), 0) + 1 INTO v_next_roll
      FROM public.student_enrollments
      WHERE academic_year_id = p_to_academic_year_id
        AND class_id = v_target_class_id
        AND section_id = v_target_section_id;

      UPDATE public.student_enrollments
      SET status = 'promoted', updated_at = now()
      WHERE id = v_from_enroll.id;

      INSERT INTO public.student_enrollments (
        student_id, academic_year_id, class_id, section_id, roll_no, status, promoted_from_enrollment_id
      ) VALUES (
        v_student_id, p_to_academic_year_id, v_target_class_id, v_target_section_id, v_next_roll, 'active', v_from_enroll.id
      ) RETURNING id INTO v_new_enroll_id;

    ELSIF v_action = 'RETAIN' THEN
      v_target_class_id := p_from_class_id;
      v_target_section_id := p_from_section_id;

      SELECT COALESCE(MAX(roll_no), 0) + 1 INTO v_next_roll
      FROM public.student_enrollments
      WHERE academic_year_id = p_to_academic_year_id
        AND class_id = v_target_class_id
        AND section_id = v_target_section_id;

      UPDATE public.student_enrollments
      SET status = 'retained', updated_at = now()
      WHERE id = v_from_enroll.id;

      INSERT INTO public.student_enrollments (
        student_id, academic_year_id, class_id, section_id, roll_no, status, promoted_from_enrollment_id
      ) VALUES (
        v_student_id, p_to_academic_year_id, v_target_class_id, v_target_section_id, v_next_roll, 'active', v_from_enroll.id
      ) RETURNING id INTO v_new_enroll_id;

    ELSIF v_action = 'GRADUATE' THEN
      v_target_class_id := p_from_class_id;
      v_target_section_id := p_from_section_id;

      UPDATE public.student_enrollments
      SET status = 'graduated', updated_at = now()
      WHERE id = v_from_enroll.id;

      UPDATE public.students
      SET
        is_graduated = true,
        graduated_academic_year_id = p_from_academic_year_id,
        graduated_at = now(),
        updated_at = now()
      WHERE id = v_student_id;
    END IF;

    INSERT INTO public.promotion_records (
      student_id,
      from_enrollment_id,
      to_enrollment_id,
      from_academic_year_id,
      to_academic_year_id,
      from_class_id,
      from_section_id,
      to_class_id,
      to_section_id,
      action,
      remarks,
      promoted_by
    ) VALUES (
      v_student_id,
      v_from_enroll.id,
      v_new_enroll_id,
      p_from_academic_year_id,
      p_to_academic_year_id,
      p_from_class_id,
      p_from_section_id,
      v_target_class_id,
      v_target_section_id,
      v_action,
      v_remarks,
      v_actor_id
    );

    v_processed_count := v_processed_count + 1;
  END LOOP;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, after_state
  ) VALUES (
    v_actor_id, v_actor_role, 'STUDENT_PROMOTION_BATCH', 'promotion_records', p_from_class_id::text,
    jsonb_build_object('processed_count', v_processed_count, 'from_year', p_from_academic_year_id, 'to_year', p_to_academic_year_id)
  );

  RETURN jsonb_build_object('processed_count', v_processed_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_promotion_tx(
  p_promotion_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.user_role;
  v_prom public.promotion_records%ROWTYPE;
  v_has_marks boolean;
  v_has_payments boolean;
  v_has_later_promotions boolean;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.current_user_role();

  IF v_actor_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only super_admin can reverse student promotions.';
  END IF;

  SELECT * INTO v_prom
  FROM public.promotion_records
  WHERE id = p_promotion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROMOTION_NOT_FOUND: Promotion record % does not exist.', p_promotion_id;
  END IF;

  IF v_prom.is_reversed THEN
    RAISE EXCEPTION 'PROMOTION_ALREADY_REVERSED: This promotion has already been reversed.';
  END IF;

  -- Check if target enrollment has dependent records that would be invalidated
  IF v_prom.to_enrollment_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.mark_entries
      WHERE enrollment_id = v_prom.to_enrollment_id
        AND status IN ('PRESENT', 'ABSENT')
    ) INTO v_has_marks;

    IF v_has_marks THEN
      RAISE EXCEPTION 'PROMOTION_REVERSAL_BLOCKED: Cannot reverse promotion because examination marks have already been recorded in the subsequent enrollment.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.student_invoices
      WHERE enrollment_id = v_prom.to_enrollment_id
        AND amount_paid > 0
    ) INTO v_has_payments;

    IF v_has_payments THEN
      RAISE EXCEPTION 'PROMOTION_REVERSAL_BLOCKED: Cannot reverse promotion because fee payments have already been recorded in the subsequent enrollment.';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.promotion_records
      WHERE from_enrollment_id = v_prom.to_enrollment_id
        AND is_reversed = false
    ) INTO v_has_later_promotions;

    IF v_has_later_promotions THEN
      RAISE EXCEPTION 'PROMOTION_REVERSAL_BLOCKED: Cannot reverse promotion because a subsequent promotion record exists for this student.';
    END IF;

    -- Delete unpaid invoices and target enrollment
    DELETE FROM public.student_invoices WHERE enrollment_id = v_prom.to_enrollment_id AND amount_paid = 0;
    DELETE FROM public.student_enrollments WHERE id = v_prom.to_enrollment_id;
  END IF;

  -- Restore source enrollment status
  UPDATE public.student_enrollments
  SET status = 'active', updated_at = now()
  WHERE id = v_prom.from_enrollment_id;

  IF v_prom.action = 'GRADUATE' THEN
    UPDATE public.students
    SET
      is_graduated = false,
      graduated_academic_year_id = NULL,
      graduated_at = NULL,
      updated_at = now()
    WHERE id = v_prom.student_id;
  END IF;

  UPDATE public.promotion_records
  SET
    is_reversed = true,
    to_enrollment_id = NULL,
    reversed_by = v_actor_id,
    reversed_at = now(),
    reversal_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Administrative reversal')
  WHERE id = p_promotion_id;

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, reason
  ) VALUES (
    v_actor_id, v_actor_role, 'PROMOTION_REVERSED', 'promotion_records', p_promotion_id::text, p_reason
  );

  RETURN jsonb_build_object('promotion_id', p_promotion_id, 'status', 'reversed');
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. TRANSACTIONAL LIBRARY BOOK CIRCULATION RPCs (CONCURRENCY-SAFE)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recount_book_copies(p_book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_avail integer;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status <> 'LOST'),
    COUNT(*) FILTER (WHERE status = 'AVAILABLE')
  INTO v_total, v_avail
  FROM public.library_book_copies
  WHERE book_id = p_book_id;

  UPDATE public.library_books
  SET
    total_copies = COALESCE(v_total, 0),
    available_copies = COALESCE(v_avail, 0),
    updated_at = now()
  WHERE id = p_book_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_book_copy_tx(
  p_copy_id uuid,
  p_borrower_id uuid,
  p_request_id uuid DEFAULT NULL,
  p_loan_days integer DEFAULT NULL,
  p_remarks text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.user_role;
  v_copy public.library_book_copies%ROWTYPE;
  v_loan_days integer;
  v_due_date date;
  v_loan_id uuid;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.current_user_role();

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('super_admin', 'admin', 'librarian') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only librarian, admin, or super_admin can issue library books.';
  END IF;

  -- Lock the specific physical copy row so competing concurrent checkouts serialize!
  SELECT * INTO v_copy
  FROM public.library_book_copies
  WHERE id = p_copy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOK_COPY_NOT_FOUND: Book copy % does not exist.', p_copy_id;
  END IF;

  IF v_copy.status <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'BOOK_COPY_UNAVAILABLE: Book copy % (%) is currently % and cannot be checked out.',
      v_copy.accession_no, v_copy.id, v_copy.status;
  END IF;

  SELECT COALESCE(p_loan_days, default_loan_days, 14)
  INTO v_loan_days
  FROM public.school_settings
  LIMIT 1;

  v_loan_days := COALESCE(v_loan_days, 14);
  v_due_date := CURRENT_DATE + v_loan_days;

  UPDATE public.library_book_copies
  SET status = 'ISSUED', updated_at = now()
  WHERE id = p_copy_id;

  INSERT INTO public.library_loans (
    copy_id,
    book_id,
    borrower_id,
    request_id,
    issued_by,
    issued_at,
    due_date,
    status,
    remarks
  ) VALUES (
    v_copy.id,
    v_copy.book_id,
    p_borrower_id,
    p_request_id,
    v_actor_id,
    now(),
    v_due_date,
    'ISSUED',
    p_remarks
  ) RETURNING id INTO v_loan_id;

  IF p_request_id IS NOT NULL THEN
    UPDATE public.library_borrow_requests
    SET
      status = 'FULFILLED',
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      updated_at = now()
    WHERE id = p_request_id;
  END IF;

  PERFORM public.recount_book_copies(v_copy.book_id);

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, after_state
  ) VALUES (
    v_actor_id, v_actor_role, 'LIBRARY_BOOK_ISSUED', 'library_loans', v_loan_id::text,
    jsonb_build_object('copy_id', v_copy.id, 'accession_no', v_copy.accession_no, 'borrower_id', p_borrower_id, 'due_date', v_due_date)
  );

  RETURN jsonb_build_object(
    'loan_id', v_loan_id,
    'copy_id', v_copy.id,
    'accession_no', v_copy.accession_no,
    'due_date', v_due_date
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.return_book_copy_tx(
  p_loan_id uuid,
  p_return_condition text DEFAULT 'Good',
  p_remarks text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role public.user_role;
  v_loan public.library_loans%ROWTYPE;
BEGIN
  v_actor_id := auth.uid();
  v_actor_role := public.current_user_role();

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('super_admin', 'admin', 'librarian') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Only librarian, admin, or super_admin can record book returns.';
  END IF;

  SELECT * INTO v_loan
  FROM public.library_loans
  WHERE id = p_loan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOAN_NOT_FOUND: Library loan % does not exist.', p_loan_id;
  END IF;

  IF v_loan.returned_at IS NOT NULL THEN
    RAISE EXCEPTION 'LOAN_ALREADY_RETURNED: This book copy has already been returned.';
  END IF;

  UPDATE public.library_loans
  SET
    returned_at = now(),
    returned_to = v_actor_id,
    return_condition = COALESCE(p_return_condition, 'Good'),
    status = 'RETURNED',
    remarks = COALESCE(p_remarks, remarks)
  WHERE id = p_loan_id;

  UPDATE public.library_book_copies
  SET
    status = 'AVAILABLE',
    condition = CASE
      WHEN p_return_condition IN ('New', 'Good', 'Fair', 'Damaged') THEN p_return_condition
      ELSE condition
    END,
    updated_at = now()
  WHERE id = v_loan.copy_id;

  PERFORM public.recount_book_copies(v_loan.book_id);

  INSERT INTO public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, after_state
  ) VALUES (
    v_actor_id, v_actor_role, 'LIBRARY_BOOK_RETURNED', 'library_loans', p_loan_id::text,
    jsonb_build_object('copy_id', v_loan.copy_id, 'returned_at', now(), 'condition', p_return_condition)
  );

  RETURN jsonb_build_object(
    'loan_id', p_loan_id,
    'copy_id', v_loan.copy_id,
    'status', 'RETURNED'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RESULT PIN VERIFICATION RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_result_pin_tx(
  p_pin_code text,
  p_student_id uuid,
  p_academic_year_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_pin public.result_pins%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be signed in to verify a Result PIN.';
  END IF;

  SELECT * INTO v_pin
  FROM public.result_pins
  WHERE upper(trim(pin_code)) = upper(trim(p_pin_code))
    AND academic_year_id = p_academic_year_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_RESULT_PIN: The Result PIN entered is invalid for this academic year.';
  END IF;

  IF v_pin.expires_at IS NOT NULL AND v_pin.expires_at < now() THEN
    RAISE EXCEPTION 'EXPIRED_RESULT_PIN: This Result PIN has expired.';
  END IF;

  IF v_pin.student_id IS NOT NULL AND v_pin.student_id <> p_student_id THEN
    RAISE EXCEPTION 'PIN_BOUND_TO_ANOTHER_STUDENT: This Result PIN has already been used for another student.';
  END IF;

  IF v_pin.times_used >= v_pin.max_uses THEN
    RAISE EXCEPTION 'PIN_USAGE_LIMIT_EXCEEDED: This Result PIN has reached its maximum usage limit (%).', v_pin.max_uses;
  END IF;

  UPDATE public.result_pins
  SET
    student_id = p_student_id,
    used_by_user_id = v_user_id,
    times_used = times_used + 1
  WHERE id = v_pin.id;

  INSERT INTO public.result_pin_verifications (
    user_id, student_id, academic_year_id, pin_id, verified_at
  ) VALUES (
    v_user_id, p_student_id, p_academic_year_id, v_pin.id, now()
  )
  ON CONFLICT (user_id, student_id, academic_year_id) DO UPDATE SET
    pin_id = EXCLUDED.pin_id,
    verified_at = now();

  RETURN jsonb_build_object(
    'verified', true,
    'student_id', p_student_id,
    'academic_year_id', p_academic_year_id,
    'times_used', v_pin.times_used + 1,
    'max_uses', v_pin.max_uses
  );
END;
$$;
