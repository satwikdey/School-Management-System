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
import { ActionForm } from '@/components/ui/action-form';
import {
  createSubjectAndAssignmentAction,
  updateClassBoardOverrideAction,
} from '@/lib/actions/academics';
import { formatBoardDisplay } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AcademicsPage() {
  const profile = await requireAuth();
  const supabase = createClient();

  const [
    { data: settings },
    { data: classes },
    { data: sections },
    { data: subjects },
    { data: teachers },
    { data: hostels },
    { data: years },
  ] = await Promise.all([
    supabase.from('school_settings').select('*').limit(1).single(),
    supabase.from('school_classes').select('*').order('numeric_level', { ascending: true }),
    supabase.from('sections').select('*, profiles(full_name)').order('name', { ascending: true }),
    supabase
      .from('subjects')
      .select('*, school_classes(name), profiles(full_name)')
      .order('code', { ascending: true }),
    supabase.from('profiles').select('id, full_name, username').eq('role', 'teacher'),
    supabase.from('hostels').select('*').order('name', { ascending: true }),
    supabase.from('academic_years').select('*').eq('is_current', true).limit(1),
  ]);

  const currentYearId = years?.[0]?.id || settings?.current_academic_year_id || '';
  const isAdmin = profile.role === 'super_admin' || profile.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Classes (I–XII), Sections, Subjects & Hostels
        </h2>
        <p className="text-xs text-slate-500">
          School default board: {formatBoardDisplay(settings?.default_board_code, settings?.default_custom_board_name)} · Per-class board overrides, teacher assignments, and residential hostels.
        </p>
      </div>

      {/* Classes 1-12 & Board Overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Classes I to XII — Sections & Board Profile Overrides</CardTitle>
          <CardDescription>
            Each class inherits the school default board ({settings?.default_board_code || 'CBSE'}) unless overridden with CBSE, ICSE, WBBSE, WBCHSE, or Custom.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="p-2.5">Level</th>
                  <th className="p-2.5">Class Name</th>
                  <th className="p-2.5">Stream</th>
                  <th className="p-2.5">Sections</th>
                  <th className="p-2.5">Effective Board Profile</th>
                  {isAdmin && <th className="p-2.5">Override Board Profile</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(classes || []).map((cls) => {
                  const clsSections = ((sections || []) as any[]).filter(
                    (s) => s.class_id === cls.id
                  );
                  const effectiveBoard = cls.board_override
                    ? formatBoardDisplay(cls.board_override, cls.custom_board_name)
                    : `${formatBoardDisplay(settings?.default_board_code, settings?.default_custom_board_name)} (School Default)`;

                  return (
                    <tr key={cls.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono">{cls.code}</td>
                      <td className="p-2.5 font-bold text-slate-900">{cls.name}</td>
                      <td className="p-2.5">{cls.stream}</td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {clsSections.map((sec) => (
                            <Badge key={sec.id} variant="outline">
                              Sec {sec.name} ({sec.profiles?.full_name || 'Unassigned'})
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <Badge variant={cls.board_override ? 'default' : 'secondary'}>
                          {effectiveBoard}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="p-2.5">
                          <ActionForm
                            action={updateClassBoardOverrideAction}
                            submitLabel="Save"
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input type="hidden" name="classId" value={cls.id} />
                            <Select
                              name="boardOverride"
                              defaultValue={cls.board_override || 'DEFAULT'}
                              className="w-36 h-8 text-xs"
                            >
                              <option value="DEFAULT">School Default</option>
                              <option value="CBSE">CBSE</option>
                              <option value="ICSE">ICSE</option>
                              <option value="WBBSE">WBBSE</option>
                              <option value="WBCHSE">WBCHSE</option>
                              <option value="CUSTOM">CUSTOM</option>
                            </Select>
                            <Input
                              name="customBoardName"
                              defaultValue={cls.custom_board_name || ''}
                              placeholder="Custom name (if CUSTOM)"
                              className="w-40 h-8 text-xs"
                            />
                          </ActionForm>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Subjects & Teacher Assignments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Configured Subjects & Subject Teachers ({(subjects || []).length})</CardTitle>
            <CardDescription>
              Subjects mapped to classes and assigned faculty members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5">Subject Name</th>
                    <th className="p-2.5">Class</th>
                    <th className="p-2.5">Practical</th>
                    <th className="p-2.5">Assigned Teacher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {((subjects || []) as any[]).map((sub) => (
                    <tr key={sub.id}>
                      <td className="p-2.5 font-mono font-semibold">{sub.code}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{sub.name}</td>
                      <td className="p-2.5">{sub.school_classes?.name}</td>
                      <td className="p-2.5">
                        <Badge variant={sub.has_practical ? 'success' : 'secondary'}>
                          {sub.has_practical ? 'Theory + Practical' : 'Theory'}
                        </Badge>
                      </td>
                      <td className="p-2.5">{sub.profiles?.full_name || 'Unassigned'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Add Subject & Assign Teacher</CardTitle>
              <CardDescription>
                Create a class subject and assign a teacher for the active session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={createSubjectAndAssignmentAction}
                submitLabel="Create Subject"
                resetOnSuccess
              >
                <input type="hidden" name="academicYearId" value={currentYearId} />
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="subClassId">Class</Label>
                    <Select id="subClassId" name="classId" required>
                      {(classes || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="subName">Subject Name</Label>
                    <Input
                      id="subName"
                      name="name"
                      required
                      placeholder="e.g. Computer Applications"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subCode">Subject Code</Label>
                    <Input
                      id="subCode"
                      name="code"
                      required
                      placeholder="e.g. COMP-10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subTeacher">Assign Teacher</Label>
                    <Select id="subTeacher" name="teacherId">
                      <option value="">Select Teacher</option>
                      {(teachers || []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} (@{t.username})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="subSection">Assign Section (Optional)</Label>
                    <Select id="subSection" name="sectionId">
                      <option value="">All / Default Section</option>
                      {(sections || []).map((s) => {
                        const cls = (classes || []).find((c) => c.id === s.class_id);
                        return (
                          <option key={s.id} value={s.id}>
                            {cls?.name} — Sec {s.name}
                          </option>
                        );
                      })}
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="hasPractical"
                      name="hasPractical"
                      type="checkbox"
                      value="true"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <Label htmlFor="hasPractical" className="mb-0">
                      Includes Practical / Project Component
                    </Label>
                  </div>
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Hostels */}
      <Card>
        <CardHeader>
          <CardTitle>Residential Hostels & Dormitories</CardTitle>
          <CardDescription>
            Student residential blocks managed by the school
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(hostels || []).map((h) => (
              <div
                key={h.id}
                className="rounded-lg border border-slate-200 p-4 space-y-1 bg-slate-50/50"
              >
                <p className="text-sm font-bold text-slate-900">{h.name}</p>
                <p className="text-xs text-slate-600">{h.description}</p>
                <p className="text-[11px] text-slate-500 pt-1">
                  Warden: {h.warden_name || '—'} · Capacity: {h.capacity} beds
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
