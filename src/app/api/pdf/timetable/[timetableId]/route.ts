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

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function GET(
  _request: Request,
  { params }: { params: { timetableId: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: tt } = await supabase
    .from('timetables')
    .select('*, school_classes(name), sections(name), academic_years(name)')
    .eq('id', params.timetableId)
    .single();

  if (!tt) {
    return NextResponse.json({ error: 'Timetable not found' }, { status: 404 });
  }

  const { data: entries } = await supabase
    .from('timetable_entries')
    .select('*, time_slots(label, start_time, end_time), subjects(name, code), profiles(full_name)')
    .eq('timetable_id', params.timetableId)
    .order('day_of_week', { ascending: true });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 35, y: 760, width: 525, height: 48, color: rgb(0.09, 0.22, 0.45) });
  page.drawText(safePdfText(`OFFICIAL TIMETABLE — ${(tt as any).name}`), {
    x: 48,
    y: 785,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    safePdfText(
      `Class: ${(tt as any).school_classes?.name || ''} (${(tt as any).sections?.name || 'All'}) | Session: ${(tt as any).academic_years?.name || '2026-2027'}`
    ),
    { x: 48, y: 768, size: 9.5, font: fontReg, color: rgb(0.9, 0.94, 1) }
  );

  let y = 735;
  page.drawText('Day / Date', { x: 40, y, size: 10, font: fontBold });
  page.drawText('Time Slot', { x: 145, y, size: 10, font: fontBold });
  page.drawText('Subject', { x: 275, y, size: 10, font: fontBold });
  page.drawText('Teacher', { x: 415, y, size: 10, font: fontBold });
  page.drawText('Room', { x: 515, y, size: 10, font: fontBold });
  y -= 15;

  for (const e of (entries || []) as any[]) {
    const dayOrDate = e.day_of_week ? DAY_NAMES[e.day_of_week] : e.exam_date || '-';
    const slotText = `${e.time_slots?.start_time?.slice(0, 5) || ''}-${e.time_slots?.end_time?.slice(0, 5) || ''}`;
    page.drawText(safePdfText(dayOrDate), { x: 40, y, size: 9, font: fontReg });
    page.drawText(safePdfText(slotText), { x: 145, y, size: 9, font: fontReg });
    page.drawText(safePdfText((e.subjects?.name || '-').slice(0, 24)), { x: 275, y, size: 9, font: fontBold });
    page.drawText(safePdfText((e.profiles?.full_name || '-').slice(0, 20)), { x: 415, y, size: 9, font: fontReg });
    page.drawText(safePdfText(e.room_no || '-'), { x: 515, y, size: 9, font: fontReg });
    y -= 15;
    if (y < 50) break;
  }

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Timetable_${params.timetableId.slice(0, 8)}.pdf"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
