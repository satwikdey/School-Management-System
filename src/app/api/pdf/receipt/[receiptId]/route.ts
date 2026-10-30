import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function safePdfText(input: unknown): string {
  return String(input ?? '')
    .replace(/₹/g, 'INR ')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E]/g, '');
}

export async function GET(
  _request: Request,
  { params }: { params: { receiptId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: receipt, error } = await supabase
    .from('payment_receipts')
    .select(
      `
      *,
      student_invoices (invoice_no, title, net_amount, amount_paid, balance),
      students (admission_no, profiles (full_name, code)),
      academic_years (name)
    `
    )
    .eq('id', params.receiptId)
    .single();

  if (error || !receipt) {
    return NextResponse.json(
      { error: 'Receipt not found or you are not authorized to view it.' },
      { status: 403 }
    );
  }

  const { data: school } = await supabase.from('school_settings').select('*').limit(1).single();

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 420]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const r = receipt as any;
  page.drawRectangle({ x: 30, y: 345, width: 535, height: 48, color: rgb(0.09, 0.22, 0.45) });
  page.drawText(safePdfText(school?.school_name || 'Vidya Bharati Model Senior Secondary School'), {
    x: 42,
    y: 370,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    safePdfText(`OFFICIAL FEE PAYMENT RECEIPT — ${r.receipt_no}${r.is_void ? ' [VOID / REVERSED]' : ''}`),
    { x: 42, y: 353, size: 10, font: fontReg, color: rgb(0.9, 0.94, 1) }
  );

  let y = 315;
  const lines = [
    `Receipt Number: ${r.receipt_no}     |     Issued At: ${new Date(r.issued_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    `Student Name: ${r.students?.profiles?.full_name || '-'}     |     Admission No: ${r.students?.admission_no || '-'}`,
    `Academic Session: ${r.academic_years?.name || '2026-2027'}     |     Invoice No: ${r.student_invoices?.invoice_no || '-'}`,
    `Fee Head: ${r.student_invoices?.title || '-'}`,
    `Payment Mode: ${r.payment_method}     |     Reference No: ${r.reference_no || 'N/A'}`,
    `--------------------------------------------------------------------------------------------------`,
    `Invoice Net Amount: INR ${Number(r.student_invoices?.net_amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `Amount Paid in This Receipt: INR ${Number(r.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `Remaining Invoice Balance After Receipt: INR ${Number(r.balance_remaining).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
  ];

  for (const line of lines) {
    page.drawText(safePdfText(line), {
      x: 40,
      y,
      size: 10,
      font: line.startsWith('Amount Paid') || line.startsWith('Receipt Number') ? fontBold : fontReg,
      color: rgb(0.12, 0.12, 0.12),
    });
    y -= 22;
  }

  if (r.is_void) {
    page.drawText(safePdfText(`REVERSED / VOID REASON: ${r.void_reason || 'Administrative reversal'}`), {
      x: 40,
      y: y - 5,
      size: 10,
      font: fontBold,
      color: rgb(0.8, 0.1, 0.1),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Receipt_${safePdfText(r.receipt_no)}.pdf"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
