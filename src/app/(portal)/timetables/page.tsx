import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Select,
  Label,
} from '@/components/ui/primitives';
import { ActionForm, PrintButton } from '@/components/ui/action-form';
import { createTimetableEntryAction } from '@/lib/actions/operations';
import { Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function TimetablesPage({
  searchParams,
}: {
  searchParams: { ttId?: string };
}) {
  const profile = await requireAuth();
  const supabase = createClient();

  const [
    { data: timetables },
    { data: timeSlots },
    { data: subjects },
    { data: teachers },
  ] = await Promise.all([
    supabase
      .from('timetables')
      .select('*, school_classes(name), sections(name), academic_years(name)')
      .order('kind', { ascending: true }),
    supabase.from('time_slots').select('*').order('display_order', { ascending: true }),
    supabase.from('subjects').select('*, school_classes(name)').order('code', { ascending: true }),
    supabase.from('profiles').select('id, full_name, username').eq('role', 'teacher'),
  ]);

  const activeTt =
    ((timetables || []) as any[]).find((t) => t.id === searchParams.ttId) ||
    ((timetables || []) as any[])[0];

  const { data: entries } = activeTt
    ? await supabase
        .from('timetable_entries')
        .select('*, time_slots(label, start_time, end_time), subjects(name, code), profiles(full_name)')
        .eq('timetable_id', activeTt.id)
        .order('day_of_week', { ascending: true })
        .order('exam_date', { ascending: true })
    : { data: [] };

  const isAdmin = profile.role === 'super_admin' || profile.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Class & Examination Timetables
          </h2>
          <p className="text-xs text-slate-500">
            Reusable time slots, teacher assignments, and database-enforced teacher double-booking conflict validation.
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <PrintButton label="Print Timetable" />
          {activeTt && (
            <a
              href={`/api/pdf/timetable/${activeTt.id}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
            >
              <Download className="h-3.5 w-3.5" />
              Download Timetable PDF
            </a>
          )}
        </div>
      </div>

      {/* Timetable Selector */}
      <div className="flex flex-wrap gap-2 no-print">
        {((timetables || []) as any[]).map((tt) => (
          <Link
            key={tt.id}
            href={`/timetables?ttId=${tt.id}`}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              tt.id === activeTt?.id
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="font-bold">{tt.name}</div>
            <div className="text-[10px] text-slate-500">
              {tt.kind} · {tt.school_classes?.name} (Sec {tt.sections?.name || 'All'})
            </div>
          </Link>
        ))}
      </div>

      {/* Active Timetable Schedule */}
      {activeTt && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{activeTt.name}</CardTitle>
                <CardDescription>
                  Session {activeTt.academic_years?.name} · {activeTt.school_classes?.name} (Section{' '}
                  {activeTt.sections?.name || 'All'})
                </CardDescription>
              </div>
              <Badge variant="default">{activeTt.kind} TIMETABLE</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-2.5">Day / Exam Date</th>
                    <th className="p-2.5">Time Slot</th>
                    <th className="p-2.5">Subject</th>
                    <th className="p-2.5">Assigned Teacher</th>
                    <th className="p-2.5">Room / Hall</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {((entries || []) as any[]).map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-semibold text-slate-900">
                        {e.day_of_week ? DAY_NAMES[e.day_of_week] : e.exam_date}
                      </td>
                      <td className="p-2.5 font-mono">
                        {e.time_slots?.label} ({e.time_slots?.start_time?.slice(0, 5)}–
                        {e.time_slots?.end_time?.slice(0, 5)})
                      </td>
                      <td className="p-2.5 font-semibold text-blue-900">
                        {e.subjects?.name} ({e.subjects?.code})
                      </td>
                      <td className="p-2.5">{e.profiles?.full_name || '—'}</td>
                      <td className="p-2.5">
                        <Badge variant="outline">{e.room_no || 'R-1001'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reusable Time Slots & Add Entry Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        <Card>
          <CardHeader>
            <CardTitle>Reusable School Time Slots</CardTitle>
            <CardDescription>
              Standard bell schedule shared across classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(timeSlots || []).map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-slate-900">{slot.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600">
                      {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                    </span>
                    {slot.is_break && <Badge variant="warning">Break</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {isAdmin && activeTt && (
          <Card>
            <CardHeader>
              <CardTitle>Schedule Slot Entry (Conflict-Validated)</CardTitle>
              <CardDescription>
                Automatically blocks scheduling if the teacher is already assigned to another class in an overlapping time slot on the same day/date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={createTimetableEntryAction}
                submitLabel="Add Timetable Entry"
                resetOnSuccess
              >
                <input type="hidden" name="timetableId" value={activeTt.id} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ttSlot">Time Slot</Label>
                    <Select id="ttSlot" name="timeSlotId" required>
                      {(timeSlots || [])
                        .filter((s) => !s.is_break)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label} ({s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)})
                          </option>
                        ))}
                    </Select>
                  </div>

                  {activeTt.kind === 'CLASS' ? (
                    <div>
                      <Label htmlFor="ttDay">Day of Week</Label>
                      <Select id="ttDay" name="dayOfWeek" defaultValue="6">
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="ttDate">Exam Date</Label>
                      <Input
                        id="ttDate"
                        name="examDate"
                        type="date"
                        required
                        defaultValue="2026-09-18"
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="ttSubject">Subject</Label>
                    <Select id="ttSubject" name="subjectId" required>
                      {(subjects || [])
                        .filter((s) => s.class_id === activeTt.class_id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="ttTeacher">Teacher</Label>
                    <Select id="ttTeacher" name="teacherId">
                      <option value="">Select Teacher</option>
                      {(teachers || []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} (@{t.username})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="ttRoom">Classroom / Hall</Label>
                    <Input id="ttRoom" name="roomNo" defaultValue="R-1001" />
                  </div>
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
