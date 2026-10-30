-- =============================================================================
-- School Management System v2 — Row-Level Security (RLS) & Storage Policies
-- Enforces strict role-based access control at the PostgreSQL & Storage layer
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SECURITY HELPER FUNCTIONS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'super_admin', false);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() IN ('super_admin', 'admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_accountant_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() IN ('super_admin', 'admin', 'accountant'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_librarian_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() IN ('super_admin', 'admin', 'librarian'), false);
$$;

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.students WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parent_student_links psl
    WHERE psl.parent_id = auth.uid()
      AND psl.student_id = p_student_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin_or_super()
    OR public.current_user_role() IN ('teacher', 'accountant', 'librarian')
    OR public.current_student_id() = p_student_id
    OR public.is_parent_of_student(p_student_id);
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_for_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin_or_super()
    OR (
      public.current_user_role() = 'teacher'
      AND (
        EXISTS (
          SELECT 1 FROM public.teacher_assignments ta
          WHERE ta.teacher_id = auth.uid() AND ta.class_id = p_class_id
        )
        OR EXISTS (
          SELECT 1 FROM public.sections sec
          WHERE sec.class_teacher_id = auth.uid() AND sec.class_id = p_class_id
        )
        OR EXISTS (
          SELECT 1 FROM public.subjects sub
          WHERE sub.teacher_id = auth.uid() AND sub.class_id = p_class_id
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_for_subject(p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin_or_super()
    OR (
      public.current_user_role() = 'teacher'
      AND (
        EXISTS (
          SELECT 1 FROM public.teacher_assignments ta
          WHERE ta.teacher_id = auth.uid() AND ta.subject_id = p_subject_id
        )
        OR EXISTS (
          SELECT 1 FROM public.subjects sub
          WHERE sub.id = p_subject_id AND sub.teacher_id = auth.uid()
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.user_relevant_class_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_classes uuid[];
BEGIN
  v_role := public.current_user_role();
  IF v_role IN ('super_admin', 'admin', 'accountant', 'librarian') THEN
    SELECT COALESCE(array_agg(id), '{}') INTO v_classes FROM public.school_classes;
    RETURN v_classes;
  ELSIF v_role = 'teacher' THEN
    SELECT COALESCE(array_agg(DISTINCT class_id), '{}') INTO v_classes
    FROM (
      SELECT class_id FROM public.teacher_assignments WHERE teacher_id = auth.uid()
      UNION
      SELECT class_id FROM public.sections WHERE class_teacher_id = auth.uid()
      UNION
      SELECT class_id FROM public.subjects WHERE teacher_id = auth.uid()
    ) t;
    RETURN v_classes;
  ELSIF v_role = 'student' THEN
    SELECT COALESCE(array_agg(DISTINCT se.class_id), '{}') INTO v_classes
    FROM public.student_enrollments se
    JOIN public.students s ON s.id = se.student_id
    WHERE s.user_id = auth.uid();
    RETURN v_classes;
  ELSIF v_role = 'parent' THEN
    SELECT COALESCE(array_agg(DISTINCT se.class_id), '{}') INTO v_classes
    FROM public.student_enrollments se
    JOIN public.parent_student_links psl ON psl.student_id = se.student_id
    WHERE psl.parent_id = auth.uid();
    RETURN v_classes;
  END IF;
  RETURN '{}';
END;
$$;

-- Enforce both exam publication AND optional Result PIN at data-access layer
CREATE OR REPLACE FUNCTION public.can_view_student_exam_result(
  p_student_id uuid,
  p_exam_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_is_published boolean;
  v_academic_year_id uuid;
  v_class_id uuid;
  v_require_pin boolean;
  v_pin_verified boolean;
BEGIN
  v_role := public.current_user_role();
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role IN ('super_admin', 'admin') THEN
    RETURN true;
  END IF;

  SELECT e.is_published, e.academic_year_id, e.class_id
  INTO v_is_published, v_academic_year_id, v_class_id
  FROM public.exams e
  WHERE e.id = p_exam_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_role = 'teacher' THEN
    RETURN public.is_teacher_for_class(v_class_id);
  END IF;

  -- For student and parent: exam MUST be published
  IF NOT COALESCE(v_is_published, false) THEN
    RETURN false;
  END IF;

  IF v_role = 'student' AND public.current_student_id() <> p_student_id THEN
    RETURN false;
  END IF;

  IF v_role = 'parent' AND NOT public.is_parent_of_student(p_student_id) THEN
    RETURN false;
  END IF;

  IF v_role NOT IN ('student', 'parent') THEN
    RETURN false;
  END IF;

  -- Check if Result PIN is required by school settings
  SELECT COALESCE(require_result_pin, false)
  INTO v_require_pin
  FROM public.school_settings
  LIMIT 1;

  IF COALESCE(v_require_pin, false) THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.result_pin_verifications rpv
      WHERE rpv.user_id = auth.uid()
        AND rpv.student_id = p_student_id
        AND rpv.academic_year_id = v_academic_year_id
    ) INTO v_pin_verified;

    RETURN COALESCE(v_pin_verified, false);
  END IF;

  RETURN true;
END;
$$;

-- Resolve username or email for login
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT p.email INTO v_email
  FROM public.profiles p
  WHERE (lower(p.username) = lower(trim(p_identifier)) OR lower(p.email) = lower(trim(p_identifier)))
    AND p.is_active = true
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- -----------------------------------------------------------------------------
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mark_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_student_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_pin_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_borrow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. RLS POLICIES BY DOMAIN
-- -----------------------------------------------------------------------------

-- Academic Years & School Settings
CREATE POLICY "academic_years_select_authenticated"
  ON public.academic_years FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "academic_years_write_admin"
  ON public.academic_years FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "school_settings_select_authenticated"
  ON public.school_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "school_settings_write_super_admin"
  ON public.school_settings FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Profiles
CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin_or_super()
    OR public.current_user_role() IN ('teacher', 'accountant', 'librarian')
    OR role IN ('teacher', 'admin', 'super_admin', 'librarian', 'accountant')
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = profiles.id AND public.is_parent_of_student(s.id)
    )
  );

CREATE POLICY "profiles_update_self_basic"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.current_user_role()
  );

CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (public.current_user_role() = 'admin' AND role NOT IN ('super_admin', 'admin'))
  );

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (public.current_user_role() = 'admin' AND role NOT IN ('super_admin', 'admin'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.current_user_role() = 'admin' AND role NOT IN ('super_admin', 'admin'))
  );

CREATE POLICY "profiles_delete_super_admin"
  ON public.profiles FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Staff Records & Hostels
CREATE POLICY "staff_records_select"
  ON public.staff_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super() OR public.current_user_role() IN ('teacher', 'accountant', 'librarian'));

CREATE POLICY "staff_records_write_admin"
  ON public.staff_records FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "hostels_select"
  ON public.hostels FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "hostels_write_admin"
  ON public.hostels FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- Classes, Sections, Subjects, Teacher Assignments
CREATE POLICY "school_classes_select"
  ON public.school_classes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "school_classes_write_admin"
  ON public.school_classes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "school_classes_update_admin"
  ON public.school_classes FOR UPDATE TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "school_classes_delete_super"
  ON public.school_classes FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "sections_select"
  ON public.sections FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "sections_write_admin"
  ON public.sections FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "sections_update_admin"
  ON public.sections FOR UPDATE TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "sections_delete_super"
  ON public.sections FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "subjects_select"
  ON public.subjects FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "subjects_write_admin"
  ON public.subjects FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "subjects_update_admin"
  ON public.subjects FOR UPDATE TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "subjects_delete_super"
  ON public.subjects FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "teacher_assignments_select"
  ON public.teacher_assignments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "teacher_assignments_write_admin"
  ON public.teacher_assignments FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- Students, Enrollments, Parent Links, Promotions
CREATE POLICY "students_select"
  ON public.students FOR SELECT TO authenticated
  USING (public.can_access_student(id));

CREATE POLICY "students_insert_admin"
  ON public.students FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "students_update_admin"
  ON public.students FOR UPDATE TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "students_delete_super"
  ON public.students FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "student_enrollments_select"
  ON public.student_enrollments FOR SELECT TO authenticated
  USING (public.can_access_student(student_id));

CREATE POLICY "student_enrollments_write_admin"
  ON public.student_enrollments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "student_enrollments_update_admin"
  ON public.student_enrollments FOR UPDATE TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "student_enrollments_delete_super"
  ON public.student_enrollments FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "parent_student_links_select"
  ON public.parent_student_links FOR SELECT TO authenticated
  USING (
    parent_id = auth.uid()
    OR public.can_access_student(student_id)
  );

CREATE POLICY "parent_student_links_write_admin"
  ON public.parent_student_links FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "promotion_records_select"
  ON public.promotion_records FOR SELECT TO authenticated
  USING (public.is_admin_or_super() OR public.can_access_student(student_id));

CREATE POLICY "promotion_records_write_admin"
  ON public.promotion_records FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "promotion_records_update_super"
  ON public.promotion_records FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Assessment Configs, Terms, Components, Grade Bands
CREATE POLICY "assessment_configs_select"
  ON public.assessment_configs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "assessment_configs_write_admin"
  ON public.assessment_configs FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "assessment_terms_select"
  ON public.assessment_terms FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "assessment_terms_write_admin"
  ON public.assessment_terms FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "assessment_components_select"
  ON public.assessment_components FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "assessment_components_write_admin"
  ON public.assessment_components FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "grade_bands_select"
  ON public.grade_bands FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "grade_bands_write_admin"
  ON public.grade_bands FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- Exams, Marks, Summaries, Result PINs
CREATE POLICY "exams_select"
  ON public.exams FOR SELECT TO authenticated
  USING (
    public.is_admin_or_super()
    OR public.current_user_role() = 'teacher'
    OR is_published = true
  );

CREATE POLICY "exams_write_admin"
  ON public.exams FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "mark_entries_select"
  ON public.mark_entries FOR SELECT TO authenticated
  USING (public.can_view_student_exam_result(student_id, exam_id));

CREATE POLICY "mark_entries_insert_teacher_or_admin"
  ON public.mark_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_super()
    OR public.is_teacher_for_subject(subject_id)
  );

CREATE POLICY "mark_entries_update_teacher_or_admin"
  ON public.mark_entries FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_super()
    OR public.is_teacher_for_subject(subject_id)
  )
  WITH CHECK (
    public.is_admin_or_super()
    OR public.is_teacher_for_subject(subject_id)
  );

CREATE POLICY "mark_entries_delete_super"
  ON public.mark_entries FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "exam_summaries_select"
  ON public.exam_student_summaries FOR SELECT TO authenticated
  USING (public.can_view_student_exam_result(student_id, exam_id));

CREATE POLICY "exam_summaries_write_teacher_or_admin"
  ON public.exam_student_summaries FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_super()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id AND public.is_teacher_for_class(e.class_id)
    )
  );

CREATE POLICY "exam_summaries_update_teacher_or_admin"
  ON public.exam_student_summaries FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_super()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id AND public.is_teacher_for_class(e.class_id)
    )
  )
  WITH CHECK (
    public.is_admin_or_super()
    OR EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = exam_id AND public.is_teacher_for_class(e.class_id)
    )
  );

CREATE POLICY "result_pins_admin_all"
  ON public.result_pins FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "result_pin_verifications_select"
  ON public.result_pin_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super());

-- Timetables & Time Slots
CREATE POLICY "time_slots_select"
  ON public.time_slots FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "time_slots_write_admin"
  ON public.time_slots FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "timetables_select"
  ON public.timetables FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "timetables_write_admin"
  ON public.timetables FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "timetable_entries_select"
  ON public.timetable_entries FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "timetable_entries_write_admin"
  ON public.timetable_entries FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- Fees, Invoices, Payments, Receipts
CREATE POLICY "fee_definitions_select"
  ON public.fee_definitions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "fee_definitions_write_accountant_or_admin"
  ON public.fee_definitions FOR ALL TO authenticated
  USING (public.is_accountant_or_admin())
  WITH CHECK (public.is_accountant_or_admin());

CREATE POLICY "student_invoices_select"
  ON public.student_invoices FOR SELECT TO authenticated
  USING (
    public.is_accountant_or_admin()
    OR public.current_student_id() = student_id
    OR public.is_parent_of_student(student_id)
  );

CREATE POLICY "student_invoices_write_accountant_or_admin"
  ON public.student_invoices FOR ALL TO authenticated
  USING (public.is_accountant_or_admin())
  WITH CHECK (public.is_accountant_or_admin());

CREATE POLICY "payment_transactions_select"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (
    public.is_accountant_or_admin()
    OR public.current_student_id() = student_id
    OR public.is_parent_of_student(student_id)
  );

CREATE POLICY "payment_transactions_insert_accountant_or_admin"
  ON public.payment_transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_accountant_or_admin());

CREATE POLICY "payment_transactions_update_super"
  ON public.payment_transactions FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "payment_receipts_select"
  ON public.payment_receipts FOR SELECT TO authenticated
  USING (
    public.is_accountant_or_admin()
    OR public.current_student_id() = student_id
    OR public.is_parent_of_student(student_id)
  );

CREATE POLICY "payment_receipts_insert_accountant_or_admin"
  ON public.payment_receipts FOR INSERT TO authenticated
  WITH CHECK (public.is_accountant_or_admin());

CREATE POLICY "payment_receipts_update_super"
  ON public.payment_receipts FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Library Module
CREATE POLICY "library_books_select"
  ON public.library_books FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "library_books_write_librarian"
  ON public.library_books FOR ALL TO authenticated
  USING (public.is_librarian_or_admin())
  WITH CHECK (public.is_librarian_or_admin());

CREATE POLICY "library_book_copies_select"
  ON public.library_book_copies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "library_book_copies_write_librarian"
  ON public.library_book_copies FOR ALL TO authenticated
  USING (public.is_librarian_or_admin())
  WITH CHECK (public.is_librarian_or_admin());

CREATE POLICY "library_borrow_requests_select"
  ON public.library_borrow_requests FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid()
    OR public.is_librarian_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = requester_id AND public.is_parent_of_student(s.id)
    )
  );

CREATE POLICY "library_borrow_requests_insert"
  ON public.library_borrow_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND public.current_user_role() IN ('student', 'teacher', 'admin', 'super_admin', 'librarian')
  );

CREATE POLICY "library_borrow_requests_update"
  ON public.library_borrow_requests FOR UPDATE TO authenticated
  USING (
    public.is_librarian_or_admin()
    OR (requester_id = auth.uid() AND status = 'PENDING')
  )
  WITH CHECK (
    public.is_librarian_or_admin()
    OR (requester_id = auth.uid() AND status = 'CANCELLED')
  );

CREATE POLICY "library_loans_select"
  ON public.library_loans FOR SELECT TO authenticated
  USING (
    borrower_id = auth.uid()
    OR public.is_librarian_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = borrower_id AND public.is_parent_of_student(s.id)
    )
  );

CREATE POLICY "library_loans_write_librarian"
  ON public.library_loans FOR ALL TO authenticated
  USING (public.is_librarian_or_admin())
  WITH CHECK (public.is_librarian_or_admin());

-- Notices & Calendar Events
CREATE POLICY "notices_select"
  ON public.notices FOR SELECT TO authenticated
  USING (
    public.is_admin_or_super()
    OR (
      is_published = true
      AND (
        target_scope = 'SCHOOL'
        OR (target_scope = 'ROLES' AND public.current_user_role() = ANY(target_roles))
        OR (target_scope = 'CLASSES' AND target_class_ids && public.user_relevant_class_ids())
      )
    )
  );

CREATE POLICY "notices_write_admin"
  ON public.notices FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

CREATE POLICY "calendar_events_select"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (
    public.is_admin_or_super()
    OR target_scope = 'SCHOOL'
    OR (target_scope = 'ROLES' AND public.current_user_role() = ANY(target_roles))
    OR (target_scope = 'CLASSES' AND target_class_ids && public.user_relevant_class_ids())
  );

CREATE POLICY "calendar_events_write_admin"
  ON public.calendar_events FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- Study Materials
CREATE POLICY "study_materials_select"
  ON public.study_materials FOR SELECT TO authenticated
  USING (
    public.is_admin_or_super()
    OR uploaded_by = auth.uid()
    OR (
      is_published = true
      AND class_id = ANY(public.user_relevant_class_ids())
    )
  );

CREATE POLICY "study_materials_insert_teacher_or_admin"
  ON public.study_materials FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_super()
    OR (
      uploaded_by = auth.uid()
      AND public.is_teacher_for_class(class_id)
      AND public.is_teacher_for_subject(subject_id)
    )
  );

CREATE POLICY "study_materials_update_teacher_or_admin"
  ON public.study_materials FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_super()
    OR (uploaded_by = auth.uid() AND public.is_teacher_for_subject(subject_id))
  )
  WITH CHECK (
    public.is_admin_or_super()
    OR (uploaded_by = auth.uid() AND public.is_teacher_for_subject(subject_id))
  );

CREATE POLICY "study_materials_delete_teacher_or_admin"
  ON public.study_materials FOR DELETE TO authenticated
  USING (
    public.is_admin_or_super()
    OR (uploaded_by = auth.uid() AND public.is_teacher_for_subject(subject_id))
  );

-- Audit Logs
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin_or_super());

CREATE POLICY "audit_logs_insert_authenticated"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.is_admin_or_super());

-- -----------------------------------------------------------------------------
-- 4. SUPABASE STORAGE BUCKETS & OBJECT POLICIES
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'study-materials',
  'study-materials',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies on storage.objects
DROP POLICY IF EXISTS "study_materials_storage_select" ON storage.objects;
CREATE POLICY "study_materials_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'study-materials'
    AND EXISTS (
      SELECT 1 FROM public.study_materials sm
      WHERE sm.file_path = storage.objects.name
        AND (
          public.is_admin_or_super()
          OR sm.uploaded_by = auth.uid()
          OR (sm.is_published = true AND sm.class_id = ANY(public.user_relevant_class_ids()))
        )
    )
  );

DROP POLICY IF EXISTS "study_materials_storage_insert" ON storage.objects;
CREATE POLICY "study_materials_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'study-materials'
    AND (
      public.is_admin_or_super()
      OR public.current_user_role() = 'teacher'
    )
  );

DROP POLICY IF EXISTS "study_materials_storage_delete" ON storage.objects;
CREATE POLICY "study_materials_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'study-materials'
    AND (
      public.is_admin_or_super()
      OR owner = auth.uid()
    )
  );

DROP POLICY IF EXISTS "profile_photos_storage_select" ON storage.objects;
CREATE POLICY "profile_photos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "profile_photos_storage_insert" ON storage.objects;
CREATE POLICY "profile_photos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (
      public.is_admin_or_super()
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
