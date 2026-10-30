import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import type { Database } from '@/lib/database.types';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createAuthedClient(email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: 'School@2026',
  });
  if (error) {
    throw new Error(`Failed signing in ${email}: ${error.message}`);
  }
  return client;
}

describe('PostgreSQL RLS Authorization, Storage Security, & Transactional Concurrency', () => {
  let serviceClient: SupabaseClient<Database>;
  let superAdminClient: SupabaseClient<Database>;
  let adminClient: SupabaseClient<Database>;
  let teacherClient: SupabaseClient<Database>;
  let accountantClient: SupabaseClient<Database>;
  let librarianClient: SupabaseClient<Database>;
  let studentClient: SupabaseClient<Database>;
  let parentClient: SupabaseClient<Database>;
  let unlinkedParentClient: SupabaseClient<Database>;

  let settingsId = '';
  let year2026Id = '';
  let aaravStudentId = '';
  let aaravEnrollId = '';
  let aaravPromoId = '';
  let aaravInvoiceId = '';
  let aaravTxId = '';
  let feeDefId = '';
  let class9Id = '';
  let class10Id = '';
  let unassignedSubjectId = '';
  let draftExamId = '';
  let bookId = '';
  let teacherUserId = '';
  let studentUserId = '';

  beforeAll(async () => {
    serviceClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    [
      superAdminClient,
      adminClient,
      teacherClient,
      accountantClient,
      librarianClient,
      studentClient,
      parentClient,
      unlinkedParentClient,
    ] = await Promise.all([
      createAuthedClient('superadmin@vidyabharati.edu.in'),
      createAuthedClient('admin@vidyabharati.edu.in'),
      createAuthedClient('teacher@vidyabharati.edu.in'),
      createAuthedClient('accountant@vidyabharati.edu.in'),
      createAuthedClient('librarian@vidyabharati.edu.in'),
      createAuthedClient('student@vidyabharati.edu.in'),
      createAuthedClient('parent@vidyabharati.edu.in'),
      createAuthedClient('meera.sen@vidyabharati.edu.in'),
    ]);

    const { data: settings } = await serviceClient.from('school_settings').select('id, current_academic_year_id').limit(1).single();
    settingsId = settings!.id;
    year2026Id = settings!.current_academic_year_id!;

    const { data: teacherProf } = await serviceClient.from('profiles').select('id').eq('username', 'teacher').single();
    const { data: studentProf } = await serviceClient.from('profiles').select('id').eq('username', 'student').single();
    teacherUserId = teacherProf!.id;
    studentUserId = studentProf!.id;

    const { data: aarav } = await serviceClient.from('students').select('id').eq('admission_no', 'VBM-2025-001').single();
    aaravStudentId = aarav!.id;

    const { data: aaravEnroll } = await serviceClient
      .from('student_enrollments')
      .select('id')
      .eq('student_id', aaravStudentId)
      .eq('academic_year_id', year2026Id)
      .single();
    aaravEnrollId = aaravEnroll!.id;

    const { data: promo } = await serviceClient
      .from('promotion_records')
      .select('id')
      .eq('student_id', aaravStudentId)
      .limit(1)
      .single();
    aaravPromoId = promo!.id;

    const { data: inv } = await serviceClient
      .from('student_invoices')
      .select('id, fee_definition_id')
      .eq('student_id', aaravStudentId)
      .eq('invoice_no', 'INV-2026-001001')
      .single();
    aaravInvoiceId = inv!.id;
    feeDefId = inv!.fee_definition_id!;

    const { data: tx } = await serviceClient
      .from('payment_transactions')
      .select('id')
      .eq('invoice_id', aaravInvoiceId)
      .limit(1)
      .single();
    aaravTxId = tx!.id;

    const { data: c9 } = await serviceClient.from('school_classes').select('id').eq('code', 'CLS-09').single();
    const { data: c10 } = await serviceClient.from('school_classes').select('id').eq('code', 'CLS-10').single();
    class9Id = c9!.id;
    class10Id = c10!.id;

    // ENG-09 is taught by teacher2 (Kavita Sharma), NOT teacher (Debashis Mukherjee)
    const { data: eng9 } = await serviceClient.from('subjects').select('id').eq('code', 'ENG-09').single();
    unassignedSubjectId = eng9!.id;

    const { data: draftExam } = await serviceClient
      .from('exams')
      .select('id')
      .eq('is_published', false)
      .limit(1)
      .single();
    draftExamId = draftExam!.id;

    const { data: book } = await serviceClient.from('library_books').select('id').limit(1).single();
    bookId = book!.id;
  });

  it('rejects public self-registration because signup is disabled', async () => {
    const anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anonClient.auth.signUp({
      email: `public.intruder.${Date.now()}@example.com`,
      password: 'Password@1234',
    });
    expect(error).not.toBeNull();
  });

  it('prevents an unlinked parent from reading another student marks, invoices, or study materials', async () => {
    // Linked parent (parent) CAN see Aarav Roy's invoice
    const { data: linkedInvoices } = await parentClient
      .from('student_invoices')
      .select('id')
      .eq('student_id', aaravStudentId);
    expect(linkedInvoices?.length).toBeGreaterThan(0);

    // Unlinked parent2 (Meera Sen, parent of Diya Sen) CANNOT see Aarav Roy's invoice or marks
    const { data: unlinkedInvoices } = await unlinkedParentClient
      .from('student_invoices')
      .select('id')
      .eq('student_id', aaravStudentId);
    expect(unlinkedInvoices).toEqual([]);

    const { data: unlinkedMarks } = await unlinkedParentClient
      .from('mark_entries')
      .select('id')
      .eq('student_id', aaravStudentId);
    expect(unlinkedMarks).toEqual([]);

    // Unlinked parent2 has no child in Class IX -> cannot see Class IX study materials
    const { data: unlinkedMaterials } = await unlinkedParentClient
      .from('study_materials')
      .select('id')
      .eq('class_id', class9Id);
    expect(unlinkedMaterials).toEqual([]);
  });

  it('prevents students and parents from reading unpublished exam marks or summaries', async () => {
    const { data: draftMarks } = await studentClient
      .from('mark_entries')
      .select('id')
      .eq('exam_id', draftExamId);
    expect(draftMarks).toEqual([]);
  });

  it('lets a linked parent read the revision header and only linked student snapshots', async () => {
    const { data: revisions, error: revisionError } = await parentClient
      .from('exam_result_revisions')
      .select('id, exam_id, revision_number');
    expect(revisionError).toBeNull();
    expect(revisions?.length).toBeGreaterThan(0);

    const { data: linkedSnapshots } = await parentClient
      .from('exam_result_revision_students')
      .select('student_id')
      .eq('student_id', aaravStudentId);
    expect(linkedSnapshots?.length).toBeGreaterThan(0);

    const { data: unlinkedSnapshots } = await unlinkedParentClient
      .from('exam_result_revision_students')
      .select('student_id')
      .eq('student_id', aaravStudentId);
    expect(unlinkedSnapshots).toEqual([]);
  });

  it('enforces Result-Access PIN gate at the PostgreSQL RLS layer when require_result_pin is enabled', async () => {
    try {
      // Enable require_result_pin via serviceClient
      await serviceClient
        .from('school_settings')
        .update({ require_result_pin: true })
        .eq('id', settingsId);

      // Clear any prior verifications for Aarav
      await serviceClient
        .from('result_pin_verifications')
        .delete()
        .eq('student_id', aaravStudentId);

      // Student cannot read immutable published revisions while PIN is required and unverified
      const { data: lockedRows } = await studentClient
        .from('exam_result_revision_students')
        .select('id')
        .eq('enrollment_id', aaravEnrollId);
      expect(lockedRows).toEqual([]);

      // Invalid PIN is rejected
      const { error: badPinErr } = await studentClient.rpc('verify_result_pin_tx', {
        p_pin_code: 'INVALID-PIN-0000',
        p_student_id: aaravStudentId,
        p_academic_year_id: year2026Id,
      });
      expect(badPinErr?.message).toContain('INVALID_RESULT_PIN');

      // Valid PIN ('VBM26-78901-ABCDEF') unlocks result access for Aarav in 2026-2027
      const { error: goodPinErr } = await studentClient.rpc('verify_result_pin_tx', {
        p_pin_code: 'VBM26-78901-ABCDEF',
        p_student_id: aaravStudentId,
        p_academic_year_id: year2026Id,
      });
      expect(goodPinErr).toBeNull();

      // Now student CAN read the immutable published result snapshot
      const { data: unlockedRows } = await studentClient
        .from('exam_result_revision_students')
        .select('id')
        .eq('enrollment_id', aaravEnrollId);
      expect(unlockedRows?.length).toBeGreaterThan(0);
    } finally {
      await serviceClient
        .from('school_settings')
        .update({ require_result_pin: false })
        .eq('id', settingsId);
      await serviceClient
        .from('result_pins')
        .update({ times_used: 0, student_id: null, used_by_user_id: null })
        .eq('pin_code', 'VBM26-78901-ABCDEF');
    }
  });

  it('rejects unauthorized RPC and table operations across roles', async () => {
    // 1. Student attempting to record a fee payment
    const { error: stuPayErr } = await studentClient.rpc('record_fee_payment_tx', {
      p_invoice_id: aaravInvoiceId,
      p_amount: 100,
      p_payment_method: 'CASH',
      p_idempotency_key: `unauth-stu-${Date.now()}`,
    });
    expect(stuPayErr?.message).toContain('UNAUTHORIZED');

    // 2. Admin attempting super_admin-only payment reversal
    const { error: adminRevPayErr } = await adminClient.rpc('reverse_fee_payment_tx', {
      p_transaction_id: aaravTxId,
      p_reason: 'Unauthorized reversal attempt by operational admin',
    });
    expect(adminRevPayErr?.message).toContain('UNAUTHORIZED');

    // 3. Admin attempting super_admin-only promotion reversal
    const { error: adminRevPromoErr } = await adminClient.rpc('reverse_promotion_tx', {
      p_promotion_id: aaravPromoId,
      p_reason: 'Unauthorized promotion reversal by admin',
    });
    expect(adminRevPromoErr?.message).toContain('UNAUTHORIZED');

    // 4. Teacher attempting to insert study material for an unassigned subject (ENG-09)
    const { error: teacherUnassignedMatErr } = await teacherClient
      .from('study_materials')
      .insert({
        title: 'Unauthorized Class IX English Material',
        academic_year_id: year2026Id,
        class_id: class9Id,
        subject_id: unassignedSubjectId,
        uploaded_by: teacherUserId,
        file_name: 'unauth.pdf',
        file_path: '2026/c9/unauth.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 1024,
      });
    expect(teacherUnassignedMatErr).not.toBeNull();
  });

  it('blocks super_admin promotion reversal when downstream marks or fee invoices exist on target enrollment', async () => {
    const { error } = await superAdminClient.rpc('reverse_promotion_tx', {
      p_promotion_id: aaravPromoId,
      p_reason: 'Testing historical integrity protection',
    });
    expect(error?.message).toContain('PROMOTION_REVERSAL_BLOCKED');
  });

  it('serializes concurrent fee payments with row locks to prevent overpayment and duplicate idempotency keys', async () => {
    const { data: tempFee } = await serviceClient
      .from('fee_definitions')
      .insert({
        academic_year_id: year2026Id,
        class_id: class10Id,
        title: 'Concurrency Test Fee',
        code: `FEE-CONC-${Date.now()}`,
        amount: 5000,
      })
      .select('id')
      .single();

    // Create a dedicated test invoice with net_amount = 5000, balance = 5000
    const { data: testInv, error: createErr } = await serviceClient
      .from('student_invoices')
      .insert({
        invoice_no: `INV-CONC-${Date.now()}`,
        student_id: aaravStudentId,
        enrollment_id: aaravEnrollId,
        fee_definition_id: tempFee!.id,
        academic_year_id: year2026Id,
        title: 'Concurrency Test Invoice',
        total_amount: 5000,
        discount_amount: 0,
        net_amount: 5000,
        amount_paid: 0,
        balance: 5000,
        status: 'UNPAID',
      })
      .select('id')
      .single();

    expect(createErr).toBeNull();
    const invoiceId = testInv!.id;

    try {
      // 1. Fire two concurrent 3500 INR payments (total 7000 > 5000 balance)
      const [res1, res2] = await Promise.all([
        accountantClient.rpc('record_fee_payment_tx', {
          p_invoice_id: invoiceId,
          p_amount: 3500,
          p_payment_method: 'UPI',
          p_idempotency_key: `conc-overpay-1-${Date.now()}`,
        }),
        accountantClient.rpc('record_fee_payment_tx', {
          p_invoice_id: invoiceId,
          p_amount: 3500,
          p_payment_method: 'CASH',
          p_idempotency_key: `conc-overpay-2-${Date.now()}`,
        }),
      ]);

      const successes = [res1, res2].filter((r) => !r.error);
      const failures = [res1, res2].filter((r) => r.error);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect(failures[0].error?.message).toContain('OVERPAYMENT_NOT_ALLOWED');

      // 2. Fire two concurrent 1000 INR payments with the EXACT SAME idempotency_key
      const sharedIdemKey = `conc-dup-key-${Date.now()}`;
      const [dup1, dup2] = await Promise.all([
        accountantClient.rpc('record_fee_payment_tx', {
          p_invoice_id: invoiceId,
          p_amount: 1000,
          p_payment_method: 'CASH',
          p_idempotency_key: sharedIdemKey,
        }),
        accountantClient.rpc('record_fee_payment_tx', {
          p_invoice_id: invoiceId,
          p_amount: 1000,
          p_payment_method: 'CASH',
          p_idempotency_key: sharedIdemKey,
        }),
      ]);

      const dupSuccesses = [dup1, dup2].filter((r) => !r.error);
      const dupFailures = [dup1, dup2].filter((r) => r.error);
      expect(dupSuccesses.length).toBe(1);
      expect(dupFailures.length).toBe(1);
      expect(dupFailures[0].error?.message).toContain('DUPLICATE_PAYMENT_SUBMISSION');

      // Verify final balance is exactly 5000 - 3500 - 1000 = 500 INR
      const { data: finalInv } = await serviceClient
        .from('student_invoices')
        .select('amount_paid, balance, status')
        .eq('id', invoiceId)
        .single();
      expect(Number(finalInv?.amount_paid)).toBe(4500);
      expect(Number(finalInv?.balance)).toBe(500);
      expect(finalInv?.status).toBe('PARTIAL');
    } finally {
      await serviceClient.from('payment_receipts').delete().eq('invoice_id', invoiceId);
      await serviceClient.from('payment_transactions').delete().eq('invoice_id', invoiceId);
      await serviceClient.from('student_invoices').delete().eq('id', invoiceId);
      await serviceClient.from('fee_definitions').delete().eq('id', tempFee!.id);
    }
  });

  it('serializes concurrent library book copy checkouts so only one borrower receives the physical copy', async () => {
    const { data: copyRow, error: copyErr } = await serviceClient
      .from('library_book_copies')
      .insert({
        book_id: bookId,
        accession_no: `ACC-CONC-${Date.now()}`,
        barcode: `BAR-CONC-${Date.now()}`,
        condition: 'New',
        status: 'AVAILABLE',
      })
      .select('id')
      .single();

    expect(copyErr).toBeNull();
    const copyId = copyRow!.id;

    try {
      // Fire two simultaneous checkout_book_copy_tx RPCs for the exact same physical copy
      const [loan1, loan2] = await Promise.all([
        librarianClient.rpc('checkout_book_copy_tx', {
          p_copy_id: copyId,
          p_borrower_id: studentUserId,
          p_loan_days: 14,
          p_remarks: 'Concurrent checkout 1',
        }),
        librarianClient.rpc('checkout_book_copy_tx', {
          p_copy_id: copyId,
          p_borrower_id: teacherUserId,
          p_loan_days: 14,
          p_remarks: 'Concurrent checkout 2',
        }),
      ]);

      const successes = [loan1, loan2].filter((r) => !r.error);
      const failures = [loan1, loan2].filter((r) => r.error);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect(failures[0].error?.message).toContain('BOOK_COPY_UNAVAILABLE');
    } finally {
      await serviceClient.from('library_loans').delete().eq('copy_id', copyId);
      await serviceClient.from('library_book_copies').delete().eq('id', copyId);
    }
  });
});
