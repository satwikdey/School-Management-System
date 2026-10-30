import { test, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

async function connect() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !['localhost', '127.0.0.1'].includes(new URL(connectionString).hostname)) {
    throw new Error('Verification browser tests require the local demo database.');
  }
  const db = new Client({ connectionString });
  await db.connect();
  return db;
}

async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.getByLabel(/Username or Email Address/i).fill(username);
  await page.getByLabel(/^Password$/i).fill('School@2026');
  await page.getByRole('button', { name: /Sign in to Portal/i }).click();
  await page.waitForURL('**/dashboard');
}

test('unentered marks start as MISSING rather than silently becoming PRESENT zero', async ({ page }) => {
  const db = await connect();
  try {
    const { rows: exams } = await db.query('SELECT * FROM exams WHERE NOT is_published ORDER BY created_at LIMIT 1');
    expect(exams).toHaveLength(1);
    const exam = exams[0];
    const { rows } = await db.query(`
      SELECT s.id FROM subjects s WHERE s.class_id = $1
      AND NOT EXISTS (SELECT 1 FROM mark_entries m WHERE m.subject_id = s.id AND m.exam_id = $2)
      ORDER BY s.code LIMIT 1`, [exam.class_id, exam.id]);
    expect(rows).toHaveLength(1);
    await login(page, 'superadmin');
    await page.goto(`/exams?examId=${exam.id}`);
    const grid = page.locator('form').filter({ has: page.getByRole('button', { name: /Save Subject Marks/ }) });
    await grid.locator('select').first().selectOption(rows[0].id);
    const statuses = await grid.locator('select[aria-label^="Status for"]').evaluateAll(
      nodes => nodes.map(node => (node as HTMLSelectElement).value)
    );
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every(value => value === 'MISSING'), JSON.stringify(statuses)).toBe(true);
  } finally {
    await db.end();
  }
});

test('accountant submits a decimal partial payment and receives a real PDF receipt', async ({ page }) => {
  const db = await connect();
  const feeId = randomUUID();
  const invoiceId = randomUUID();
  try {
    const { rows } = await db.query(`SELECT se.* FROM student_enrollments se
      JOIN students s ON s.id = se.student_id JOIN profiles p ON p.id = s.user_id
      JOIN school_settings st ON st.current_academic_year_id = se.academic_year_id
      WHERE p.username = 'student' LIMIT 1`);
    expect(rows).toHaveLength(1);
    const enrollment = rows[0];
    await db.query(`INSERT INTO fee_definitions (id, academic_year_id, class_id, title, code, amount)
      VALUES ($1, $2, $3, 'Verification Fee', $4, 1000)`,
      [feeId, enrollment.academic_year_id, enrollment.class_id, `QA-${feeId}`]);
    await db.query(`INSERT INTO student_invoices
      (id, invoice_no, student_id, enrollment_id, fee_definition_id, academic_year_id, title, total_amount, net_amount, balance)
      VALUES ($1, $2, $3, $4, $5, $6, 'Verification Invoice', 1000, 1000, 1000)`,
      [invoiceId, `QA-${invoiceId}`, enrollment.student_id, enrollment.id, feeId, enrollment.academic_year_id]);
    await login(page, 'accountant');
    await page.goto('/fees');
    await page.locator('#payInvoiceId').selectOption(invoiceId);
    await page.locator('#payAmount').fill('123.45');
    await page.locator('#payMethod').selectOption('UPI');
    await page.getByRole('button', { name: 'Record Payment & Issue Receipt' }).click();
    await expect(page.getByRole('status')).toContainText('Payment recorded!');
    const { rows: invoices } = await db.query('SELECT amount_paid, balance, status FROM student_invoices WHERE id = $1', [invoiceId]);
    expect(invoices[0]).toEqual({ amount_paid: '123.45', balance: '876.55', status: 'PARTIAL' });
    const { rows: receipts } = await db.query('SELECT id FROM payment_receipts WHERE invoice_id = $1', [invoiceId]);
    expect(receipts).toHaveLength(1);
    const response = await page.request.get(`/api/pdf/receipt/${receipts[0].id}`);
    expect(response.status()).toBe(200);
    expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  } finally {
    await db.query('DELETE FROM audit_logs WHERE entity_id IN (SELECT id::text FROM payment_transactions WHERE invoice_id = $1) OR entity_id = $1::text', [invoiceId]);
    await db.query('DELETE FROM payment_receipts WHERE invoice_id = $1', [invoiceId]);
    await db.query('DELETE FROM payment_transactions WHERE invoice_id = $1', [invoiceId]);
    await db.query('DELETE FROM student_invoices WHERE id = $1', [invoiceId]);
    await db.query('DELETE FROM fee_definitions WHERE id = $1', [feeId]);
    await db.end();
  }
});

test('librarian checks out and returns a physical copy through the forms', async ({ page }) => {
  const db = await connect();
  const bookId = randomUUID();
  const copyId = randomUUID();
  const accession = `QA-${copyId}`;
  try {
    await db.query("INSERT INTO library_books (id, title, author, total_copies, available_copies) VALUES ($1, 'Verification Book', 'Test Fixture', 1, 1)", [bookId]);
    await db.query('INSERT INTO library_book_copies (id, book_id, accession_no) VALUES ($1, $2, $3)', [copyId, bookId, accession]);
    const { rows: borrowers } = await db.query("SELECT id FROM profiles WHERE username = 'student'");
    await login(page, 'librarian');
    await page.goto('/library');
    await page.locator('#chkCopyId').selectOption(copyId);
    await page.locator('#chkBorrower').selectOption(borrowers[0].id);
    await page.getByRole('button', { name: 'Checkout Book Copy' }).click();
    await expect(page.getByRole('status')).toContainText(/checked out|issued|checkout/i);
    const { rows: loans } = await db.query('SELECT id, returned_at, status FROM library_loans WHERE copy_id = $1', [copyId]);
    expect(loans).toHaveLength(1);
    expect(loans[0].status).toBe('ISSUED');
    const returnForm = page.locator('form').filter({ has: page.locator(`input[name="loanId"][value="${loans[0].id}"]`) });
    await returnForm.getByRole('button', { name: 'Record Return' }).click();
    await expect.poll(async () => (await db.query('SELECT status FROM library_book_copies WHERE id = $1', [copyId])).rows[0].status).toBe('AVAILABLE');
    const { rows: returned } = await db.query('SELECT returned_at, status FROM library_loans WHERE copy_id = $1', [copyId]);
    expect(returned[0].returned_at).not.toBeNull();
    expect(returned[0].status).toBe('RETURNED');
  } finally {
    await db.query('DELETE FROM audit_logs WHERE entity_id IN (SELECT id::text FROM library_loans WHERE copy_id = $1) OR entity_id = $1::text OR entity_id = $2::text', [copyId, bookId]);
    await db.query('DELETE FROM library_loans WHERE copy_id = $1', [copyId]);
    await db.query('DELETE FROM library_book_copies WHERE id = $1', [copyId]);
    await db.query('DELETE FROM library_books WHERE id = $1', [bookId]);
    await db.end();
  }
});

test('student email login works and administrative users page stays inaccessible', async ({ page }) => {
  await login(page, 'student@vidyabharati.edu.in');
  await page.goto('/users');
  await expect(page).toHaveURL(/\/dashboard\?error=unauthorized$/);
  await expect(page.getByRole('button', { name: /Create User/ })).toHaveCount(0);
});

test('correction drafts stay staff-only and discard leaves the published revision unchanged', async ({ page }) => {
  const db = await connect();
  let examId = '';
  try {
    const { rows: exams } = await db.query(`SELECT id,current_revision_id FROM exams
      WHERE current_revision_id IS NOT NULL AND active_draft_id IS NULL ORDER BY created_at LIMIT 1`);
    expect(exams).toHaveLength(1);
    examId = exams[0].id;
    const originalRevisionId = exams[0].current_revision_id;
    const { rows: countsBefore } = await db.query(
      'SELECT count(*)::int count FROM exam_result_revisions WHERE exam_id=$1', [examId]
    );

    await login(page, 'admin');
    await page.goto(`/exams?examId=${examId}`);
    await page.locator('#correctionReason').fill('Browser verification correction draft');
    await page.getByRole('button', { name: 'Create Correction Draft' }).click();
    await expect(page.getByText(/Working Draft \(Staff Only\)/i).first()).toBeVisible();

    await page.context().clearCookies();
    await login(page, 'parent');
    await page.goto(`/exams?examId=${examId}`);
    await expect(page.getByText(/Revision 1/i).first()).toBeVisible();
    await expect(page.getByText(/Aarav Roy/i).first()).toBeVisible();
    await expect(page.getByText(/Working Draft \(Staff Only\)/i)).toHaveCount(0);
    const reportHref = await page.locator('a[href^="/api/pdf/report-card/"]').first().getAttribute('href');
    expect(reportHref).toContain(`revisionId=${originalRevisionId}`);
    expect((await page.request.get(reportHref!)).status()).toBe(200);

    await page.context().clearCookies();
    await login(page, 'admin');
    await page.goto(`/exams?examId=${examId}`);
    await page.getByRole('button', { name: 'Discard Correction Draft' }).click();
    await expect.poll(async () => {
      const result = await db.query('SELECT active_draft_id FROM exams WHERE id=$1', [examId]);
      return result.rows[0].active_draft_id;
    }).toBeNull();
    const { rows: finalState } = await db.query(`SELECT current_revision_id,
      (SELECT count(*)::int FROM exam_result_revisions r WHERE r.exam_id=e.id) revision_count
      FROM exams e WHERE id=$1`, [examId]);
    expect(finalState[0].current_revision_id).toBe(originalRevisionId);
    expect(finalState[0].revision_count).toBe(countsBefore[0].count);
  } finally {
    if (examId) {
      const { rows } = await db.query('SELECT active_draft_id FROM exams WHERE id=$1', [examId]);
      if (rows[0]?.active_draft_id) {
        await db.query('BEGIN');
        await db.query("SELECT set_config('request.jwt.claims',(SELECT json_build_object('sub',id,'role','authenticated')::text FROM profiles WHERE username='admin'),true)");
        await db.query('SET LOCAL ROLE authenticated');
        await db.query('SELECT discard_exam_correction_tx($1,$2)', [examId, rows[0].active_draft_id]);
        await db.query('COMMIT');
      }
    }
    await db.end();
  }
});
