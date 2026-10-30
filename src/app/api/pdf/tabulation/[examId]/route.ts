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
  request: Request,
  { params }: { params: { examId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: exam } = await supabase
    .from('exams')
    .select('*, school_classes(name), academic_years(name), assessment_configs(board_code)')
    .eq('id', params.examId)
    .single();

  if (!exam) {
    return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const revisionId = requestUrl.searchParams.get('revisionId') || (exam as any).current_revision_id;
  if (!revisionId) {
    return NextResponse.json({ error: 'A published result revision is required' }, { status: 403 });
  }
  const { data: revision } = await supabase
    .from('exam_result_revisions')
    .select('*')
    .eq('id', revisionId)
    .eq('exam_id', params.examId)
    .maybeSingle();
  if (!revision) {
    return NextResponse.json({ error: 'Result revision not found or access denied' }, { status: 403 });
  }
  const { data: revisionStudents } = await supabase
    .from('exam_result_revision_students')
    .select('*')
    .eq('revision_id', revisionId);
  const summaries = ((revisionStudents || []) as any[]).map((row) => {
    const snapshot = row.report_snapshot || {};
    const summary = snapshot.summary || {};
    const student = snapshot.student || {};
    return {
      ...summary,
      student_enrollments: {
        roll_no: student.roll_no,
        sections: { name: student.section_name },
        students: { admission_no: student.admission_no, profiles: { full_name: student.full_name } },
      },
    };
  }).sort((a, b) => Number(a.class_rank ?? 999) - Number(b.class_rank ?? 999));

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]); // Landscape A4 for tabulation
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 35, y: 520, width: 770, height: 48, color: rgb(0.09, 0.22, 0.45) });
  page.drawText(
    safePdfText(
      `EXAMINATION TABULATION REGISTER — ${(exam as any).name} (${(exam as any).school_classes?.name || ''})`
    ),
    { x: 48, y: 546, size: 13, font: fontBold, color: rgb(1, 1, 1) }
  );
  page.drawText(
    safePdfText(
      `Academic Year: ${(exam as any).academic_years?.name || '2026-2027'} | Board Profile: ${(exam as any).assessment_configs?.board_code || 'CBSE'}`
    ),
    { x: 48, y: 530, size: 9.5, font: fontReg, color: rgb(0.9, 0.94, 1) }
  );
  page.drawText(
    safePdfText(`Revision ${revision.revision_number}: ${revision.correction_reason}`),
    { x: 500, y: 530, size: 7.5, font: fontReg, color: rgb(0.9, 0.94, 1) }
  );

  let y = 495;
  page.drawText('Roll', { x: 40, y, size: 10, font: fontBold });
  page.drawText('Admission No', { x: 80, y, size: 10, font: fontBold });
  page.drawText('Student Name', { x: 180, y, size: 10, font: fontBold });
  page.drawText('Sec', { x: 360, y, size: 10, font: fontBold });
  page.drawText('Marks Obtained', { x: 410, y, size: 10, font: fontBold });
  page.drawText('Percentage', { x: 520, y, size: 10, font: fontBold });
  page.drawText('Grade', { x: 610, y, size: 10, font: fontBold });
  page.drawText('Result', { x: 670, y, size: 10, font: fontBold });
  page.drawText('Class Rank', { x: 735, y, size: 10, font: fontBold });

  y -= 8;
  page.drawLine({ start: { x: 40, y }, end: { x: 800, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  y -= 18;

  for (const row of (summaries || []) as any[]) {
    const roll = row.student_enrollments?.roll_no ?? '-';
    const adm = row.student_enrollments?.students?.admission_no ?? '-';
    const name = row.student_enrollments?.students?.profiles?.full_name ?? 'Student';
    const sec = row.student_enrollments?.sections?.name ?? 'A';

    page.drawText(safePdfText(roll), { x: 40, y, size: 9.5, font: fontReg });
    page.drawText(safePdfText(adm), { x: 80, y, size: 9.5, font: fontReg });
    page.drawText(safePdfText(name), { x: 180, y, size: 9.5, font: fontBold });
    page.drawText(safePdfText(sec), { x: 360, y, size: 9.5, font: fontReg });
    page.drawText(safePdfText(`${Number(row.total_obtained).toFixed(2)} / ${Number(row.total_max).toFixed(2)}`), {
      x: 410,
      y,
      size: 9.5,
      font: fontReg,
    });
    page.drawText(safePdfText(`${Number(row.percentage).toFixed(2)}%`), {
      x: 520,
      y,
      size: 9.5,
      font: fontBold,
    });
    page.drawText(safePdfText(row.overall_grade || '-'), { x: 610, y, size: 9.5, font: fontBold });
    page.drawText(safePdfText(row.is_passed ? 'PASS' : 'FAIL'), { x: 670, y, size: 9.5, font: fontReg });
    page.drawText(safePdfText(`#${row.class_rank ?? '-'}`), { x: 735, y, size: 9.5, font: fontBold });
    y -= 18;
    if (y < 60) break;
  }

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Tabulation_${params.examId.slice(0, 8)}.pdf"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
