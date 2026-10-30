-- =============================================================================
-- School Management System v2 — Initial Schema Migration
-- UUID relationships, Academic-Year Enrollment History, Explicit Parent Links,
-- Decimal Monetary Amounts, Multi-Board Assessment Versioning, Audit Logs
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'admin',
    'teacher',
    'accountant',
    'librarian',
    'student',
    'parent'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.board_code AS ENUM (
    'CBSE',
    'ICSE',
    'WBBSE',
    'WBCHSE',
    'CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.enrollment_status AS ENUM (
    'active',
    'promoted',
    'retained',
    'graduated',
    'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.promotion_action AS ENUM (
    'PROMOTE',
    'RETAIN',
    'GRADUATE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mark_status AS ENUM (
    'PRESENT',
    'ABSENT',
    'MISSING'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM (
    'UNPAID',
    'PARTIAL',
    'PAID',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM (
    'CASH',
    'UPI',
    'BANK_TRANSFER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.copy_status AS ENUM (
    'AVAILABLE',
    'RESERVED',
    'ISSUED',
    'LOST',
    'MAINTENANCE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.borrow_request_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'FULFILLED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.loan_status AS ENUM (
    'ISSUED',
    'RETURNED',
    'OVERDUE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.target_scope AS ENUM (
    'SCHOOL',
    'ROLES',
    'CLASSES'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.timetable_kind AS ENUM (
    'CLASS',
    'EXAM'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 2. CORE ACADEMIC YEARS & SCHOOL SETTINGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT academic_years_date_order CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS public.school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL DEFAULT 'Vidya Bharati Model Senior Secondary School',
  school_acronym TEXT NOT NULL DEFAULT 'VBMSSS',
  school_motto TEXT NOT NULL DEFAULT 'Satyam Shivam Sundaram — Excellence in Holistic Education',
  address TEXT NOT NULL DEFAULT '14, Acharya Jagadish Chandra Bose Road, Kolkata, West Bengal 700017',
  phone TEXT NOT NULL DEFAULT '+91 33 2287 4500',
  email TEXT NOT NULL DEFAULT 'office@vidyabharati.edu.in',
  website TEXT DEFAULT 'https://vidyabharati.edu.in',
  logo_path TEXT,
  current_academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  default_board_code public.board_code NOT NULL DEFAULT 'CBSE',
  default_custom_board_name TEXT,
  currency_code TEXT NOT NULL DEFAULT 'INR',
  locale TEXT NOT NULL DEFAULT 'en-IN',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  academic_year_start_month INTEGER NOT NULL DEFAULT 4 CHECK (academic_year_start_month BETWEEN 1 AND 12),
  academic_year_end_month INTEGER NOT NULL DEFAULT 3 CHECK (academic_year_end_month BETWEEN 1 AND 12),
  require_result_pin BOOLEAN NOT NULL DEFAULT false,
  default_loan_days INTEGER NOT NULL DEFAULT 14 CHECK (default_loan_days BETWEEN 1 AND 90),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. PROFILES, STAFF, & HOSTELS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL,
  code TEXT NOT NULL UNIQUE,
  phone TEXT,
  phone_secondary TEXT,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  date_of_birth DATE,
  blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  nationality TEXT NOT NULL DEFAULT 'Indian',
  state TEXT DEFAULT 'West Bengal',
  district TEXT DEFAULT 'Kolkata',
  address TEXT,
  photo_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(lower(username));
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(lower(email));

CREATE TABLE IF NOT EXISTS public.staff_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL UNIQUE,
  designation TEXT NOT NULL,
  department TEXT,
  qualification TEXT,
  employment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  warden_name TEXT,
  capacity INTEGER NOT NULL DEFAULT 100 CHECK (capacity > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. CLASSES (1-12), SECTIONS, SUBJECTS, & TEACHER ASSIGNMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  numeric_level INTEGER NOT NULL CHECK (numeric_level BETWEEN 1 AND 12),
  stream TEXT NOT NULL DEFAULT 'General',
  board_override public.board_code,
  custom_board_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_classes_custom_board_check CHECK (
    board_override IS DISTINCT FROM 'CUSTOM' OR (custom_board_name IS NOT NULL AND length(trim(custom_board_name)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_school_classes_level ON public.school_classes(numeric_level);

CREATE TABLE IF NOT EXISTS public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  room_no TEXT,
  capacity INTEGER NOT NULL DEFAULT 40 CHECK (capacity > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, name)
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  short_name TEXT,
  is_elective BOOLEAN NOT NULL DEFAULT false,
  has_practical BOOLEAN NOT NULL DEFAULT false,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, code)
);

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  is_class_teacher BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, class_id, section_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_id, academic_year_id);

-- -----------------------------------------------------------------------------
-- 5. STUDENTS, ENROLLMENT HISTORY, PARENT LINKS, & PROMOTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  admission_no TEXT NOT NULL UNIQUE,
  date_of_admission DATE NOT NULL DEFAULT CURRENT_DATE,
  house TEXT,
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
  hostel_room_no TEXT,
  is_graduated BOOLEAN NOT NULL DEFAULT false,
  graduated_academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  graduated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
  roll_no INTEGER NOT NULL CHECK (roll_no > 0),
  status public.enrollment_status NOT NULL DEFAULT 'active',
  promoted_from_enrollment_id UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_year_class_section
  ON public.student_enrollments(academic_year_id, class_id, section_id);

CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'Guardian' CHECK (relationship IN ('Father', 'Mother', 'Guardian')),
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON public.parent_student_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON public.parent_student_links(student_id);

CREATE TABLE IF NOT EXISTS public.promotion_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_enrollment_id UUID NOT NULL REFERENCES public.student_enrollments(id) ON DELETE RESTRICT,
  to_enrollment_id UUID REFERENCES public.student_enrollments(id) ON DELETE SET NULL,
  from_academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  to_academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  from_class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE RESTRICT,
  from_section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
  to_class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE RESTRICT,
  to_section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
  action public.promotion_action NOT NULL,
  remarks TEXT,
  promoted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_reversed BOOLEAN NOT NULL DEFAULT false,
  reversed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 6. BOARDS & VERSIONED ASSESSMENT CONFIGURATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.school_classes(id) ON DELETE CASCADE,
  board_code public.board_code NOT NULL,
  custom_board_name TEXT,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  parent_config_id UUID REFERENCES public.assessment_configs(id) ON DELETE SET NULL,
  pass_percentage NUMERIC(5,2) NOT NULL DEFAULT 33.00 CHECK (pass_percentage >= 0 AND pass_percentage <= 100),
  is_template BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  skill_definitions JSONB NOT NULL DEFAULT '["Punctuality & Regularity", "Discipline & Conduct", "Teamwork & Leadership", "Communication Skills", "Analytical Thinking"]'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assessment_configs_custom_name_check CHECK (
    board_code IS DISTINCT FROM 'CUSTOM' OR (custom_board_name IS NOT NULL AND length(trim(custom_board_name)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_assessment_configs_class_year
  ON public.assessment_configs(academic_year_id, class_id, is_active);

CREATE TABLE IF NOT EXISTS public.assessment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.assessment_configs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  semester_number INTEGER CHECK (semester_number BETWEEN 1 AND 4),
  weight_percent NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (weight_percent >= 0 AND weight_percent <= 100),
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (config_id, code)
);

CREATE TABLE IF NOT EXISTS public.assessment_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.assessment_configs(id) ON DELETE CASCADE,
  term_id UUID REFERENCES public.assessment_terms(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  max_marks NUMERIC(6,2) NOT NULL CHECK (max_marks > 0),
  pass_marks NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (pass_marks >= 0 AND pass_marks <= max_marks),
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (config_id, code)
);

CREATE TABLE IF NOT EXISTS public.grade_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.assessment_configs(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  min_percentage NUMERIC(5,2) NOT NULL CHECK (min_percentage >= 0 AND min_percentage <= 100),
  max_percentage NUMERIC(5,2) NOT NULL CHECK (max_percentage >= min_percentage AND max_percentage <= 100),
  grade_point NUMERIC(4,2),
  remark TEXT NOT NULL,
  is_passing BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (config_id, grade)
);

-- -----------------------------------------------------------------------------
-- 7. EXAMINATIONS, MARKS, SUMMARIES, & RESULT PINS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE RESTRICT,
  config_id UUID NOT NULL REFERENCES public.assessment_configs(id) ON DELETE RESTRICT,
  term_id UUID NOT NULL REFERENCES public.assessment_terms(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  config_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, class_id, term_id)
);

CREATE TABLE IF NOT EXISTS public.mark_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.student_enrollments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.assessment_components(id) ON DELETE RESTRICT,
  status public.mark_status NOT NULL DEFAULT 'MISSING',
  marks_obtained NUMERIC(6,2),
  entered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, enrollment_id, subject_id, component_id),
  CONSTRAINT mark_entries_status_value_check CHECK (
    (status = 'PRESENT' AND marks_obtained IS NOT NULL AND marks_obtained >= 0) OR
    (status IN ('ABSENT', 'MISSING') AND marks_obtained IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_mark_entries_exam_subject ON public.mark_entries(exam_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_mark_entries_enrollment ON public.mark_entries(enrollment_id);

CREATE TABLE IF NOT EXISTS public.exam_student_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.student_enrollments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  total_obtained NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_max NUMERIC(8,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  annual_weighted_percentage NUMERIC(5,2),
  overall_grade TEXT,
  grade_remark TEXT,
  is_passed BOOLEAN NOT NULL DEFAULT false,
  section_rank INTEGER,
  class_rank INTEGER,
  teacher_comment TEXT,
  principal_comment TEXT,
  skill_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_snapshot JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, enrollment_id)
);

CREATE TABLE IF NOT EXISTS public.result_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_code TEXT NOT NULL UNIQUE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  used_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  times_used INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0),
  max_uses INTEGER NOT NULL DEFAULT 5 CHECK (max_uses > 0),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.result_pin_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  pin_id UUID NOT NULL REFERENCES public.result_pins(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, student_id, academic_year_id)
);

-- -----------------------------------------------------------------------------
-- 8. TIMETABLES & REUSABLE TIME SLOTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_slots_order_check CHECK (end_time > start_time),
  UNIQUE (start_time, end_time)
);

CREATE TABLE IF NOT EXISTS public.timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  kind public.timetable_kind NOT NULL DEFAULT 'CLASS',
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id UUID NOT NULL REFERENCES public.timetables(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES public.time_slots(id) ON DELETE RESTRICT,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 6),
  exam_date DATE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  room_no TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT timetable_entries_day_or_date CHECK (
    (day_of_week IS NOT NULL AND exam_date IS NULL) OR
    (day_of_week IS NULL AND exam_date IS NOT NULL)
  ),
  UNIQUE (timetable_id, time_slot_id, day_of_week),
  UNIQUE (timetable_id, time_slot_id, exam_date)
);

-- -----------------------------------------------------------------------------
-- 9. FEES, INVOICES, PARTIAL PAYMENTS, & RECEIPTS (NUMERIC(12,2))
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  class_id UUID REFERENCES public.school_classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date DATE,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1001;
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 5001;

CREATE TABLE IF NOT EXISTS public.student_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL UNIQUE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  enrollment_id UUID NOT NULL REFERENCES public.student_enrollments(id) ON DELETE RESTRICT,
  fee_definition_id UUID NOT NULL REFERENCES public.fee_definitions(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0 AND discount_amount <= total_amount),
  net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0 AND amount_paid <= net_amount),
  balance NUMERIC(12,2) NOT NULL CHECK (balance >= 0 AND balance <= net_amount),
  status public.invoice_status NOT NULL DEFAULT 'UNPAID',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, fee_definition_id),
  CONSTRAINT student_invoices_balance_consistency CHECK (amount_paid + balance = net_amount)
);

CREATE INDEX IF NOT EXISTS idx_student_invoices_student ON public.student_invoices(student_id, academic_year_id);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.student_invoices(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method public.payment_method NOT NULL DEFAULT 'CASH',
  reference_no TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  balance_after NUMERIC(12,2) NOT NULL CHECK (balance_after >= 0),
  is_reversed BOOLEAN NOT NULL DEFAULT false,
  reversed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no TEXT NOT NULL UNIQUE,
  transaction_id UUID NOT NULL UNIQUE REFERENCES public.payment_transactions(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL REFERENCES public.student_invoices(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE RESTRICT,
  amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid > 0),
  balance_remaining NUMERIC(12,2) NOT NULL CHECK (balance_remaining >= 0),
  payment_method public.payment_method NOT NULL,
  reference_no TEXT,
  issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_void BOOLEAN NOT NULL DEFAULT false,
  voided_at TIMESTAMPTZ,
  void_reason TEXT
);

-- -----------------------------------------------------------------------------
-- 10. LIBRARY MODULE (CATALOGUE, INDIVIDUAL COPIES, REQUESTS, 14-DAY LOANS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.library_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT UNIQUE,
  publisher TEXT,
  edition TEXT,
  category TEXT NOT NULL DEFAULT 'Academic',
  class_id UUID REFERENCES public.school_classes(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  rack_location TEXT,
  description TEXT,
  total_copies INTEGER NOT NULL DEFAULT 0 CHECK (total_copies >= 0),
  available_copies INTEGER NOT NULL DEFAULT 0 CHECK (available_copies >= 0 AND available_copies <= total_copies),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  accession_no TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  condition TEXT NOT NULL DEFAULT 'Good' CHECK (condition IN ('New', 'Good', 'Fair', 'Damaged')),
  status public.copy_status NOT NULL DEFAULT 'AVAILABLE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_book_copies_book ON public.library_book_copies(book_id, status);

CREATE TABLE IF NOT EXISTS public.library_borrow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_copy_id UUID REFERENCES public.library_book_copies(id) ON DELETE SET NULL,
  status public.borrow_request_status NOT NULL DEFAULT 'PENDING',
  request_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id UUID NOT NULL REFERENCES public.library_book_copies(id) ON DELETE RESTRICT,
  book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE RESTRICT,
  borrower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  request_id UUID REFERENCES public.library_borrow_requests(id) ON DELETE SET NULL,
  issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + 14),
  returned_at TIMESTAMPTZ,
  returned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  return_condition TEXT,
  status public.loan_status NOT NULL DEFAULT 'ISSUED',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent a single physical book copy from having two active ISSUED loans simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_loans_single_active_copy
  ON public.library_loans(copy_id)
  WHERE returned_at IS NULL;

-- -----------------------------------------------------------------------------
-- 11. NOTICES, CALENDAR EVENTS, & STUDY MATERIALS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General' CHECK (category IN ('Academic', 'Examination', 'Holiday', 'Fee', 'General', 'Emergency')),
  target_scope public.target_scope NOT NULL DEFAULT 'SCHOOL',
  target_roles public.user_role[] NOT NULL DEFAULT '{}',
  target_class_ids UUID[] NOT NULL DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'Academic' CHECK (event_type IN ('Holiday', 'Examination', 'PTM', 'Sports', 'Cultural', 'Academic')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT true,
  location TEXT,
  target_scope public.target_scope NOT NULL DEFAULT 'SCHOOL',
  target_roles public.user_role[] NOT NULL DEFAULT '{}',
  target_class_ids UUID[] NOT NULL DEFAULT '{}',
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_date_order CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (
    mime_type IN (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png'
    )
  ),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760),
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 12. AUDIT LOGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role public.user_role,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
