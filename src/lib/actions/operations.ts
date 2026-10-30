'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth, requireRole } from '@/lib/auth';
import type { UserRole } from '@/lib/utils';

// -----------------------------------------------------------------------------
// 1. TIMETABLES
// -----------------------------------------------------------------------------
const createTimetableEntrySchema = z.object({
  timetableId: z.string().uuid(),
  timeSlotId: z.string().uuid(),
  dayOfWeek: z.coerce.number().int().min(1).max(6).optional(),
  examDate: z.string().optional(),
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid().optional().or(z.literal('')),
  roomNo: z.string().trim().optional(),
});

export async function createTimetableEntryAction(formData: FormData) {
  await requireRole(['super_admin', 'admin']);
  const rawDay = formData.get('dayOfWeek');
  const rawDate = formData.get('examDate');

  const parsed = createTimetableEntrySchema.safeParse({
    timetableId: formData.get('timetableId'),
    timeSlotId: formData.get('timeSlotId'),
    dayOfWeek: rawDay ? Number(rawDay) : undefined,
    examDate: rawDate ? String(rawDate) : undefined,
    subjectId: formData.get('subjectId'),
    teacherId: formData.get('teacherId') || '',
    roomNo: formData.get('roomNo') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid timetable entry.' };
  }

  const d = parsed.data;
  const supabase = createClient();
  const { error } = await supabase.from('timetable_entries').insert({
    timetable_id: d.timetableId,
    time_slot_id: d.timeSlotId,
    day_of_week: d.dayOfWeek ?? null,
    exam_date: d.examDate || null,
    subject_id: d.subjectId,
    teacher_id: d.teacherId || null,
    room_no: d.roomNo || 'R-1001',
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/timetables');
  return { success: 'Timetable slot scheduled successfully.' };
}

// -----------------------------------------------------------------------------
// 2. FEES, INVOICES, PAYMENTS, & REVERSALS
// -----------------------------------------------------------------------------
const createFeeDefinitionSchema = z.object({
  academicYearId: z.string().uuid(),
  classId: z.string().uuid().optional().or(z.literal('')),
  title: z.string().trim().min(3),
  code: z.string().trim().min(3),
  amount: z.coerce.number().positive('Fee amount must be greater than zero'),
  dueDate: z.string().optional(),
  description: z.string().trim().optional(),
});

export async function createFeeDefinitionAndInvoicesAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin', 'accountant']);
  const parsed = createFeeDefinitionSchema.safeParse({
    academicYearId: formData.get('academicYearId'),
    classId: formData.get('classId') || '',
    title: formData.get('title'),
    code: formData.get('code'),
    amount: formData.get('amount'),
    dueDate: formData.get('dueDate') || undefined,
    description: formData.get('description') || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid fee definition.' };
  }

  const d = parsed.data;
  const supabase = createClient();

  const { data: feeDef, error: feeErr } = await supabase
    .from('fee_definitions')
    .insert({
      academic_year_id: d.academicYearId,
      class_id: d.classId || null,
      title: d.title,
      code: d.code.toUpperCase(),
      amount: d.amount,
      due_date: d.dueDate || null,
      description: d.description || null,
      is_mandatory: true,
    })
    .select('id')
    .single();

  if (feeErr || !feeDef) {
    return { error: feeErr?.message || 'Failed creating fee definition.' };
  }

  // Generate student invoices for all enrolled students in the target class (or all classes if school-wide)
  let enrollQuery = supabase
    .from('student_enrollments')
    .select('id, student_id, academic_year_id')
    .eq('academic_year_id', d.academicYearId)
    .eq('status', 'active');

  if (d.classId) {
    enrollQuery = enrollQuery.eq('class_id', d.classId);
  }

  const { data: enrollments } = await enrollQuery;
  let invoiceCount = 0;

  if (enrollments && enrollments.length > 0) {
    const invoiceRows = enrollments.map((enr, idx) => ({
      invoice_no: `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}${idx + 1}`,
      student_id: enr.student_id,
      enrollment_id: enr.id,
      fee_definition_id: feeDef.id,
      academic_year_id: enr.academic_year_id,
      title: d.title,
      total_amount: d.amount,
      discount_amount: 0,
      net_amount: d.amount,
      amount_paid: 0,
      balance: d.amount,
      status: 'UNPAID' as const,
      due_date: d.dueDate || null,
    }));

    const { error: invErr } = await supabase.from('student_invoices').insert(invoiceRows);
    if (!invErr) {
      invoiceCount = invoiceRows.length;
    }
  }

  await supabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'FEE_DEFINITION_CREATED',
    entity_type: 'fee_definitions',
    entity_id: feeDef.id,
    after_state: { ...d, generated_invoices: invoiceCount },
  });

  revalidatePath('/fees');
  return {
    success: `Created fee "${d.title}" and generated ${invoiceCount} student invoice(s).`,
  };
}

const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER']),
  referenceNo: z.string().trim().optional(),
  idempotencyKey: z.string().trim().min(4),
  notes: z.string().trim().optional(),
});

export async function recordFeePaymentAction(formData: FormData) {
  await requireRole(['super_admin', 'admin', 'accountant']);
  const parsed = recordPaymentSchema.safeParse({
    invoiceId: formData.get('invoiceId'),
    amount: formData.get('amount'),
    paymentMethod: formData.get('paymentMethod') || 'CASH',
    referenceNo: formData.get('referenceNo') || '',
    idempotencyKey: formData.get('idempotencyKey') || `pay-${Date.now()}`,
    notes: formData.get('notes') || '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid payment parameters.' };
  }

  const d = parsed.data;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('record_fee_payment_tx', {
    p_invoice_id: d.invoiceId,
    p_amount: d.amount,
    p_payment_method: d.paymentMethod,
    p_idempotency_key: d.idempotencyKey,
    p_reference_no: d.referenceNo || undefined,
    p_notes: d.notes || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  const res = data as { receipt_no?: string; balance_remaining?: number };
  revalidatePath('/fees');
  revalidatePath('/dashboard');
  return {
    success: `Payment recorded! Receipt ${res?.receipt_no ?? ''} generated. Remaining balance: ₹${Number(res?.balance_remaining ?? 0).toFixed(2)}.`,
  };
}

const reversePaymentSchema = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().trim().min(3, 'Reversal reason is required'),
});

export async function reverseFeePaymentAction(formData: FormData) {
  await requireRole(['super_admin']);
  const parsed = reversePaymentSchema.safeParse({
    transactionId: formData.get('transactionId'),
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid payment reversal input.' };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc('reverse_fee_payment_tx', {
    p_transaction_id: parsed.data.transactionId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/fees');
  revalidatePath('/settings');
  return { success: 'Payment reversed, receipt voided, and invoice balance restored.' };
}

// -----------------------------------------------------------------------------
// 3. LIBRARY CATALOGUE, REQUESTS, CHECKOUTS, & RETURNS
// -----------------------------------------------------------------------------
const createBookSchema = z.object({
  title: z.string().trim().min(2),
  author: z.string().trim().min(2),
  isbn: z.string().trim().optional(),
  publisher: z.string().trim().optional(),
  category: z.string().trim().default('Academic'),
  rackLocation: z.string().trim().optional(),
  copyCount: z.coerce.number().int().min(1).max(20).default(2),
});

export async function createLibraryBookWithCopiesAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin', 'librarian']);
  const parsed = createBookSchema.safeParse({
    title: formData.get('title'),
    author: formData.get('author'),
    isbn: formData.get('isbn') || undefined,
    publisher: formData.get('publisher') || undefined,
    category: formData.get('category') || 'Academic',
    rackLocation: formData.get('rackLocation') || 'Rack A-01',
    copyCount: formData.get('copyCount') || 2,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid book details.' };
  }

  const d = parsed.data;
  const supabase = createClient();
  const { data: bookRow, error: bookErr } = await supabase
    .from('library_books')
    .insert({
      title: d.title,
      author: d.author,
      isbn: d.isbn || null,
      publisher: d.publisher || null,
      category: d.category,
      rack_location: d.rackLocation,
      total_copies: d.copyCount,
      available_copies: d.copyCount,
    })
    .select('id')
    .single();

  if (bookErr || !bookRow) {
    return { error: bookErr?.message || 'Failed creating book.' };
  }

  const prefix = `ACC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
  const copies = Array.from({ length: d.copyCount }, (_, i) => ({
    book_id: bookRow.id,
    accession_no: `${prefix}-${i + 1}`,
    barcode: `BAR-${prefix}-${i + 1}`,
    condition: 'New',
    status: 'AVAILABLE' as const,
  }));

  const { error: copyErr } = await supabase.from('library_book_copies').insert(copies);
  if (copyErr) {
    return { error: copyErr.message };
  }

  await supabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_role: actor.role,
    action: 'LIBRARY_BOOK_CREATED',
    entity_type: 'library_books',
    entity_id: bookRow.id,
    after_state: { title: d.title, copies: d.copyCount },
  });

  revalidatePath('/library');
  return { success: `Added "${d.title}" with ${d.copyCount} barcoded copy/copies.` };
}

const borrowRequestSchema = z.object({
  bookId: z.string().uuid(),
  requestNote: z.string().trim().max(300).optional(),
});

export async function submitBorrowRequestAction(formData: FormData) {
  const actor = await requireRole(['student', 'teacher', 'admin', 'super_admin', 'librarian']);
  const parsed = borrowRequestSchema.safeParse({
    bookId: formData.get('bookId'),
    requestNote: formData.get('requestNote') || '',
  });

  if (!parsed.success) {
    return { error: 'Invalid book request.' };
  }

  const supabase = createClient();
  const { error } = await supabase.from('library_borrow_requests').insert({
    book_id: parsed.data.bookId,
    requester_id: actor.id,
    status: 'PENDING',
    request_note: parsed.data.requestNote || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/library');
  return { success: 'Borrow request submitted to the Librarian.' };
}

const reviewBorrowRequestSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().optional(),
});

export async function reviewBorrowRequestAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin', 'librarian']);
  const parsed = reviewBorrowRequestSchema.safeParse({
    requestId: formData.get('requestId'),
    status: formData.get('status'),
    reviewNote: formData.get('reviewNote') || '',
  });

  if (!parsed.success) {
    return { error: 'Invalid borrow request review.' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('library_borrow_requests')
    .update({
      status: parsed.data.status,
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      review_note: parsed.data.reviewNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.requestId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/library');
  return { success: `Borrow request marked as ${parsed.data.status}.` };
}

const checkoutCopySchema = z.object({
  copyId: z.string().uuid(),
  borrowerId: z.string().uuid(),
  requestId: z.string().uuid().optional().or(z.literal('')),
  loanDays: z.coerce.number().int().min(1).max(90).default(14),
  remarks: z.string().trim().optional(),
});

export async function checkoutBookCopyAction(formData: FormData) {
  await requireRole(['super_admin', 'admin', 'librarian']);
  const parsed = checkoutCopySchema.safeParse({
    copyId: formData.get('copyId'),
    borrowerId: formData.get('borrowerId'),
    requestId: formData.get('requestId') || '',
    loanDays: formData.get('loanDays') || 14,
    remarks: formData.get('remarks') || '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid checkout input.' };
  }

  const d = parsed.data;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('checkout_book_copy_tx', {
    p_copy_id: d.copyId,
    p_borrower_id: d.borrowerId,
    p_request_id: d.requestId || undefined,
    p_loan_days: d.loanDays,
    p_remarks: d.remarks || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  const res = data as { accession_no?: string; due_date?: string };
  revalidatePath('/library');
  revalidatePath('/dashboard');
  return {
    success: `Issued copy ${res?.accession_no ?? ''} (Due: ${res?.due_date ?? '14 days'}).`,
  };
}

const returnCopySchema = z.object({
  loanId: z.string().uuid(),
  returnCondition: z.enum(['New', 'Good', 'Fair', 'Damaged']).default('Good'),
  remarks: z.string().trim().optional(),
});

export async function returnBookCopyAction(formData: FormData) {
  await requireRole(['super_admin', 'admin', 'librarian']);
  const parsed = returnCopySchema.safeParse({
    loanId: formData.get('loanId'),
    returnCondition: formData.get('returnCondition') || 'Good',
    remarks: formData.get('remarks') || '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid return input.' };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc('return_book_copy_tx', {
    p_loan_id: parsed.data.loanId,
    p_return_condition: parsed.data.returnCondition,
    p_remarks: parsed.data.remarks || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/library');
  revalidatePath('/dashboard');
  return { success: 'Book copy returned and marked AVAILABLE.' };
}

// -----------------------------------------------------------------------------
// 4. NOTICES, CALENDAR, & STUDY MATERIALS
// -----------------------------------------------------------------------------
const createNoticeSchema = z.object({
  title: z.string().trim().min(3),
  content: z.string().trim().min(5),
  category: z.enum(['Academic', 'Examination', 'Holiday', 'Fee', 'General', 'Emergency']),
  targetScope: z.enum(['SCHOOL', 'ROLES', 'CLASSES']),
  targetRole: z.string().optional(),
  targetClassId: z.string().uuid().optional().or(z.literal('')),
  isPinned: z.boolean().default(false),
});

export async function createNoticeAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin']);
  const parsed = createNoticeSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    category: formData.get('category') || 'General',
    targetScope: formData.get('targetScope') || 'SCHOOL',
    targetRole: formData.get('targetRole') || '',
    targetClassId: formData.get('targetClassId') || '',
    isPinned: formData.get('isPinned') === 'true' || formData.get('isPinned') === 'on',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid notice details.' };
  }

  const d = parsed.data;
  const supabase = createClient();
  const { error } = await supabase.from('notices').insert({
    title: d.title,
    content: d.content,
    category: d.category,
    target_scope: d.targetScope,
    target_roles:
      d.targetScope === 'ROLES' && d.targetRole ? [d.targetRole as UserRole] : [],
    target_class_ids:
      d.targetScope === 'CLASSES' && d.targetClassId ? [d.targetClassId] : [],
    is_pinned: d.isPinned,
    is_published: true,
    created_by: actor.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/notices');
  revalidatePath('/dashboard');
  return { success: 'Announcement published.' };
}

const createEventSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional(),
  eventType: z.enum(['Holiday', 'Examination', 'PTM', 'Sports', 'Cultural', 'Academic']),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  location: z.string().trim().optional(),
  targetScope: z.enum(['SCHOOL', 'ROLES', 'CLASSES']).default('SCHOOL'),
  academicYearId: z.string().uuid(),
});

export async function createCalendarEventAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin']);
  const parsed = createEventSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || '',
    eventType: formData.get('eventType') || 'Academic',
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    location: formData.get('location') || 'Main Campus',
    targetScope: formData.get('targetScope') || 'SCHOOL',
    academicYearId: formData.get('academicYearId'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid calendar event.' };
  }

  const d = parsed.data;
  const supabase = createClient();
  const { error } = await supabase.from('calendar_events').insert({
    title: d.title,
    description: d.description || null,
    event_type: d.eventType,
    start_date: d.startDate,
    end_date: d.endDate,
    location: d.location,
    target_scope: d.targetScope,
    academic_year_id: d.academicYearId,
    created_by: actor.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/notices');
  revalidatePath('/dashboard');
  return { success: 'Calendar event added.' };
}

const ALLOWED_MATERIAL_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
];

export async function uploadStudyMaterialAction(formData: FormData) {
  const actor = await requireRole(['super_admin', 'admin', 'teacher']);
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const academicYearId = String(formData.get('academicYearId') || '').trim();
  const classId = String(formData.get('classId') || '').trim();
  const subjectId = String(formData.get('subjectId') || '').trim();
  const file = formData.get('file') as File | null;

  if (!title || !academicYearId || !classId || !subjectId) {
    return { error: 'Title, academic year, class, and subject are required.' };
  }

  if (!file || file.size === 0) {
    return { error: 'Please select a file to upload.' };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { error: 'Study material file size must not exceed 10 MB.' };
  }

  if (!ALLOWED_MATERIAL_MIMES.includes(file.type)) {
    return { error: 'Allowed file types are PDF, DOCX, PPTX, JPEG, and PNG.' };
  }

  const supabase = createClient();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${academicYearId}/${classId}/${Date.now()}-${safeFileName}`;

  const serviceClient = createServiceRoleClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: storageErr } = await serviceClient.storage
    .from('study-materials')
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (storageErr) {
    return { error: `Storage upload failed: ${storageErr.message}` };
  }

  // Insert using user's RLS-bound client so teacher assignment policy is strictly enforced!
  const { error: dbErr } = await supabase.from('study_materials').insert({
    title,
    description: description || null,
    academic_year_id: academicYearId,
    class_id: classId,
    subject_id: subjectId,
    uploaded_by: actor.id,
    file_name: file.name,
    file_path: storagePath,
    mime_type: file.type,
    file_size_bytes: file.size,
    is_published: true,
  });

  if (dbErr) {
    await serviceClient.storage.from('study-materials').remove([storagePath]);
    return { error: dbErr.message };
  }

  revalidatePath('/materials');
  return { success: `Study material "${title}" uploaded successfully.` };
}
