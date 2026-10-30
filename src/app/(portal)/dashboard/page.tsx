import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui/primitives';
import { formatINR, formatDateIN, ROLE_LABELS } from '@/lib/utils';
import {
  Users,
  GraduationCap,
  IndianRupee,
  Library,
  Megaphone,
  Calendar,
  Award,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profile = await requireAuth();
  const supabase = createClient();

  const [
    { count: studentCount },
    { count: classCount },
    { data: invoices },
    { data: books },
    { data: loans },
    { data: notices },
    { data: events },
    { data: myParentLinks },
    { data: myEnrollments },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('school_classes').select('*', { count: 'exact', head: true }),
    supabase.from('student_invoices').select('id, title, net_amount, amount_paid, balance, status, student_id'),
    supabase.from('library_books').select('total_copies, available_copies'),
    supabase.from('library_loans').select('id, due_date, returned_at, status'),
    supabase.from('notices').select('*').order('is_pinned', { ascending: false }).order('published_at', { ascending: false }).limit(5),
    supabase.from('calendar_events').select('*').order('start_date', { ascending: true }).limit(5),
    profile.role === 'parent'
      ? supabase
          .from('parent_student_links')
          .select(
            `
            relationship,
            students (
              id,
              admission_no,
              house,
              profiles (full_name),
              student_enrollments (
                id,
                roll_no,
                status,
                academic_years (name, is_current),
                school_classes (name, board_override),
                sections (name)
              )
            )
          `
          )
          .eq('parent_id', profile.id)
      : Promise.resolve({ data: null }),
    profile.role === 'student'
      ? supabase
          .from('student_enrollments')
          .select(
            `
            id,
            roll_no,
            status,
            academic_years (name, is_current),
            school_classes (name, board_override),
            sections (name),
            students (admission_no, house)
          `
          )
      : Promise.resolve({ data: null }),
  ]);

  const totalBilled = (invoices || []).reduce((acc, inv) => acc + Number(inv.net_amount || 0), 0);
  const totalPaid = (invoices || []).reduce((acc, inv) => acc + Number(inv.amount_paid || 0), 0);
  const totalBalance = (invoices || []).reduce((acc, inv) => acc + Number(inv.balance || 0), 0);

  const totalCopies = (books || []).reduce((acc, b) => acc + Number(b.total_copies || 0), 0);
  const availableCopies = (books || []).reduce((acc, b) => acc + Number(b.available_copies || 0), 0);
  const activeLoans = (loans || []).filter((l) => !l.returned_at);
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueLoans = activeLoans.filter((l) => l.due_date < todayStr);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Welcome back, {profile.full_name}
          </h2>
          <p className="text-xs text-slate-500">
            Role: {ROLE_LABELS[profile.role]} · Code: {profile.code} · Indian Academic Portal (INR / Asia/Kolkata)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/exams"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Examinations & Report Cards
          </Link>
          <Link
            href="/notices"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Megaphone className="h-3.5 w-3.5" />
            Noticeboard & Calendar
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Accessible Students</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{studentCount ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Across {classCount ?? 12} Classes (I–XII)
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">
                {profile.role === 'student' || profile.role === 'parent'
                  ? 'Fee Paid / Total Billed'
                  : 'Fee Collections (INR)'}
              </p>
              <p className="text-xl font-bold text-emerald-700 mt-1">
                {formatINR(totalPaid)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Pending Balance: {formatINR(totalBalance)} (of {formatINR(totalBilled)})
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Library Circulation</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {availableCopies} / {totalCopies}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {activeLoans.length} Active Loans ·{' '}
                <span className={overdueLoans.length > 0 ? 'text-rose-600 font-semibold' : ''}>
                  {overdueLoans.length} Overdue
                </span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <Library className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Academic Boards</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                CBSE · ICSE · WBBSE · WBCHSE
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                + Custom Versioned Profiles
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role-Specific Spotlight Section for Parent or Student */}
      {profile.role === 'parent' && myParentLinks && myParentLinks.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-700" />
              Linked Children — Parent Portal Overview
            </CardTitle>
            <CardDescription>
              Direct access to your linked children&apos;s enrollments, published report cards, fee invoices, and timetables.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(myParentLinks as any[]).map((link, idx) => {
                const st = link.students;
                const enrollments = st?.student_enrollments || [];
                const activeEnroll =
                  enrollments.find((e: any) => e.academic_years?.is_current) || enrollments[0];
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {st?.profiles?.full_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Admission No: {st?.admission_no} · Relationship: {link.relationship}
                        </p>
                      </div>
                      <Badge variant="success">
                        {activeEnroll?.school_classes?.name || 'Enrolled'} (
                        {activeEnroll?.sections?.name || 'A'})
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Link
                        href="/exams"
                        className="inline-flex items-center gap-1 rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        View Report Card <ArrowRight className="h-3 w-3" />
                      </Link>
                      <Link
                        href="/fees"
                        className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        Invoices & Receipts <ArrowRight className="h-3 w-3" />
                      </Link>
                      <Link
                        href="/timetables"
                        className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        Timetable <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {profile.role === 'student' && myEnrollments && myEnrollments.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle>My Academic Enrollment History</CardTitle>
            <CardDescription>
              Your active and historical academic-year enrollments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(myEnrollments as any[]).map((enr) => (
                <div
                  key={enr.id}
                  className="rounded-lg border border-slate-200 bg-white p-3.5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Session {enr.academic_years?.name} — {enr.school_classes?.name} (Section{' '}
                      {enr.sections?.name})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Roll No: {enr.roll_no} · Admission: {enr.students?.admission_no} · House:{' '}
                      {enr.students?.house}
                    </p>
                  </div>
                  <Badge variant={enr.status === 'active' ? 'success' : 'secondary'}>
                    {enr.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notices & Upcoming Calendar Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-blue-700" />
                Recent School Notices
              </CardTitle>
              <CardDescription>
                Targeted announcements visible to your role and classes
              </CardDescription>
            </div>
            <Link href="/notices" className="text-xs font-medium text-blue-700 hover:underline">
              View All
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {(!notices || notices.length === 0) && (
              <p className="text-xs text-slate-500">No active notices found.</p>
            )}
            {(notices || []).map((n) => (
              <div
                key={n.id}
                className="rounded-lg border border-slate-200 p-3.5 space-y-1 bg-slate-50/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">{n.title}</span>
                  <div className="flex items-center gap-1.5">
                    {n.is_pinned && <Badge variant="warning">Pinned</Badge>}
                    <Badge variant="default">{n.category}</Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{n.content}</p>
                <p className="text-[10px] text-slate-400">
                  Published: {formatDateIN(n.published_at)} · Scope: {n.target_scope}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-700" />
                School Academic Calendar (2026–2027)
              </CardTitle>
              <CardDescription>
                Upcoming holidays, examinations, PTMs, and cultural events
              </CardDescription>
            </div>
            <Link href="/notices" className="text-xs font-medium text-blue-700 hover:underline">
              Full Calendar
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {(!events || events.length === 0) && (
              <p className="text-xs text-slate-500">No upcoming events scheduled.</p>
            )}
            {(events || []).map((ev) => (
              <div
                key={ev.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3.5"
              >
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">{ev.title}</p>
                  {ev.description && (
                    <p className="text-xs text-slate-600">{ev.description}</p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Location: {ev.location || 'Main Campus'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline">{ev.event_type}</Badge>
                  <p className="text-[11px] font-medium text-slate-700 mt-1">
                    {formatDateIN(ev.start_date)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
