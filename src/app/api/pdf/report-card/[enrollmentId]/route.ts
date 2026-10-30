import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createClient } from '@/lib/supabase/server';
import { resolveImmutableResultSummary, type ImmutableSummarySnapshot } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

function safePdfText(input: unknown): string {
  return String(input ?? '')
    .replace(/₹/g, 'INR ')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E]/g, '');
}

export async function GET(
  request: Request,
  { params }: { params: { enrollmentId: string } }
) {
  const supabase = createClient();
  const url = new URL(request.url);
  const examId = url.searchParams.get('examId');
  let revisionId = url.searchParams.get('revisionId');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!revisionId && examId) {
    const { data: exam } = await supabase.from('exams').select('current_revision_id').eq('id', examId).maybeSingle();
    revisionId = exam?.current_revision_id || null;
  }
  if (!revisionId) {
    return NextResponse.json(
      { error: 'A published result revision is required.' },
      { status: 403 }
    );
  }
  const { data: revisionStudent, error } = await supabase
    .from('exam_result_revision_students')
    .select('*, exam_result_revisions(*)')
    .eq('revision_id', revisionId)
    .eq('enrollment_id', params.enrollmentId)
    .maybeSingle();
  if (error || !revisionStudent) {
    return NextResponse.json({ error: 'Report revision not found or access denied.' }, { status: 403 });
  }
  const snapshot = revisionStudent.report_snapshot as any;
  const frozenSummary = snapshot.summary || {};
  const frozenStudent = snapshot.student || {};
  const frozenExam = snapshot.exam || {};
  const summary = {
    ...frozenSummary,
    exam_id: revisionStudent.exam_id,
    exams: {
      is_published: true,
      name: frozenExam.name,
      assessment_configs: { board_code: frozenExam.board_code },
    },
    student_enrollments: {
      roll_no: frozenStudent.roll_no,
      academic_years: { name: frozenStudent.academic_year },
      school_classes: { name: frozenStudent.class_name, code: frozenStudent.class_code },
      sections: { name: frozenStudent.section_name },
      students: {
        admission_no: frozenStudent.admission_no,
        house: frozenStudent.house,
        profiles: { full_name: frozenStudent.full_name, code: frozenStudent.student_code },
      },
    },
  } as any;
  const resolved = resolveImmutableResultSummary({
    isPublished: true,
    totalObtained: Number(summary.total_obtained),
    totalMax: Number(summary.total_max),
    percentage: Number(summary.percentage),
    annualWeightedPercentage: summary.annual_weighted_percentage
      ? Number(summary.annual_weighted_percentage)
      : null,
    overallGrade: summary.overall_grade,
    gradeRemark: summary.grade_remark,
    isPassed: Boolean(summary.is_passed),
    sectionRank: summary.section_rank,
    classRank: summary.class_rank,
    publishedSnapshot: frozenSummary as ImmutableSummarySnapshot,
  });
  const markEntries = (snapshot.marks || []).map((mark: any) => ({
    status: mark.status,
    marks_obtained: mark.marks_obtained,
    subjects: { id: mark.subject_id, name: mark.subject_name, code: mark.subject_code },
    assessment_components: {
      id: mark.component_id,
      code: mark.component_code,
      name: mark.component_name,
      max_marks: mark.component_max_marks,
    },
  }));
  const school = snapshot.school || {};

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Header
  page.drawRectangle({
    x: 35,
    y: 755,
    width: 525,
    height: 55,
    color: rgb(0.09, 0.22, 0.45),
  });
  page.drawText(safePdfText(school?.school_name || 'Vidya Bharati Model Senior Secondary School'), {
    x: 48,
    y: 785,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    safePdfText(
      `OFFICIAL STUDENT PROGRESS REPORT CARD | Academic Year: ${
        summary.student_enrollments?.academic_years?.name || '2026-2027'
      }`
    ),
    {
      x: 48,
      y: 766,
      size: 9.5,
      font: fontReg,
      color: rgb(0.9, 0.94, 1),
    }
  );

  // Student Metadata
  const stName = summary.student_enrollments?.students?.profiles?.full_name || 'Student';
  const admNo = summary.student_enrollments?.students?.admission_no || '-';
  const className = summary.student_enrollments?.school_classes?.name || '-';
  const secName = summary.student_enrollments?.sections?.name || 'A';
  const rollNo = summary.student_enrollments?.roll_no || 1;
  const boardCode = summary.exams?.assessment_configs?.board_code || 'CBSE';
  const examName = summary.exams?.name || 'Term Examination';

  let y = 730;
  const metaLines = [
    `Student Name: ${stName}    |    Admission No: ${admNo}    |    Roll No: ${rollNo}`,
    `Class & Section: ${className} (${secName})    |    Board Profile: ${boardCode} (School-Managed Profile)`,
    `Examination: ${examName}`,
  ];
  for (const line of metaLines) {
    page.drawText(safePdfText(line), { x: 40, y, size: 10, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
    y -= 17;
  }

  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.75, 0.75, 0.75) });
  y -= 20;

  // Subject Aggregation
  const bySubject = new Map<
    string,
    { name: string; code: string; details: string[]; obtained: number; max: number }
  >();
  for (const m of markEntries as any[]) {
    const subId = m.subjects?.id || 'unknown';
    const curr = bySubject.get(subId) || {
      name: m.subjects?.name || 'Subject',
      code: m.subjects?.code || '',
      details: [] as string[],
      obtained: 0,
      max: 0,
    };
    const compMax = Number(m.assessment_components?.max_marks ?? 0);
    const compCode = m.assessment_components?.code || 'COMP';
    curr.max += compMax;
    if (m.status === 'ABSENT') {
      curr.details.push(`${compCode}: AB/${compMax}`);
    } else if (m.status === 'MISSING') {
      curr.details.push(`${compCode}: -/${compMax}`);
    } else {
      const score = Number(m.marks_obtained ?? 0);
      curr.obtained += score;
      curr.details.push(`${compCode}: ${score}/${compMax}`);
    }
    bySubject.set(subId, curr);
  }

  page.drawText('Subject', { x: 40, y, size: 10, font: fontBold });
  page.drawText('Component Breakdown', { x: 225, y, size: 10, font: fontBold });
  page.drawText('Total', { x: 440, y, size: 10, font: fontBold });
  page.drawText('Percent', { x: 500, y, size: 10, font: fontBold });
  y -= 14;

  for (const sub of bySubject.values()) {
    const pct = sub.max > 0 ? ((sub.obtained / sub.max) * 100).toFixed(2) : '0.00';
    page.drawText(safePdfText(sub.name.slice(0, 30)), { x: 40, y, size: 9.5, font: fontReg });
    page.drawText(safePdfText(sub.details.join(', ')), { x: 225, y, size: 9, font: fontReg });
    page.drawText(safePdfText(`${sub.obtained}/${sub.max}`), { x: 440, y, size: 9.5, font: fontBold });
    page.drawText(safePdfText(`${pct}%`), { x: 500, y, size: 9.5, font: fontReg });
    y -= 18;
  }

  y -= 10;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.75, 0.75, 0.75) });
  y -= 22;

  // Overall Summary Box
  page.drawText(
    safePdfText(
      `Grand Total: ${resolved.totalObtained.toFixed(2)} / ${resolved.totalMax.toFixed(2)}   |   Percentage: ${resolved.percentage.toFixed(2)}%   |   Grade: ${resolved.overallGrade} (${resolved.gradeRemark})`
    ),
    { x: 40, y, size: 10.5, font: fontBold, color: rgb(0.08, 0.24, 0.48) }
  );
  y -= 16;
  page.drawText(
    safePdfText(`Published Revision: ${revisionStudent.exam_result_revisions?.revision_number || '-'} (${revisionStudent.exam_result_revisions?.correction_reason || 'Initial publication'})`),
    { x: 40, y, size: 8.5, font: fontReg, color: rgb(0.35, 0.35, 0.35) }
  );
  y -= 18;
  page.drawText(
    safePdfText(
      `Result Status: ${resolved.isPassed ? 'PASSED' : 'NEEDS IMPROVEMENT'}   |   Section Rank: #${resolved.sectionRank}   |   Class Rank: #${resolved.classRank} (Shared Competition Rank)`
    ),
    { x: 40, y, size: 10, font: fontBold }
  );

  if (resolved.annualWeightedPercentage !== null) {
    y -= 18;
    page.drawText(
      safePdfText(`Annual Weighted Percentage: ${resolved.annualWeightedPercentage.toFixed(2)}%`),
      { x: 40, y, size: 10, font: fontReg }
    );
  }

  y -= 26;
  page.drawText(
    safePdfText(`Class Teacher Remarks: ${summary.teacher_comment || 'Good progress.'}`),
    { x: 40, y, size: 9.5, font: fontReg }
  );
  y -= 16;
  page.drawText(
    safePdfText(`Principal Remarks: ${summary.principal_comment || 'Keep striving for excellence.'}`),
    { x: 40, y, size: 9.5, font: fontReg }
  );

  y -= 28;
  page.drawText(
    'Note: Board profile settings represent school-managed assessment templates, not official board certification.',
    { x: 40, y, size: 8, font: fontReg, color: rgb(0.45, 0.45, 0.45) }
  );

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ReportCard_${safePdfText(admNo)}.pdf"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
