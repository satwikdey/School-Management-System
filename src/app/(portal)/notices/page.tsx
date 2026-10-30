import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createNoticeAction, createCalendarEventAction } from '@/lib/actions/operations';
import { ActionForm } from '@/components/ui/action-form';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Select,
  Textarea,
  Label,
} from '@/components/ui/primitives';
import { formatDateIN, formatDateTimeIN, ROLE_LABELS } from '@/lib/utils';
import { Bell, Calendar, Pin, Megaphone, MapPin } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NoticesAndCalendarPage() {
  const profile = await requireAuth();
  const supabase = createClient();

  const isAdmin = ['super_admin', 'admin'].includes(profile.role);

  const [
    { data: settings },
    { data: academicYears },
    { data: classes },
    { data: notices },
    { data: events },
  ] = await Promise.all([
    supabase.from('school_settings').select('current_academic_year_id').limit(1).maybeSingle(),
    supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false }),
    supabase.from('school_classes').select('id, name, numeric_level').order('numeric_level'),
    supabase
      .from('notices')
      .select('id, title, content, category, target_scope, target_roles, target_class_ids, is_pinned, published_at, created_at')
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false }),
    supabase
      .from('calendar_events')
      .select('id, title, description, event_type, start_date, end_date, location, target_scope')
      .order('start_date', { ascending: true }),
  ]);

  const currentYearId = settings?.current_academic_year_id || academicYears?.[0]?.id || '';
  const classMap = new Map((classes || []).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bell className="h-6 w-6 text-blue-700" />
          Noticeboard &amp; Academic Calendar
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Targeted announcements and school events (`SCHOOL`, `ROLES`, and `CLASSES` scopes enforced by RLS)
        </p>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-blue-700" />
                Publish Announcement / Circular
              </CardTitle>
              <CardDescription>
                Target the entire school, specific user roles, or a specific class
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={createNoticeAction}
                submitLabel="Publish Notice"
                resetOnSuccess
                className="space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Label htmlFor="notice-title">Headline</Label>
                    <Input
                      id="notice-title"
                      name="title"
                      placeholder="e.g. WBCHSE Semester I Practical Schedule"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="notice-cat">Category</Label>
                    <Select id="notice-cat" name="category" defaultValue="Academic">
                      <option value="Academic">Academic</option>
                      <option value="Examination">Examination</option>
                      <option value="Holiday">Holiday</option>
                      <option value="Fee">Fee</option>
                      <option value="General">General</option>
                      <option value="Emergency">Emergency</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="notice-content">Notice Body</Label>
                  <Textarea
                    id="notice-content"
                    name="content"
                    placeholder="Full circular details and instructions..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="notice-scope">Audience Scope</Label>
                    <Select id="notice-scope" name="targetScope" defaultValue="SCHOOL">
                      <option value="SCHOOL">Whole School</option>
                      <option value="ROLES">Specific Role</option>
                      <option value="CLASSES">Specific Class</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="notice-role">If Role Target</Label>
                    <Select id="notice-role" name="targetRole" defaultValue="">
                      <option value="">-- Select Role --</option>
                      {Object.entries(ROLE_LABELS).map(([roleKey, label]) => (
                        <option key={roleKey} value={roleKey}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="notice-class">If Class Target</Label>
                    <Select id="notice-class" name="targetClassId" defaultValue="">
                      <option value="">-- Select Class --</option>
                      {(classes || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 pt-1">
                  <input type="checkbox" name="isPinned" value="true" className="rounded border-slate-300" />
                  Pin announcement to top of noticeboard
                </label>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-700" />
                Add Academic Calendar Event
              </CardTitle>
              <CardDescription>
                Schedule holidays, examinations, parent-teacher meetings, and cultural events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={createCalendarEventAction}
                submitLabel="Add Calendar Event"
                resetOnSuccess
                className="space-y-3"
              >
                <input type="hidden" name="academicYearId" value={currentYearId} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Label htmlFor="evt-title">Event Title</Label>
                    <Input
                      id="evt-title"
                      name="title"
                      placeholder="e.g. Rabindra Jayanti Celebration"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="evt-type">Event Type</Label>
                    <Select id="evt-type" name="eventType" defaultValue="Academic">
                      <option value="Academic">Academic</option>
                      <option value="Examination">Examination</option>
                      <option value="Holiday">Holiday</option>
                      <option value="PTM">Parent-Teacher Meeting (PTM)</option>
                      <option value="Sports">Sports</option>
                      <option value="Cultural">Cultural</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="evt-start">Start Date</Label>
                    <Input id="evt-start" name="startDate" type="date" required />
                  </div>
                  <div>
                    <Label htmlFor="evt-end">End Date</Label>
                    <Input id="evt-end" name="endDate" type="date" required />
                  </div>
                  <div>
                    <Label htmlFor="evt-loc">Location / Venue</Label>
                    <Input id="evt-loc" name="location" placeholder="Auditorium / Main Campus" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="evt-desc">Event Notes</Label>
                  <Textarea
                    id="evt-desc"
                    name="description"
                    placeholder="Timing, dress code, or special instructions..."
                  />
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Published Notices &amp; Circulars ({(notices || []).length})</CardTitle>
            <CardDescription>
              Announcements visible to your account based on school, role, or class targeting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(notices || []).length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No announcements published yet.</p>
            ) : (
              (notices || []).map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border p-4 space-y-2 ${
                    n.is_pinned ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {n.is_pinned && (
                        <Badge variant="default" className="gap-1">
                          <Pin className="h-3 w-3" />
                          Pinned
                        </Badge>
                      )}
                      <Badge variant="secondary">{n.category}</Badge>
                      <Badge variant="outline">
                        Scope: {n.target_scope}
                        {n.target_scope === 'ROLES' && n.target_roles?.length
                          ? ` (${n.target_roles.join(', ')})`
                          : ''}
                        {n.target_scope === 'CLASSES' && n.target_class_ids?.length
                          ? ` (${n.target_class_ids.map((id) => classMap.get(id) || 'Class').join(', ')})`
                          : ''}
                      </Badge>
                    </div>
                    <span className="text-xs text-slate-500">{formatDateTimeIN(n.published_at)}</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 text-sm">{n.title}</h4>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{n.content}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming Academic Calendar ({(events || []).length})</CardTitle>
            <CardDescription>School-wide and class-targeted key dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(events || []).length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No calendar events scheduled.</p>
            ) : (
              (events || []).map((ev) => (
                <div key={ev.id} className="rounded-lg border border-slate-200 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-900">{ev.title}</span>
                    <Badge
                      variant={
                        ev.event_type === 'Holiday'
                          ? 'success'
                          : ev.event_type === 'Examination'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {ev.event_type}
                    </Badge>
                  </div>
                  {ev.description && <p className="text-xs text-slate-600">{ev.description}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
                    <span>
                      {formatDateIN(ev.start_date)}
                      {ev.end_date !== ev.start_date ? ` – ${formatDateIN(ev.end_date)}` : ''}
                    </span>
                    {ev.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {ev.location}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
