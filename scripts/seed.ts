import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const ISOLATED_SEED = process.env.SEED_SKIP_EXTERNAL === 'true';

export const DEMO_PASSWORD = 'School@2026';

export const DEMO_USERS = [
  {
    username: 'superadmin',
    email: 'superadmin@vidyabharati.edu.in',
    fullName: 'Dr. Subir Chatterjee',
    role: 'super_admin',
    code: 'EMP-SA-001',
    phone: '+91 98300 11001',
    gender: 'Male',
    dob: '1972-05-14',
    bloodGroup: 'O+',
    designation: 'Principal & Super Administrator',
    department: 'Administration',
    qualification: 'Ph.D., M.Sc., B.Ed.',
  },
  {
    username: 'admin',
    email: 'admin@vidyabharati.edu.in',
    fullName: 'Smt. Ananya Sen',
    role: 'admin',
    code: 'EMP-AD-002',
    phone: '+91 98300 11002',
    gender: 'Female',
    dob: '1980-08-22',
    bloodGroup: 'A+',
    designation: 'Vice Principal & Academic Administrator',
    department: 'Academic Office',
    qualification: 'M.A. (English), B.Ed.',
  },
  {
    username: 'teacher',
    email: 'teacher@vidyabharati.edu.in',
    fullName: 'Prof. Debashis Mukherjee',
    role: 'teacher',
    code: 'EMP-TC-101',
    phone: '+91 98300 11003',
    gender: 'Male',
    dob: '1985-11-03',
    bloodGroup: 'B+',
    designation: 'Senior Mathematics & Physics Teacher',
    department: 'Science & Mathematics',
    qualification: 'M.Sc. (Mathematics), B.Ed.',
  },
  {
    username: 'teacher2',
    email: 'kavita.sharma@vidyabharati.edu.in',
    fullName: 'Ms. Kavita Sharma',
    role: 'teacher',
    code: 'EMP-TC-102',
    phone: '+91 98300 11008',
    gender: 'Female',
    dob: '1988-02-19',
    bloodGroup: 'AB+',
    designation: 'Senior English & Social Studies Teacher',
    department: 'Humanities & Languages',
    qualification: 'M.A. (History & English), B.Ed.',
  },
  {
    username: 'accountant',
    email: 'accountant@vidyabharati.edu.in',
    fullName: 'Shri Rajat Banerjee',
    role: 'accountant',
    code: 'EMP-AC-201',
    phone: '+91 98300 11004',
    gender: 'Male',
    dob: '1983-01-17',
    bloodGroup: 'O+',
    designation: 'Senior Accounts Officer',
    department: 'Finance & Accounts',
    qualification: 'M.Com., CA Inter',
  },
  {
    username: 'librarian',
    email: 'librarian@vidyabharati.edu.in',
    fullName: 'Ms. Poulomi Ghosh',
    role: 'librarian',
    code: 'EMP-LB-301',
    phone: '+91 98300 11005',
    gender: 'Female',
    dob: '1987-07-09',
    bloodGroup: 'A-',
    designation: 'Head Librarian',
    department: 'Central Library',
    qualification: 'M.Lib.I.Sc.',
  },
  {
    username: 'student',
    email: 'student@vidyabharati.edu.in',
    fullName: 'Aarav Roy',
    role: 'student',
    code: 'STU-2025-001',
    phone: '+91 98300 22001',
    gender: 'Male',
    dob: '2010-06-15',
    bloodGroup: 'B+',
    admissionNo: 'VBM-2025-001',
    house: 'Tagore House',
  },
  {
    username: 'student2',
    email: 'diya.sen@vidyabharati.edu.in',
    fullName: 'Diya Sen',
    role: 'student',
    code: 'STU-2025-002',
    phone: '+91 98300 22002',
    gender: 'Female',
    dob: '2010-09-21',
    bloodGroup: 'O+',
    admissionNo: 'VBM-2025-002',
    house: 'Vivekananda House',
  },
  {
    username: 'student3',
    email: 'rohan.das@vidyabharati.edu.in',
    fullName: 'Rohan Das',
    role: 'student',
    code: 'STU-2025-003',
    phone: '+91 98300 22003',
    gender: 'Male',
    dob: '2010-12-04',
    bloodGroup: 'A+',
    admissionNo: 'VBM-2025-003',
    house: 'Netaji House',
  },
  {
    username: 'student4',
    email: 'ishita.bose@vidyabharati.edu.in',
    fullName: 'Ishita Bose',
    role: 'student',
    code: 'STU-2025-004',
    phone: '+91 98300 22004',
    gender: 'Female',
    dob: '2009-04-11',
    bloodGroup: 'AB+',
    admissionNo: 'VBM-2024-014',
    house: 'Sarojini House',
  },
  {
    username: 'student5',
    email: 'arjun.nair@vidyabharati.edu.in',
    fullName: 'Arjun Nair',
    role: 'student',
    code: 'STU-2025-005',
    phone: '+91 98300 22005',
    gender: 'Male',
    dob: '2008-03-28',
    bloodGroup: 'O-',
    admissionNo: 'VBM-2023-008',
    house: 'Tagore House',
  },
  {
    username: 'parent',
    email: 'parent@vidyabharati.edu.in',
    fullName: 'Shri Vikram Roy',
    role: 'parent',
    code: 'PAR-2025-001',
    phone: '+91 98300 33001',
    gender: 'Male',
    dob: '1978-03-10',
    bloodGroup: 'B+',
  },
  {
    username: 'parent2',
    email: 'meera.sen@vidyabharati.edu.in',
    fullName: 'Smt. Meera Sen',
    role: 'parent',
    code: 'PAR-2025-002',
    phone: '+91 98300 33002',
    gender: 'Female',
    dob: '1981-11-25',
    bloodGroup: 'O+',
  },
] as const;

async function generateDemoStudyMaterialPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('VIDYA BHARATI MODEL SENIOR SECONDARY SCHOOL', {
    x: 50,
    y: 780,
    size: 16,
    font: fontBold,
    color: rgb(0.08, 0.24, 0.48),
  });

  page.drawText('Class X — Mathematics Study Material: Quadratic Equations & Trigonometry', {
    x: 50,
    y: 750,
    size: 13,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });

  const lines = [
    'Prepared by: Prof. Debashis Mukherjee (Department of Mathematics)',
    'Academic Session: 2026-2027 | Board Profile: CBSE / WBBSE Foundation',
    '',
    '1. Standard Form of a Quadratic Equation:',
    '   ax^2 + bx + c = 0, where a != 0 and a, b, c are real numbers.',
    '',
    '2. Quadratic Formula (Sridharacharya Formula):',
    '   Discriminant D = b^2 - 4ac',
    '   Roots: x = (-b +/- sqrt(b^2 - 4ac)) / (2a)',
    '   - If D > 0: Two distinct real roots',
    '   - If D = 0: Two equal real roots',
    '   - If D < 0: No real roots',
    '',
    '3. Fundamental Trigonometric Identities:',
    '   - sin^2(theta) + cos^2(theta) = 1',
    '   - 1 + tan^2(theta) = sec^2(theta)',
    '   - 1 + cot^2(theta) = cosec^2(theta)',
    '',
    '4. Practice Problems for Term Evaluation:',
    '   Q1. Find the roots of 2x^2 - 7x + 3 = 0 by factorization and verify relations.',
    '   Q2. Prove that: (1 + sec A) / sec A = sin^2 A / (1 - cos A).',
    '   Q3. From the top of a 7m high building, the angle of elevation of the top of a',
    '       cable tower is 60 deg and the angle of depression of its foot is 45 deg.',
    '       Determine the height of the tower.',
  ];

  let y = 715;
  for (const line of lines) {
    page.drawText(line, {
      x: 50,
      y,
      size: 10.5,
      font: line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('4.') ? fontBold : fontRegular,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 20;
  }

  return await pdfDoc.save();
}

async function seed() {
  if (!ISOLATED_SEED && !SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in .env to run seed.');
  }

  const supabaseAdmin = ISOLATED_SEED
    ? null
    : createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

  const pg = new Client({ connectionString: DATABASE_URL });
  await pg.connect();

  try {
    console.log('1. Clearing existing application data for clean repeatable seed...');
    await pg.query(`
      TRUNCATE TABLE
        public.audit_logs,
        public.study_materials,
        public.calendar_events,
        public.notices,
        public.library_loans,
        public.library_borrow_requests,
        public.library_book_copies,
        public.library_books,
        public.payment_receipts,
        public.payment_transactions,
        public.student_invoices,
        public.fee_definitions,
        public.timetable_entries,
        public.timetables,
        public.time_slots,
        public.result_pin_verifications,
        public.result_pins,
        public.exam_result_revision_students,
        public.exam_result_revisions,
        public.exam_student_summaries,
        public.mark_entries,
        public.exams,
        public.grade_bands,
        public.assessment_components,
        public.assessment_terms,
        public.assessment_configs,
        public.promotion_records,
        public.parent_student_links,
        public.student_enrollments,
        public.students,
        public.teacher_assignments,
        public.subjects,
        public.sections,
        public.school_classes,
        public.hostels,
        public.staff_records,
        public.school_settings,
        public.academic_years
      RESTART IDENTITY CASCADE;
    `);

    console.log('2. Provisioning Auth users and profiles for all 7 roles...');
    const existingByEmail = new Map<string, string>();
    if (ISOLATED_SEED) {
      const authRows = await pg.query<{ id: string; email: string }>(
        'SELECT id,email FROM auth.users WHERE lower(email)=ANY($1::text[])',
        [DEMO_USERS.map((user) => user.email.toLowerCase())]
      );
      for (const user of authRows.rows) existingByEmail.set(user.email.toLowerCase(), user.id);
    } else {
      const existingUsersRes = await supabaseAdmin!.auth.admin.listUsers({ perPage: 200 });
      for (const user of existingUsersRes.data?.users || []) {
        existingByEmail.set(user.email?.toLowerCase() || '', user.id);
      }
    }

    const userIdByUsername: Record<string, string> = {};

    for (const u of DEMO_USERS) {
      let uid = existingByEmail.get(u.email.toLowerCase());
      if (ISOLATED_SEED) {
        if (!uid) {
          throw new Error(`Isolated seed requires preloaded auth user ${u.email}.`);
        }
      } else if (uid) {
        await supabaseAdmin!.auth.admin.updateUserById(uid, {
          email: u.email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: u.fullName, role: u.role, username: u.username },
        });
      } else {
        const created = await supabaseAdmin!.auth.admin.createUser({
          email: u.email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: u.fullName, role: u.role, username: u.username },
        });
        if (created.error || !created.data.user) {
          throw new Error(`Failed creating auth user ${u.email}: ${created.error?.message}`);
        }
        uid = created.data.user.id;
      }

      userIdByUsername[u.username] = uid;

      await pg.query(
        `
        INSERT INTO public.profiles (
          id, username, email, full_name, role, code, phone, gender, date_of_birth,
          blood_group, nationality, state, district, address, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, 'Indian', 'West Bengal', 'Kolkata', 'Park Circus / Ballygunge, Kolkata - 700019', true
        )
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          code = EXCLUDED.code,
          phone = EXCLUDED.phone,
          gender = EXCLUDED.gender,
          date_of_birth = EXCLUDED.date_of_birth,
          blood_group = EXCLUDED.blood_group,
          is_active = true,
          updated_at = now();
        `,
        [uid, u.username, u.email, u.fullName, u.role, u.code, u.phone, u.gender, u.dob, u.bloodGroup]
      );

      if ('designation' in u) {
        await pg.query(
          `
          INSERT INTO public.staff_records (user_id, employee_code, designation, department, qualification, employment_date)
          VALUES ($1, $2, $3, $4, $5, '2020-04-01')
          ON CONFLICT (user_id) DO UPDATE SET
            employee_code = EXCLUDED.employee_code,
            designation = EXCLUDED.designation,
            department = EXCLUDED.department,
            qualification = EXCLUDED.qualification;
          `,
          [uid, u.code, u.designation, u.department, u.qualification]
        );
      }
    }

    console.log('3. Seeding Academic Years (April–March) and School Settings...');
    const yr2025 = await pg.query(
      `INSERT INTO public.academic_years (name, start_date, end_date, is_current)
       VALUES ('2025-2026', '2025-04-01', '2026-03-31', false) RETURNING id;`
    );
    const yr2026 = await pg.query(
      `INSERT INTO public.academic_years (name, start_date, end_date, is_current)
       VALUES ('2026-2027', '2026-04-01', '2027-03-31', true) RETURNING id;`
    );
    const yr2027 = await pg.query(
      `INSERT INTO public.academic_years (name, start_date, end_date, is_current)
       VALUES ('2027-2028', '2027-04-01', '2028-03-31', false) RETURNING id;`
    );

    const year2025Id = yr2025.rows[0].id as string;
    const year2026Id = yr2026.rows[0].id as string;
    const year2027Id = yr2027.rows[0].id as string;

    await pg.query(
      `INSERT INTO public.school_settings (
        school_name, school_acronym, school_motto, address, phone, email, website,
        current_academic_year_id, default_board_code, currency_code, locale, timezone,
        academic_year_start_month, academic_year_end_month, require_result_pin, default_loan_days
      ) VALUES (
        'Vidya Bharati Model Senior Secondary School',
        'VBMSSS',
        'Satyam Shivam Sundaram — Excellence in Holistic Education',
        '14, Acharya Jagadish Chandra Bose Road, Kolkata, West Bengal 700017',
        '+91 33 2287 4500',
        'office@vidyabharati.edu.in',
        'https://vidyabharati.edu.in',
        $1, 'CBSE', 'INR', 'en-IN', 'Asia/Kolkata', 4, 3, false, 14
      );`,
      [year2026Id]
    );

    console.log('4. Seeding Hostels, Classes (1–12), Sections, Subjects, and Teacher Assignments...');
    const hostelRes = await pg.query(`
      INSERT INTO public.hostels (name, warden_name, capacity, description)
      VALUES
        ('Rabindranath Tagore Boys Hostel', 'Prof. Debashis Mukherjee', 120, 'Senior boys residential block'),
        ('Sarojini Naidu Girls Hostel', 'Ms. Kavita Sharma', 120, 'Senior girls residential block'),
        ('Swami Vivekananda Junior Hostel', 'Shri Rajat Banerjee', 80, 'Middle school residential wing')
      RETURNING id, name;
    `);
    const tagoreHostelId = hostelRes.rows[0].id as string;
    const sarojiniHostelId = hostelRes.rows[1].id as string;

    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const classIdByLevel: Record<number, string> = {};
    const sectionAIdByLevel: Record<number, string> = {};
    const sectionBIdByLevel: Record<number, string> = {};

    for (let lvl = 1; lvl <= 12; lvl++) {
      const name = `Class ${roman[lvl - 1]}`;
      const code = `CLS-${String(lvl).padStart(2, '0')}`;
      const stream = lvl >= 11 ? 'Science' : 'General';
      let boardOverride: string | null = null;
      if (lvl === 9) boardOverride = 'WBBSE';
      if (lvl === 11 || lvl === 12) boardOverride = 'WBCHSE';

      const clsRes = await pg.query(
        `INSERT INTO public.school_classes (name, code, numeric_level, stream, board_override)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [name, code, lvl, stream, boardOverride]
      );
      const cid = clsRes.rows[0].id as string;
      classIdByLevel[lvl] = cid;

      const secARes = await pg.query(
        `INSERT INTO public.sections (class_id, name, class_teacher_id, room_no, capacity)
         VALUES ($1, 'A', $2, $3, 40) RETURNING id;`,
        [
          cid,
          lvl === 10 ? userIdByUsername.teacher : userIdByUsername.teacher2,
          `R-${lvl}01`,
        ]
      );
      const secBRes = await pg.query(
        `INSERT INTO public.sections (class_id, name, class_teacher_id, room_no, capacity)
         VALUES ($1, 'B', $2, $3, 40) RETURNING id;`,
        [cid, userIdByUsername.teacher2, `R-${lvl}02`]
      );
      sectionAIdByLevel[lvl] = secARes.rows[0].id as string;
      sectionBIdByLevel[lvl] = secBRes.rows[0].id as string;
    }

    // Seed core subjects for Class IX, X, XI, XII (and representative subjects for Classes I-VIII)
    const subjectMap: Record<string, string> = {};
    const class10Subjects = [
      { name: 'Mathematics', code: 'MATH-10', short: 'MATH', teacher: userIdByUsername.teacher, practical: false },
      { name: 'Science & Technology', code: 'SCI-10', short: 'SCI', teacher: userIdByUsername.teacher, practical: true },
      { name: 'English Language & Literature', code: 'ENG-10', short: 'ENG', teacher: userIdByUsername.teacher2, practical: false },
      { name: 'Social Science (History & Geography)', code: 'SST-10', short: 'SST', teacher: userIdByUsername.teacher2, practical: false },
      { name: 'Second Language (Bengali / Hindi)', code: 'LANG2-10', short: 'BEN/HIN', teacher: userIdByUsername.teacher2, practical: false },
    ];

    for (const sub of class10Subjects) {
      const r = await pg.query(
        `INSERT INTO public.subjects (class_id, name, code, short_name, has_practical, teacher_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
        [classIdByLevel[10], sub.name, sub.code, sub.short, sub.practical, sub.teacher]
      );
      subjectMap[sub.code] = r.rows[0].id as string;

      await pg.query(
        `INSERT INTO public.teacher_assignments (academic_year_id, teacher_id, class_id, section_id, subject_id, is_class_teacher)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          year2026Id,
          sub.teacher,
          classIdByLevel[10],
          sectionAIdByLevel[10],
          r.rows[0].id,
          sub.code === 'MATH-10',
        ]
      );
    }

    const class9Subjects = [
      { name: 'Mathematics', code: 'MATH-09', short: 'MATH', teacher: userIdByUsername.teacher },
      { name: 'Physical Science', code: 'PSCI-09', short: 'PSCI', teacher: userIdByUsername.teacher },
      { name: 'English', code: 'ENG-09', short: 'ENG', teacher: userIdByUsername.teacher2 },
    ];
    for (const sub of class9Subjects) {
      const r = await pg.query(
        `INSERT INTO public.subjects (class_id, name, code, short_name, teacher_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
        [classIdByLevel[9], sub.name, sub.code, sub.short, sub.teacher]
      );
      subjectMap[sub.code] = r.rows[0].id as string;
      await pg.query(
        `INSERT INTO public.teacher_assignments (academic_year_id, teacher_id, class_id, section_id, subject_id, is_class_teacher)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [year2026Id, sub.teacher, classIdByLevel[9], sectionAIdByLevel[9], r.rows[0].id, sub.code === 'MATH-09']
      );
    }

    const class11Subjects = [
      { name: 'Physics', code: 'PHY-11', short: 'PHY', teacher: userIdByUsername.teacher, practical: true },
      { name: 'Mathematics', code: 'MATH-11', short: 'MATH', teacher: userIdByUsername.teacher, practical: false },
      { name: 'English B', code: 'ENG-11', short: 'ENG', teacher: userIdByUsername.teacher2, practical: false },
    ];
    for (const sub of class11Subjects) {
      const r = await pg.query(
        `INSERT INTO public.subjects (class_id, name, code, short_name, has_practical, teacher_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
        [classIdByLevel[11], sub.name, sub.code, sub.short, sub.practical, sub.teacher]
      );
      subjectMap[sub.code] = r.rows[0].id as string;
      await pg.query(
        `INSERT INTO public.teacher_assignments (academic_year_id, teacher_id, class_id, section_id, subject_id, is_class_teacher)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [year2026Id, sub.teacher, classIdByLevel[11], sectionAIdByLevel[11], r.rows[0].id, sub.code === 'PHY-11']
      );
    }

    const class12Subjects = [
      { name: 'Physics', code: 'PHY-12', short: 'PHY', teacher: userIdByUsername.teacher, practical: true },
      { name: 'Mathematics', code: 'MATH-12', short: 'MATH', teacher: userIdByUsername.teacher, practical: false },
      { name: 'English B', code: 'ENG-12', short: 'ENG', teacher: userIdByUsername.teacher2, practical: false },
    ];
    for (const sub of class12Subjects) {
      const r = await pg.query(
        `INSERT INTO public.subjects (class_id, name, code, short_name, has_practical, teacher_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
        [classIdByLevel[12], sub.name, sub.code, sub.short, sub.practical, sub.teacher]
      );
      subjectMap[sub.code] = r.rows[0].id as string;
      await pg.query(
        `INSERT INTO public.teacher_assignments (academic_year_id, teacher_id, class_id, section_id, subject_id, is_class_teacher)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [year2026Id, sub.teacher, classIdByLevel[12], sectionAIdByLevel[12], r.rows[0].id, sub.code === 'PHY-12']
      );
    }

    console.log('5. Seeding Students, Historical & Active Enrollments, and Parent Links...');
    const studentIdByUsername: Record<string, string> = {};
    const enrollment2026ByUsername: Record<string, string> = {};

    const studentConfigs = [
      { username: 'student', adm: 'VBM-2025-001', house: 'Tagore House', hostel: tagoreHostelId, room: 'T-104', level: 10, roll: 1 },
      { username: 'student2', adm: 'VBM-2025-002', house: 'Vivekananda House', hostel: sarojiniHostelId, room: 'S-201', level: 10, roll: 2 },
      { username: 'student3', adm: 'VBM-2025-003', house: 'Netaji House', hostel: tagoreHostelId, room: 'T-108', level: 10, roll: 3 },
      { username: 'student4', adm: 'VBM-2024-014', house: 'Sarojini House', hostel: sarojiniHostelId, room: 'S-305', level: 11, roll: 1 },
      { username: 'student5', adm: 'VBM-2023-008', house: 'Tagore House', hostel: tagoreHostelId, room: 'T-210', level: 12, roll: 1 },
    ];

    for (const sc of studentConfigs) {
      const stRes = await pg.query(
        `INSERT INTO public.students (user_id, admission_no, date_of_admission, house, hostel_id, hostel_room_no)
         VALUES ($1, $2, '2024-04-02', $3, $4, $5) RETURNING id;`,
        [userIdByUsername[sc.username], sc.adm, sc.house, sc.hostel, sc.room]
      );
      const stId = stRes.rows[0].id as string;
      studentIdByUsername[sc.username] = stId;

      let prevEnrollId: string | null = null;
      if (sc.username === 'student') {
        // Historical 2025-2026 enrollment in Class IX Section A
        const histRes = await pg.query(
          `INSERT INTO public.student_enrollments (student_id, academic_year_id, class_id, section_id, roll_no, status)
           VALUES ($1, $2, $3, $4, 1, 'promoted') RETURNING id;`,
          [stId, year2025Id, classIdByLevel[9], sectionAIdByLevel[9]]
        );
        prevEnrollId = histRes.rows[0].id as string;
      }

      const currRes = await pg.query(
        `INSERT INTO public.student_enrollments (student_id, academic_year_id, class_id, section_id, roll_no, status, promoted_from_enrollment_id)
         VALUES ($1, $2, $3, $4, $5, 'active', $6) RETURNING id;`,
        [stId, year2026Id, classIdByLevel[sc.level], sectionAIdByLevel[sc.level], sc.roll, prevEnrollId]
      );
      const currEnrollId = currRes.rows[0].id as string;
      enrollment2026ByUsername[sc.username] = currEnrollId;

      if (sc.username === 'student' && prevEnrollId) {
        await pg.query(
          `INSERT INTO public.promotion_records (
            student_id, from_enrollment_id, to_enrollment_id,
            from_academic_year_id, to_academic_year_id,
            from_class_id, from_section_id, to_class_id, to_section_id,
            action, remarks, promoted_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PROMOTE', 'Promoted with distinction from Class IX to Class X', $10);`,
          [
            stId,
            prevEnrollId,
            currEnrollId,
            year2025Id,
            year2026Id,
            classIdByLevel[9],
            sectionAIdByLevel[9],
            classIdByLevel[10],
            sectionAIdByLevel[10],
            userIdByUsername.admin,
          ]
        );
      }
    }

    // Explicit parent-student links:
    // parent (Shri Vikram Roy) -> linked to Aarav Roy (student) & Ishita Bose (student4)
    // parent2 (Smt. Meera Sen) -> linked to Diya Sen (student2)
    await pg.query(
      `INSERT INTO public.parent_student_links (parent_id, student_id, relationship, is_primary)
       VALUES
         ($1, $2, 'Father', true),
         ($1, $3, 'Guardian', false),
         ($4, $5, 'Mother', true);`,
      [
        userIdByUsername.parent,
        studentIdByUsername.student,
        studentIdByUsername.student4,
        userIdByUsername.parent2,
        studentIdByUsername.student2,
      ]
    );

    console.log('6. Seeding All 5 Board Demonstration Profiles (CBSE, ICSE, WBBSE, WBCHSE, CUSTOM)...');
    // 6.1 CBSE Config (Class X 2026-2027)
    const cbseCfgRes = await pg.query(
      `INSERT INTO public.assessment_configs (
        academic_year_id, class_id, board_code, name, description, version, pass_percentage, is_template, is_active, created_by
      ) VALUES (
        $1, $2, 'CBSE', 'CBSE Secondary Assessment Profile (Class X)',
        'School-managed CBSE demonstration profile: Periodic Assessment (20) + Term Exam (80) across Term I (50%) and Term II (50%).',
        1, 33.00, true, true, $3
      ) RETURNING id;`,
      [year2026Id, classIdByLevel[10], userIdByUsername.admin]
    );
    const cbseConfigId = cbseCfgRes.rows[0].id as string;

    const cbseT1Res = await pg.query(
      `INSERT INTO public.assessment_terms (config_id, code, name, semester_number, weight_percent, display_order)
       VALUES ($1, 'TERM_1', 'Term I (Half-Yearly)', 1, 50.00, 1) RETURNING id;`,
      [cbseConfigId]
    );
    const cbseT2Res = await pg.query(
      `INSERT INTO public.assessment_terms (config_id, code, name, semester_number, weight_percent, display_order)
       VALUES ($1, 'TERM_2', 'Term II (Annual)', 2, 50.00, 2) RETURNING id;`,
      [cbseConfigId]
    );
    const cbseTerm1Id = cbseT1Res.rows[0].id as string;
    const cbseTerm2Id = cbseT2Res.rows[0].id as string;

    const cbseCompIA = await pg.query(
      `INSERT INTO public.assessment_components (config_id, code, name, max_marks, pass_marks, is_mandatory, display_order)
       VALUES ($1, 'IA', 'Periodic Test & Internal Assessment', 20.00, 7.00, true, 1) RETURNING id;`,
      [cbseConfigId]
    );
    const cbseCompWritten = await pg.query(
      `INSERT INTO public.assessment_components (config_id, code, name, max_marks, pass_marks, is_mandatory, display_order)
       VALUES ($1, 'THEORY', 'Term Written Examination', 80.00, 26.00, true, 2) RETURNING id;`,
      [cbseConfigId]
    );
    const cbseCompIAId = cbseCompIA.rows[0].id as string;
    const cbseCompWrittenId = cbseCompWritten.rows[0].id as string;

    const cbseGrades = [
      ['A1', 91, 100, 10.0, 'Outstanding', true, 1],
      ['A2', 81, 90.99, 9.0, 'Excellent', true, 2],
      ['B1', 71, 80.99, 8.0, 'Very Good', true, 3],
      ['B2', 61, 70.99, 7.0, 'Good', true, 4],
      ['C1', 51, 60.99, 6.0, 'Fair', true, 5],
      ['C2', 41, 50.99, 5.0, 'Satisfactory', true, 6],
      ['D', 33, 40.99, 4.0, 'Marginal Pass', true, 7],
      ['E', 0, 32.99, 0.0, 'Needs Improvement', false, 8],
    ];
    for (const g of cbseGrades) {
      await pg.query(
        `INSERT INTO public.grade_bands (config_id, grade, min_percentage, max_percentage, grade_point, remark, is_passing, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [cbseConfigId, ...g]
      );
    }

    // 6.2 ICSE Template Profile
    const icseCfgRes = await pg.query(
      `INSERT INTO public.assessment_configs (
        academic_year_id, class_id, board_code, name, description, version, pass_percentage, is_template, is_active, created_by
      ) VALUES (
        $1, $2, 'ICSE', 'ICSE Demonstration Assessment Profile',
        'School-managed ICSE demonstration profile: Internal Project (20) + Written Paper (80); Term 1 (40%) + Term 2 (60%).',
        1, 35.00, true, true, $3
      ) RETURNING id;`,
      [year2026Id, classIdByLevel[8], userIdByUsername.admin]
    );
    const icseConfigId = icseCfgRes.rows[0].id as string;
    await pg.query(
      `INSERT INTO public.assessment_terms (config_id, code, name, semester_number, weight_percent, display_order)
       VALUES
         ($1, 'ICSE_T1', 'First Term Examination', 1, 40.00, 1),
         ($1, 'ICSE_T2', 'Second Term Final Examination', 2, 60.00, 2);`,
      [icseConfigId]
    );
    await pg.query(
      `INSERT INTO public.assessment_components (config_id, code, name, max_marks, pass_marks, is_mandatory, display_order)
       VALUES
         ($1, 'PROJECT', 'Internal Project & Practical Work', 20.00, 7.00, true, 1),
         ($1, 'PAPER', 'Written Theory Paper', 80.00, 28.00, true, 2);`,
      [icseConfigId]
    );
    const icseGrades = [
      ['1', 90, 100, 10.0, 'Very Good (Distinction)', true, 1],
      ['2', 80, 89.99, 9.0, 'Very Good', true, 2],
      ['3', 70, 79.99, 8.0, 'Credit With Distinction', true, 3],
      ['4', 60, 69.99, 7.0, 'Credit', true, 4],
      ['5', 50, 59.99, 6.0, 'Pass With Credit', true, 5],
      ['6', 40, 49.99, 5.0, 'Pass', true, 6],
      ['7', 35, 39.99, 4.0, 'Standard Pass', true, 7],
      ['8', 0, 34.99, 0.0, 'Fail', false, 8],
    ];
    for (const g of icseGrades) {
      await pg.query(
        `INSERT INTO public.grade_bands (config_id, grade, min_percentage, max_percentage, grade_point, remark, is_passing, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [icseConfigId, ...g]
      );
    }

    // 6.3 WBBSE Profile (Class IX)
    const wbbseCfgRes = await pg.query(
      `INSERT INTO public.assessment_configs (
        academic_year_id, class_id, board_code, name, description, version, pass_percentage, is_template, is_active, created_by
      ) VALUES (
        $1, $2, 'WBBSE', 'WBBSE Secondary Demonstration Profile (Class IX)',
        'School-managed WBBSE demonstration profile: 3 Summative Evaluations (25% + 25% + 50%) with AA to D letter grades.',
        1, 25.00, true, true, $3
      ) RETURNING id;`,
      [year2026Id, classIdByLevel[9], userIdByUsername.admin]
    );
    const wbbseConfigId = wbbseCfgRes.rows[0].id as string;
    await pg.query(
      `INSERT INTO public.assessment_terms (config_id, code, name, semester_number, weight_percent, display_order)
       VALUES
         ($1, 'SUM_1', 'First Summative Evaluation', 1, 25.00, 1),
         ($1, 'SUM_2', 'Second Summative Evaluation', 2, 25.00, 2),
         ($1, 'SUM_3', 'Third Summative Evaluation', 3, 50.00, 3);`,
      [wbbseConfigId]
    );
    await pg.query(
      `INSERT INTO public.assessment_components (config_id, code, name, max_marks, pass_marks, is_mandatory, display_order)
       VALUES
         ($1, 'FORMATIVE', 'Internal Formative Evaluation', 10.00, 3.00, true, 1),
         ($1, 'SUMMATIVE', 'Written Summative Evaluation', 90.00, 22.00, true, 2);`,
      [wbbseConfigId]
    );
    const wbbseGrades = [
      ['AA', 90, 100, 10.0, 'Outstanding', true, 1],
      ['A+', 80, 89.99, 9.0, 'Excellent', true, 2],
      ['A', 60, 79.99, 8.0, 'Very Good', true, 3],
      ['B+', 45, 59.99, 7.0, 'Good', true, 4],
      ['B', 35, 44.99, 6.0, 'Satisfactory', true, 5],
      ['C', 25, 34.99, 5.0, 'Marginal', true, 6],
      ['D', 0, 24.99, 0.0, 'Disqualified', false, 7],
    ];
    for (const g of wbbseGrades) {
      await pg.query(
        `INSERT INTO public.grade_bands (config_id, grade, min_percentage, max_percentage, grade_point, remark, is_passing, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [wbbseConfigId, ...g]
      );
    }

    // 6.4 WBCHSE Class XI Profile (Semester I & Semester II)
    const wbchse11Res = await pg.query(
      `INSERT INTO public.assessment_configs (
        academic_year_id, class_id, board_code, name, description, version, pass_percentage, is_template, is_active, created_by
      ) VALUES (
        $1, $2, 'WBCHSE', 'WBCHSE Higher Secondary Class XI (Semester I–II)',
        'School-managed WBCHSE demonstration profile for Class XI supporting Semester I (50%) and Semester II (50%).',
        1, 30.00, true, true, $3
      ) RETURNING id;`,
      [year2026Id, classIdByLevel[11], userIdByUsername.admin]
    );
    const wbchse11Id = wbchse11Res.rows[0].id as string;
    await pg.query(
      `INSERT INTO public.assessment_terms (config_id, code, name, semester_number, weight_percent, display_order)
       VALUES
         ($1, 'SEM_1', 'Semester I (Class XI)', 1, 50.00, 1),
         ($1, 'SEM_2', 'Semester II (Class XI)', 2, 50.00, 2);`,
      [wbchse11Id]
    );
    await pg.query(
      `INSERT INTO public.assessment_components (config_id, code, name, max_marks, pass_marks, is_mandatory, display_order)
       VALUES
         ($1, 'PRAC', 'Practical / Project Assessment', 30.00, 9.00, true, 1),
         ($1, 'THEORY', 'Semester Written Theory', 70.00, 21.00, true, 2);`,
      [wbchse11Id]
    );

    // 6.5 WBCHSE Class XII Profile (Semester III & Semester IV)
    const wbchse12Res = await pg.query(
      `INSERT INTO public.assessment_configs (
        academic_year_id, class_id, board_code, name, description, version, pass_percentage, is_template, is_active, created_by
      ) VALUES (
        $1, $2, 'WBCHSE', 'WBCHSE Higher Secondary Class XII (Semester III–IV)',
        'School-managed WBCHSE demonstration profile for Class XII supporting Semester III (50%) and Semester IV (50%).',
        1, 30.00, true, true, $3
      ) RETURNING id;`,
      [year2026Id, classIdByLevel[12], userIdByUsername.admin]
    );
    const wbchse12Id = wbchse12Res.rows[0].id as string;
    await pg.query(
      `INSERT INTO public.assessment_terms (config_id, code, name, semester_number, weight_percent, display_order)
       VALUES
         ($1, 'SEM_3', 'Semester III (Class XII)', 3, 50.00, 1),
         ($1, 'SEM_4', 'Semester IV (Class XII)', 4, 50.00, 2);`,
      [wbchse12Id]
    );
    await pg.query(
      `INSERT INTO public.assessment_components (config_id, code, name, max_marks, pass_marks, is_mandatory, display_order)
       VALUES
         ($1, 'PRAC', 'Practical / Project Assessment', 30.00, 9.00, true, 1),
         ($1, 'THEORY', 'Semester Written Theory', 70.00, 21.00, true, 2);`,
      [wbchse12Id]
    );

    const wbchseGrades = [
      ['O', 90, 100, 10.0, 'Outstanding', true, 1],
      ['A+', 80, 89.99, 9.0, 'Excellent', true, 2],
      ['A', 70, 79.99, 8.0, 'Very Good', true, 3],
      ['B+', 60, 69.99, 7.0, 'Good', true, 4],
      ['B', 50, 59.99, 6.0, 'Above Average', true, 5],
      ['C', 40, 49.99, 5.0, 'Average', true, 6],
      ['P', 30, 39.99, 4.0, 'Pass', true, 7],
      ['F', 0, 29.99, 0.0, 'Not Qualified', false, 8],
    ];
    for (const cfgId of [wbchse11Id, wbchse12Id]) {
      for (const g of wbchseGrades) {
        await pg.query(
          `INSERT INTO public.grade_bands (config_id, grade, min_percentage, max_percentage, grade_point, remark, is_passing, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [cfgId, ...g]
        );
      }
    }

    // 6.6 CUSTOM Board Profile
    const customCfgRes = await pg.query(
      `INSERT INTO public.assessment_configs (
        academic_year_id, class_id, board_code, custom_board_name, name, description, version, pass_percentage, is_template, is_active, created_by
      ) VALUES (
        $1, $2, 'CUSTOM', 'Vidya Bharati Autonomous Foundation Curriculum',
        'Custom Holistic Continuous Evaluation Profile',
        'Configurable school-defined custom board profile with continuous skill & academic evaluation.',
        1, 40.00, true, true, $3
      ) RETURNING id;`,
      [year2026Id, classIdByLevel[5], userIdByUsername.admin]
    );
    const customConfigId = customCfgRes.rows[0].id as string;
    await pg.query(
      `INSERT INTO public.assessment_terms (config_id, code, name, semester_number, weight_percent, display_order)
       VALUES
         ($1, 'CUST_T1', 'Mid-Year Assessment', 1, 40.00, 1),
         ($1, 'CUST_T2', 'Year-End Comprehensive Assessment', 2, 60.00, 2);`,
      [customConfigId]
    );
    await pg.query(
      `INSERT INTO public.assessment_components (config_id, code, name, max_marks, pass_marks, is_mandatory, display_order)
       VALUES
         ($1, 'CW', 'Classwork & Portfolio', 30.00, 12.00, true, 1),
         ($1, 'EXAM', 'Comprehensive Assessment', 70.00, 28.00, true, 2);`,
      [customConfigId]
    );
    const customGrades = [
      ['H', 85, 100, 10.0, 'Honours', true, 1],
      ['M', 65, 84.99, 8.0, 'Merit', true, 2],
      ['S', 40, 64.99, 6.0, 'Standard Pass', true, 3],
      ['U', 0, 39.99, 0.0, 'Unclassified', false, 4],
    ];
    for (const g of customGrades) {
      await pg.query(
        `INSERT INTO public.grade_bands (config_id, grade, min_percentage, max_percentage, grade_point, remark, is_passing, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [customConfigId, ...g]
      );
    }

    console.log('7. Seeding Examinations, Marks, Comments, Skill Ratings, & Result PINs...');
    // Class X Term 1 (Published) and Term 2 (Draft)
    const examT1Res = await pg.query(
      `INSERT INTO public.exams (academic_year_id, class_id, config_id, term_id, name, start_date, end_date, is_published, active_draft_id, draft_reason)
       VALUES ($1, $2, $3, $4, 'CBSE Class X Term I Examination 2026-27', '2026-09-10', '2026-09-24', false, gen_random_uuid(), 'Initial seeded publication')
       RETURNING id;`,
      [year2026Id, classIdByLevel[10], cbseConfigId, cbseTerm1Id]
    );
    const examT1Id = examT1Res.rows[0].id as string;

    const examT2Res = await pg.query(
      `INSERT INTO public.exams (academic_year_id, class_id, config_id, term_id, name, start_date, end_date, is_published, active_draft_id, draft_reason)
       VALUES ($1, $2, $3, $4, 'CBSE Class X Term II Final Examination 2026-27', '2027-02-15', '2027-03-02', false, gen_random_uuid(), 'Initial result preparation')
       RETURNING id;`,
      [year2026Id, classIdByLevel[10], cbseConfigId, cbseTerm2Id]
    );
    const examT2Id = examT2Res.rows[0].id as string;

    // Enter complete marks for Term 1 for all 3 Class X students:
    // Make student (Aarav Roy) and student2 (Diya Sen) TIE at 91.00% (455/500) to demonstrate shared rank 1,
    // and student3 (Rohan Das) at 78.00% (390/500) with rank 3!
    const class10SubIds = class10Subjects.map((s) => subjectMap[s.code]);
    const t1ScoresByStudent: Record<string, Array<[number, number]>> = {
      student: [
        [19, 75], // 94
        [18, 74], // 92
        [18, 72], // 90
        [18, 71], // 89
        [18, 72], // 90 -> Total 455 / 500 = 91.00% (A1, Rank 1)
      ],
      student2: [
        [18, 76], // 94
        [19, 73], // 92
        [18, 72], // 90
        [17, 72], // 89
        [18, 72], // 90 -> Total 455 / 500 = 91.00% (A1, Tied Rank 1)
      ],
      student3: [
        [16, 64], // 80
        [15, 63], // 78
        [16, 62], // 78
        [15, 61], // 76
        [16, 62], // 78 -> Total 390 / 500 = 78.00% (B1, Rank 3)
      ],
    };

    for (const [uname, scores] of Object.entries(t1ScoresByStudent)) {
      const enrollId = enrollment2026ByUsername[uname];
      const stId = studentIdByUsername[uname];
      for (let i = 0; i < class10SubIds.length; i++) {
        const subId = class10SubIds[i];
        const [iaScore, writtenScore] = scores[i];
        await pg.query(
          `INSERT INTO public.mark_entries (exam_id, enrollment_id, student_id, subject_id, component_id, status, marks_obtained, entered_by)
           VALUES
             ($1, $2, $3, $4, $5, 'PRESENT', $6, $8),
             ($1, $2, $3, $4, $7, 'PRESENT', $9, $8);`,
          [examT1Id, enrollId, stId, subId, cbseCompIAId, iaScore, cbseCompWrittenId, userIdByUsername.teacher, writtenScore]
        );
      }
    }

    // Publish Term 1 using the calculation logic and add comments & skills
    await pg.query(
      `
      INSERT INTO public.exam_student_summaries (
        exam_id, enrollment_id, student_id, total_obtained, total_max, percentage,
        annual_weighted_percentage, overall_grade, grade_remark, is_passed, section_rank, class_rank,
        teacher_comment, principal_comment, skill_ratings, published_snapshot
      ) VALUES
        (
          $1, $2, $3, 455.00, 500.00, 91.00, 91.00, 'A1', 'Outstanding', true, 1, 1,
          'Consistent excellence in analytical problem solving and laboratory work.',
          'Exemplary performance. Keep up the dedication!',
          '{"Punctuality & Regularity": 5, "Discipline & Conduct": 5, "Teamwork & Leadership": 5, "Communication Skills": 4, "Analytical Thinking": 5}'::jsonb,
          '{"total_obtained": 455, "total_max": 500, "percentage": 91.00, "overall_grade": "A1", "grade_remark": "Outstanding", "is_passed": true, "section_rank": 1, "class_rank": 1}'::jsonb
        ),
        (
          $1, $4, $5, 455.00, 500.00, 91.00, 91.00, 'A1', 'Outstanding', true, 1, 1,
          'Exceptional command over literature and mathematical reasoning.',
          'Outstanding achievement!',
          '{"Punctuality & Regularity": 5, "Discipline & Conduct": 5, "Teamwork & Leadership": 4, "Communication Skills": 5, "Analytical Thinking": 5}'::jsonb,
          '{"total_obtained": 455, "total_max": 500, "percentage": 91.00, "overall_grade": "A1", "grade_remark": "Outstanding", "is_passed": true, "section_rank": 1, "class_rank": 1}'::jsonb
        ),
        (
          $1, $6, $7, 390.00, 500.00, 78.00, 78.00, 'B1', 'Very Good', true, 3, 3,
          'Good progress across subjects; more practice recommended in trigonometry.',
          'Well done. Aim higher in Term II.',
          '{"Punctuality & Regularity": 4, "Discipline & Conduct": 5, "Teamwork & Leadership": 4, "Communication Skills": 4, "Analytical Thinking": 4}'::jsonb,
          '{"total_obtained": 390, "total_max": 500, "percentage": 78.00, "overall_grade": "B1", "grade_remark": "Very Good", "is_passed": true, "section_rank": 3, "class_rank": 3}'::jsonb
        );
      `,
      [
        examT1Id,
        enrollment2026ByUsername.student,
        studentIdByUsername.student,
        enrollment2026ByUsername.student2,
        studentIdByUsername.student2,
        enrollment2026ByUsername.student3,
        studentIdByUsername.student3,
      ]
    );

    await pg.query(
      `UPDATE public.exams
       SET is_published = true, published_at = now(), published_by = $2,
           config_snapshot = '{"board_code": "CBSE", "version": 1, "pass_percentage": 33.00}'::jsonb
       WHERE id = $1;`,
      [examT1Id, userIdByUsername.admin]
    );
    await pg.query(`UPDATE public.assessment_configs SET is_locked = true WHERE id = $1;`, [cbseConfigId]);
    await pg.query(
      `WITH revision AS (
         INSERT INTO public.exam_result_revisions
           (exam_id, revision_number, source_draft_id, correction_reason, published_by, published_at, exam_snapshot)
         SELECT id, 1, active_draft_id, 'Initial seeded publication', $2, published_at,
           config_snapshot || jsonb_build_object('exam_id', id, 'name', name, 'revision_number', 1)
         FROM public.exams WHERE id=$1
         RETURNING id
       ), revision_students AS (
         INSERT INTO public.exam_result_revision_students(revision_id,exam_id,enrollment_id,student_id,report_snapshot)
         SELECT revision.id,$1,s.enrollment_id,s.student_id,
           public.build_result_revision_student_snapshot($1,s.enrollment_id,revision.id)
         FROM revision CROSS JOIN public.exam_student_summaries s WHERE s.exam_id=$1
       )
       UPDATE public.exams SET current_revision_id=(SELECT id FROM revision),active_draft_id=NULL,draft_reason=NULL WHERE id=$1;`,
      [examT1Id, userIdByUsername.admin]
    );

    // Seed partial/zero/absent marks in Draft Term 2 Exam so teachers/admins can test bulk entry & publication
    await pg.query(
      `INSERT INTO public.mark_entries (exam_id, enrollment_id, student_id, subject_id, component_id, status, marks_obtained, entered_by)
       VALUES
         ($1, $2, $3, $4, $5, 'PRESENT', 19.00, $7),
         ($1, $2, $3, $4, $6, 'PRESENT', 76.00, $7),
         ($1, $8, $9, $4, $5, 'PRESENT', 0.00, $7),
         ($1, $8, $9, $4, $6, 'ABSENT', NULL, $7);`,
      [
        examT2Id,
        enrollment2026ByUsername.student,
        studentIdByUsername.student,
        subjectMap['MATH-10'],
        cbseCompIAId,
        cbseCompWrittenId,
        userIdByUsername.teacher,
        enrollment2026ByUsername.student3,
        studentIdByUsername.student3,
      ]
    );

    // Seed Result PINs
    await pg.query(
      `INSERT INTO public.result_pins (pin_code, academic_year_id, max_uses, created_by)
       VALUES
         ('VBM26-78901-ABCDEF', $1, 5, $2),
         ('VBM26-12345-GHIJKL', $1, 5, $2),
         ('VBM26-55555-XYZ123', $1, 5, $2);`,
      [year2026Id, userIdByUsername.admin]
    );

    console.log('8. Seeding Reusable Time Slots and Class & Exam Timetables...');
    const slotRows = await pg.query(`
      INSERT INTO public.time_slots (label, start_time, end_time, is_break, display_order)
      VALUES
        ('Period 1', '08:30:00', '09:15:00', false, 1),
        ('Period 2', '09:15:00', '10:00:00', false, 2),
        ('Period 3', '10:00:00', '10:45:00', false, 3),
        ('Recess / Tiffin Break', '10:45:00', '11:15:00', true, 4),
        ('Period 4', '11:15:00', '12:00:00', false, 5),
        ('Period 5', '12:00:00', '12:45:00', false, 6),
        ('Period 6', '12:45:00', '13:30:00', false, 7)
      RETURNING id, label, is_break;
    `);
    const p1Id = slotRows.rows[0].id as string;
    const p2Id = slotRows.rows[1].id as string;
    const p3Id = slotRows.rows[2].id as string;
    const p4Id = slotRows.rows[4].id as string;

    const classTtRes = await pg.query(
      `INSERT INTO public.timetables (name, academic_year_id, class_id, section_id, kind, is_active)
       VALUES ('Class X Section A — Weekly Routine (2026-27)', $1, $2, $3, 'CLASS', true)
       RETURNING id;`,
      [year2026Id, classIdByLevel[10], sectionAIdByLevel[10]]
    );
    const classTtId = classTtRes.rows[0].id as string;

    for (let day = 1; day <= 5; day++) {
      await pg.query(
        `INSERT INTO public.timetable_entries (timetable_id, time_slot_id, day_of_week, subject_id, teacher_id, room_no)
         VALUES
           ($1, $2, $6, $7, $11, 'R-1001'),
           ($1, $3, $6, $8, $11, 'Lab-2'),
           ($1, $4, $6, $9, $12, 'R-1001'),
           ($1, $5, $6, $10, $12, 'R-1001');`,
        [
          classTtId,
          p1Id,
          p2Id,
          p3Id,
          p4Id,
          day,
          subjectMap['MATH-10'],
          subjectMap['SCI-10'],
          subjectMap['ENG-10'],
          subjectMap['SST-10'],
          userIdByUsername.teacher,
          userIdByUsername.teacher2,
        ]
      );
    }

    const examTtRes = await pg.query(
      `INSERT INTO public.timetables (name, academic_year_id, class_id, section_id, kind, exam_id, is_active)
       VALUES ('CBSE Class X Term I Exam Schedule', $1, $2, $3, 'EXAM', $4, true)
       RETURNING id;`,
      [year2026Id, classIdByLevel[10], sectionAIdByLevel[10], examT1Id]
    );
    const examTtId = examTtRes.rows[0].id as string;
    await pg.query(
      `INSERT INTO public.timetable_entries (timetable_id, time_slot_id, exam_date, subject_id, teacher_id, room_no)
       VALUES
         ($1, $2, '2026-09-10', $3, $6, 'Hall-A'),
         ($1, $2, '2026-09-12', $4, $6, 'Hall-A'),
         ($1, $2, '2026-09-15', $5, $7, 'Hall-A');`,
      [
        examTtId,
        p1Id,
        subjectMap['MATH-10'],
        subjectMap['SCI-10'],
        subjectMap['ENG-10'],
        userIdByUsername.teacher,
        userIdByUsername.teacher2,
      ]
    );

    console.log('9. Seeding Fee Definitions, Student Invoices, Partial Payments, & Receipts...');
    const fee1Res = await pg.query(
      `INSERT INTO public.fee_definitions (academic_year_id, class_id, title, code, description, amount, due_date, is_mandatory)
       VALUES ($1, $2, 'Annual Tuition & Academic Development Fee', 'FEE-2026-TUIT-10', 'Composite annual tuition fee for Class X', 24000.00, '2026-07-15', true)
       RETURNING id;`,
      [year2026Id, classIdByLevel[10]]
    );
    const fee2Res = await pg.query(
      `INSERT INTO public.fee_definitions (academic_year_id, class_id, title, code, description, amount, due_date, is_mandatory)
       VALUES ($1, $2, 'Science & Computer Laboratory Fee', 'FEE-2026-LAB-10', 'Annual practical laboratory & ICT fee', 4500.00, '2026-08-15', true)
       RETURNING id;`,
      [year2026Id, classIdByLevel[10]]
    );
    const fee3Res = await pg.query(
      `INSERT INTO public.fee_definitions (academic_year_id, title, code, description, amount, due_date, is_mandatory)
       VALUES ($1, 'Library & Co-Curricular Activity Fee', 'FEE-2026-LIB-ALL', 'School-wide library and cultural activity fee', 2000.00, '2026-09-01', true)
       RETURNING id;`,
      [year2026Id]
    );
    const feeTuitionId = fee1Res.rows[0].id as string;
    const feeLabId = fee2Res.rows[0].id as string;
    const feeLibId = fee3Res.rows[0].id as string;

    // Invoices for Aarav Roy (student):
    // 1) Tuition Fee: 24,000 total, 10,000 paid (PARTIAL), 14,000 balance
    const inv1Res = await pg.query(
      `INSERT INTO public.student_invoices (
        invoice_no, student_id, enrollment_id, fee_definition_id, academic_year_id,
        title, total_amount, discount_amount, net_amount, amount_paid, balance, status, due_date
      ) VALUES (
        'INV-2026-001001', $1, $2, $3, $4,
        'Annual Tuition & Academic Development Fee', 24000.00, 0.00, 24000.00, 10000.00, 14000.00, 'PARTIAL', '2026-07-15'
      ) RETURNING id;`,
      [studentIdByUsername.student, enrollment2026ByUsername.student, feeTuitionId, year2026Id]
    );
    const inv1Id = inv1Res.rows[0].id as string;

    const tx1Res = await pg.query(
      `INSERT INTO public.payment_transactions (
        invoice_id, student_id, academic_year_id, amount, payment_method, reference_no, idempotency_key, notes, recorded_by, balance_after
      ) VALUES (
        $1, $2, $3, 10000.00, 'UPI', 'UPI-612894012841', 'seed-idem-aarav-tuition-1', 'First installment received via UPI', $4, 14000.00
      ) RETURNING id;`,
      [inv1Id, studentIdByUsername.student, year2026Id, userIdByUsername.accountant]
    );
    await pg.query(
      `INSERT INTO public.payment_receipts (
        receipt_no, transaction_id, invoice_id, student_id, academic_year_id, amount_paid, balance_remaining, payment_method, reference_no, issued_by
      ) VALUES (
        'RCP-2026-005001', $1, $2, $3, $4, 10000.00, 14000.00, 'UPI', 'UPI-612894012841', $5
      );`,
      [tx1Res.rows[0].id, inv1Id, studentIdByUsername.student, year2026Id, userIdByUsername.accountant]
    );

    // 2) Lab Fee: 4,500 total, 4,500 paid (PAID), 0 balance
    const inv2Res = await pg.query(
      `INSERT INTO public.student_invoices (
        invoice_no, student_id, enrollment_id, fee_definition_id, academic_year_id,
        title, total_amount, discount_amount, net_amount, amount_paid, balance, status, due_date
      ) VALUES (
        'INV-2026-001002', $1, $2, $3, $4,
        'Science & Computer Laboratory Fee', 4500.00, 0.00, 4500.00, 4500.00, 0.00, 'PAID', '2026-08-15'
      ) RETURNING id;`,
      [studentIdByUsername.student, enrollment2026ByUsername.student, feeLabId, year2026Id]
    );
    const inv2Id = inv2Res.rows[0].id as string;
    const tx2Res = await pg.query(
      `INSERT INTO public.payment_transactions (
        invoice_id, student_id, academic_year_id, amount, payment_method, reference_no, idempotency_key, notes, recorded_by, balance_after
      ) VALUES (
        $1, $2, $3, 4500.00, 'BANK_TRANSFER', 'NEFT-SBIN0001234', 'seed-idem-aarav-lab-1', 'Full lab fee cleared via NEFT', $4, 0.00
      ) RETURNING id;`,
      [inv2Id, studentIdByUsername.student, year2026Id, userIdByUsername.accountant]
    );
    await pg.query(
      `INSERT INTO public.payment_receipts (
        receipt_no, transaction_id, invoice_id, student_id, academic_year_id, amount_paid, balance_remaining, payment_method, reference_no, issued_by
      ) VALUES (
        'RCP-2026-005002', $1, $2, $3, $4, 4500.00, 0.00, 'BANK_TRANSFER', 'NEFT-SBIN0001234', $5
      );`,
      [tx2Res.rows[0].id, inv2Id, studentIdByUsername.student, year2026Id, userIdByUsername.accountant]
    );

    await pg.query(`SELECT setval('public.receipt_number_seq', 5010, true);`);

    // 3) Library Fee for Aarav Roy (UNPAID 2,000) & Tuition Fee for Diya Sen (UNPAID 24,000)
    await pg.query(
      `INSERT INTO public.student_invoices (
        invoice_no, student_id, enrollment_id, fee_definition_id, academic_year_id,
        title, total_amount, discount_amount, net_amount, amount_paid, balance, status, due_date
      ) VALUES
        ('INV-2026-001003', $1, $2, $3, $4, 'Library & Co-Curricular Activity Fee', 2000.00, 0.00, 2000.00, 0.00, 2000.00, 'UNPAID', '2026-09-01'),
        ('INV-2026-001004', $5, $6, $7, $4, 'Annual Tuition & Academic Development Fee', 24000.00, 0.00, 24000.00, 0.00, 24000.00, 'UNPAID', '2026-07-15');`,
      [
        studentIdByUsername.student,
        enrollment2026ByUsername.student,
        feeLibId,
        year2026Id,
        studentIdByUsername.student2,
        enrollment2026ByUsername.student2,
        feeTuitionId,
      ]
    );

    console.log('10. Seeding Library Catalogue, Individual Copies, Requests, Active & Overdue Loans...');
    const books = [
      {
        title: 'Mathematics Textbook for Class X',
        author: 'NCERT Editorial Board',
        isbn: '978-81-7450-634-4',
        publisher: 'NCERT New Delhi',
        edition: '2025 Edition',
        category: 'Mathematics',
        classId: classIdByLevel[10],
        subjectId: subjectMap['MATH-10'],
        rack: 'Rack A-12',
        copies: ['ACC-2026-001', 'ACC-2026-002', 'ACC-2026-003'],
      },
      {
        title: 'Concepts of Physics (Volume I & II)',
        author: 'Dr. H.C. Verma',
        isbn: '978-81-7709-187-8',
        publisher: 'Bharati Bhawan',
        edition: '2025 Reprint',
        category: 'Science & Physics',
        classId: classIdByLevel[11],
        subjectId: subjectMap['PHY-11'],
        rack: 'Rack B-04',
        copies: ['ACC-2026-004', 'ACC-2026-005'],
      },
      {
        title: 'India’s Struggle for Independence',
        author: 'Bipan Chandra',
        isbn: '978-01-4010-781-4',
        publisher: 'Penguin India',
        edition: 'Revised Edition',
        category: 'History & Social Science',
        classId: classIdByLevel[10],
        subjectId: subjectMap['SST-10'],
        rack: 'Rack C-08',
        copies: ['ACC-2026-006', 'ACC-2026-007'],
      },
      {
        title: 'Gitanjali (Song Offerings)',
        author: 'Rabindranath Tagore',
        isbn: '978-81-7167-676-7',
        publisher: 'Visva-Bharati Publishing',
        edition: 'Centenary Edition',
        category: 'Literature',
        classId: classIdByLevel[10],
        subjectId: subjectMap['ENG-10'],
        rack: 'Rack D-01',
        copies: ['ACC-2026-008', 'ACC-2026-009'],
      },
    ];

    const copyIdByAccession: Record<string, { id: string; bookId: string }> = {};
    for (const b of books) {
      const bRes = await pg.query(
        `INSERT INTO public.library_books (
          title, author, isbn, publisher, edition, category, class_id, subject_id, rack_location, total_copies, available_copies
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id;`,
        [b.title, b.author, b.isbn, b.publisher, b.edition, b.category, b.classId, b.subjectId, b.rack, b.copies.length]
      );
      const bookId = bRes.rows[0].id as string;
      for (const acc of b.copies) {
        const cRes = await pg.query(
          `INSERT INTO public.library_book_copies (book_id, accession_no, barcode, condition, status)
           VALUES ($1, $2, $3, 'Good', 'AVAILABLE') RETURNING id;`,
          [bookId, acc, `BAR-${acc}`]
        );
        copyIdByAccession[acc] = { id: cRes.rows[0].id as string, bookId };
      }
    }

    // Active 14-day loan to Aarav Roy (ACC-2026-001)
    const activeCopy = copyIdByAccession['ACC-2026-001'];
    await pg.query(`UPDATE public.library_book_copies SET status = 'ISSUED' WHERE id = $1;`, [activeCopy.id]);
    await pg.query(
      `INSERT INTO public.library_loans (copy_id, book_id, borrower_id, issued_by, issued_at, due_date, status, remarks)
       VALUES ($1, $2, $3, $4, now() - interval '3 days', CURRENT_DATE + 11, 'ISSUED', 'Issued for Term II preparation');`,
      [activeCopy.id, activeCopy.bookId, userIdByUsername.student, userIdByUsername.librarian]
    );
    await pg.query(`SELECT public.recount_book_copies($1);`, [activeCopy.bookId]);

    // Overdue loan to Rohan Das (ACC-2026-006, due 5 days ago)
    const overdueCopy = copyIdByAccession['ACC-2026-006'];
    await pg.query(`UPDATE public.library_book_copies SET status = 'ISSUED' WHERE id = $1;`, [overdueCopy.id]);
    await pg.query(
      `INSERT INTO public.library_loans (copy_id, book_id, borrower_id, issued_by, issued_at, due_date, status, remarks)
       VALUES ($1, $2, $3, $4, now() - interval '19 days', CURRENT_DATE - 5, 'OVERDUE', 'Project reference loan');`,
      [overdueCopy.id, overdueCopy.bookId, userIdByUsername.student3, userIdByUsername.librarian]
    );
    await pg.query(`SELECT public.recount_book_copies($1);`, [overdueCopy.bookId]);

    // Pending borrow request from Diya Sen
    await pg.query(
      `INSERT INTO public.library_borrow_requests (book_id, requester_id, preferred_copy_id, status, request_note)
       VALUES ($1, $2, $3, 'PENDING', 'Requesting H.C. Verma Physics copy for olympiad practice');`,
      [copyIdByAccession['ACC-2026-004'].bookId, userIdByUsername.student2, copyIdByAccession['ACC-2026-004'].id]
    );

    console.log('11. Seeding Notices, Calendar Events, and Study Materials in Supabase Storage...');
    await pg.query(
      `INSERT INTO public.notices (title, content, category, target_scope, target_roles, target_class_ids, is_pinned, is_published, created_by)
       VALUES
         (
           'Welcome to Academic Session 2026–2027 (April–March)',
           'Classes for the 2026–2027 academic session are underway across Classes I to XII. Parents and students can view timetables, notices, and published assessment results via the portal.',
           'Academic', 'SCHOOL', '{}', '{}', true, true, $1
         ),
         (
           'Class X CBSE Term I Results Published',
           'The CBSE Class X Term I Examination 2026–27 marksheets and tabulation summaries have been published. Students and linked parents may download official PDF report cards.',
           'Examination', 'CLASSES', '{}', ARRAY[$2::uuid], true, true, $1
         ),
         (
           'Faculty Meeting: Board Assessment Rubric Review',
           'All teaching staff are requested to attend the academic council meeting in Conference Hall B on Friday at 2:00 PM to review Term II question paper blueprints.',
           'Academic', 'ROLES', ARRAY['teacher'::public.user_role, 'admin'::public.user_role, 'super_admin'::public.user_role], '{}', false, true, $1
         );`,
      [userIdByUsername.admin, classIdByLevel[10]]
    );

    await pg.query(
      `INSERT INTO public.calendar_events (
        title, description, event_type, start_date, end_date, location, target_scope, academic_year_id, created_by
      ) VALUES
        ('Bengali New Year (Poila Boishakh) Holiday', 'School closed for Poila Boishakh.', 'Holiday', '2026-04-15', '2026-04-15', 'Campus-wide', 'SCHOOL', $1, $2),
        ('Independence Day Flag Hoisting & Cultural Programme', '79th Independence Day celebration at the school quadrangle.', 'Cultural', '2026-08-15', '2026-08-15', 'Main Quadrangle', 'SCHOOL', $1, $2),
        ('Parent-Teacher Meeting (Term I Review)', 'Interactive consultation between parents and subject teachers.', 'PTM', '2026-10-10', '2026-10-10', 'Respective Classrooms', 'SCHOOL', $1, $2),
        ('Durga Puja & Lakshmi Puja Autumn Vacation', 'Annual autumn vacation for all classes.', 'Holiday', '2026-10-17', '2026-10-28', 'Campus-wide', 'SCHOOL', $1, $2),
        ('Annual Athletic & Inter-House Sports Meet', 'Inter-house track and field events for Tagore, Vivekananda, Netaji, and Sarojini Houses.', 'Sports', '2026-12-18', '2026-12-19', 'School Sports Ground', 'SCHOOL', $1, $2);`,
      [year2026Id, userIdByUsername.admin]
    );

    // Upload real PDF study material to private `study-materials` bucket
    const pdfBytes = await generateDemoStudyMaterialPdf();
    const storagePath = `2026-2027/class-10/math-quadratic-trigonometry-notes.pdf`;

    if (!ISOLATED_SEED) {
      const uploadRes = await supabaseAdmin!.storage
        .from('study-materials')
        .upload(storagePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadRes.error) {
        throw new Error(`Failed uploading study material PDF to Supabase Storage: ${uploadRes.error.message}`);
      }
    }

    await pg.query(
      `INSERT INTO public.study_materials (
        title, description, academic_year_id, class_id, section_id, subject_id,
        uploaded_by, file_name, file_path, mime_type, file_size_bytes, is_published
      ) VALUES (
        'Quadratic Equations & Trigonometry — Formulae & Practice Set',
        'Comprehensive revision notes, Sridharacharya formula derivations, and solved board questions for Class X Mathematics.',
        $1, $2, $3, $4, $5,
        'math-quadratic-trigonometry-notes.pdf',
        $6,
        'application/pdf',
        $7,
        true
      );`,
      [
        year2026Id,
        classIdByLevel[10],
        sectionAIdByLevel[10],
        subjectMap['MATH-10'],
        userIdByUsername.teacher,
        storagePath,
        pdfBytes.byteLength,
      ]
    );

    console.log('\n====================================================================');
    console.log('Seed completed successfully! Demo Accounts (Password: School@2026):');
    console.log('--------------------------------------------------------------------');
    for (const u of DEMO_USERS) {
      console.log(`  [${u.role.padEnd(11)}] username: ${u.username.padEnd(11)} | email: ${u.email}`);
    }
    console.log('====================================================================\n');
  } finally {
    await pg.end();
  }
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

export { seed };
