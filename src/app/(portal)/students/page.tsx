import { requireRole } from '@/lib/auth';
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
  Button,
} from '@/components/ui/primitives';
import { ActionForm } from '@/components/ui/action-form';
import {
  admitStudentAction,
  linkParentToStudentAction,
  reversePromotionAction,
} from '@/lib/actions/administration';
import { PromotionConsole } from '@/components/students/promotion-console';
import { formatDateIN } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string; classId?: string };
}) {
  const profile = await requireRole([
    'super_admin',
    'admin',
    'teacher',
    'parent',
    'student',
  ]);
  const supabase = createClient();

  const [
    { data: academicYears },
    { data: classes },
    { data: sections },
    { data: hostels },
    { data: parents },
    { data: enrollments },
    { data: promotions },
  ] = await Promise.all([
    supabase.from('academic_years').select('*').order('name', { ascending: true }),
    supabase.from('school_classes').select('*').order('numeric_level', { ascending: true }),
    supabase.from('sections').select('*').order('name', { ascending: true }),
    supabase.from('hostels').select('*').order('name', { ascending: true }),
    supabase.from('profiles').select('id, full_name, username, email').eq('role', 'parent'),
    supabase
      .from('student_enrollments')
      .select(
        `
        *,
        academic_years (name, is_current),
        school_classes (name, numeric_level),
        sections (name),
        students (
          id,
          admission_no,
          house,
          is_graduated,
          hostels (name),
          profiles (id, full_name, username, email, gender, blood_group),
          parent_student_links (
            relationship,
            profiles:parent_id (full_name, phone, email)
          )
        )
      `
      )
      .order('roll_no', { ascending: true }),
    supabase
      .from('promotion_records')
      .select(
        `
        *,
        students (admission_no, profiles (full_name)),
        from_class:from_class_id (name),
        to_class:to_class_id (name),
        from_year:from_academic_year_id (name),
        to_year:to_academic_year_id (name)
      `
      )
      .order('created_at', { ascending: false }),
  ]);

  const currentYear =
    (academicYears || []).find((y) => y.is_current) || (academicYears || [])[0];
  const isAdmin = profile.role === 'super_admin' || profile.role === 'admin';

  const query = (searchParams.q || '').trim().toLowerCase();
  const filterClassId = searchParams.classId || '';

  const filteredEnrollments = ((enrollments || []) as any[]).filter((enr) => {
    if (filterClassId && enr.class_id !== filterClassId) return false;
    if (!query) return true;
    const name = enr.students?.profiles?.full_name?.toLowerCase() || '';
    const adm = enr.students?.admission_no?.toLowerCase() || '';
    return name.includes(query) || adm.includes(query);
  });

  // Deduplicate students for parent link dropdown
  const uniqueStudents = Array.from(
    new Map(
      ((enrollments || []) as any[]).map((e) => [
        e.student_id,
        {
          id: e.student_id,
          name: e.students?.profiles?.full_name || 'Student',
          admNo: e.students?.admission_no || '',
        },
      ])
    ).values()
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Student Enrollment, Parent Links & Promotions
        </h2>
        <p className="text-xs text-slate-500">
          Academic-year enrollment history, admissions, explicit parent–student links, promotions, retentions, graduations, and reversals.
        </p>
      </div>

      {/* Search & Filter Directory */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Enrolled Student Records ({filteredEnrollments.length})</CardTitle>
              <CardDescription>
                Historical and current enrollments preserved per academic year
              </CardDescription>
            </div>
            <form method="GET" className="flex flex-wrap items-center gap-2">
              <Input
                name="q"
                defaultValue={searchParams.q || ''}
                placeholder="Search name or admission no..."
                className="w-56"
              />
              <Select
                name="classId"
                defaultValue={filterClassId}
                className="w-40"
              >
                <option value="">All Classes</option>
                {(classes || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary" size="sm">
                Filter
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="p-2.5">Session</th>
                  <th className="p-2.5">Admission No</th>
                  <th className="p-2.5">Student Name</th>
                  <th className="p-2.5">Class & Sec</th>
                  <th className="p-2.5">Roll</th>
                  <th className="p-2.5">House / Hostel</th>
                  <th className="p-2.5">Linked Parents</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEnrollments.map((enr) => {
                  const st = enr.students;
                  const links = st?.parent_student_links || [];
                  return (
                    <tr key={enr.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium">{enr.academic_years?.name}</td>
                      <td className="p-2.5">
                        <Badge variant="outline">{st?.admission_no}</Badge>
                      </td>
                      <td className="p-2.5">
                        <div className="font-semibold text-slate-900">
                          {st?.profiles?.full_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          @{st?.profiles?.username} · {st?.profiles?.blood_group || 'O+'}
                        </div>
                      </td>
                      <td className="p-2.5 font-medium">
                        {enr.school_classes?.name} ({enr.sections?.name})
                      </td>
                      <td className="p-2.5">#{enr.roll_no}</td>
                      <td className="p-2.5 text-slate-600">
                        {st?.house || 'Tagore House'}
                        {st?.hostels?.name ? ` · ${st.hostels.name}` : ''}
                      </td>
                      <td className="p-2.5">
                        {links.length === 0 ? (
                          <span className="text-slate-400">No parent linked</span>
                        ) : (
                          links.map((lk: any, idx: number) => (
                            <div key={idx} className="text-[11px]">
                              <span className="font-medium text-slate-800">
                                {lk.profiles?.full_name}
                              </span>{' '}
                              <span className="text-slate-500">({lk.relationship})</span>
                            </div>
                          ))
                        )}
                      </td>
                      <td className="p-2.5">
                        <Badge
                          variant={
                            enr.status === 'active'
                              ? 'success'
                              : enr.status === 'promoted'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {enr.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Student Admission Form */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Admit New Student</CardTitle>
                <CardDescription>
                  Creates the student Auth account, profile, academic-year enrollment, and optional parent link in one validated operation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActionForm
                  action={admitStudentAction}
                  submitLabel="Admit Student"
                  resetOnSuccess
                >
                  <input
                    type="hidden"
                    name="academicYearId"
                    value={currentYear?.id || ''}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="fullName">Student Full Name</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        required
                        placeholder="e.g. Anirban Sen"
                      />
                    </div>
                    <div>
                      <Label htmlFor="username">Portal Username</Label>
                      <Input
                        id="username"
                        name="username"
                        required
                        placeholder="e.g. anirban.sen"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Student Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        placeholder="anirban.sen@vidyabharati.edu.in"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Initial Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        defaultValue="School@2026"
                      />
                    </div>
                    <div>
                      <Label htmlFor="admissionNo">Admission Number</Label>
                      <Input
                        id="admissionNo"
                        name="admissionNo"
                        required
                        placeholder="e.g. VBM-2026-045"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rollNo">Roll Number</Label>
                      <Input
                        id="rollNo"
                        name="rollNo"
                        type="number"
                        min={1}
                        required
                        defaultValue={4}
                      />
                    </div>
                    <div>
                      <Label htmlFor="classId">Class (I–XII)</Label>
                      <Select id="classId" name="classId" required>
                        {(classes || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="sectionId">Section</Label>
                      <Select id="sectionId" name="sectionId" required>
                        {(sections || []).map((s) => {
                          const cls = (classes || []).find((c) => c.id === s.class_id);
                          return (
                            <option key={s.id} value={s.id}>
                              {cls?.name} — Section {s.name}
                            </option>
                          );
                        })}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="house">School House</Label>
                      <Input
                        id="house"
                        name="house"
                        defaultValue="Tagore House"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hostelId">Hostel (Optional)</Label>
                      <Select id="hostelId" name="hostelId">
                        <option value="">Day Scholar (No Hostel)</option>
                        {(hostels || []).map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="parentId">Link Parent (Optional)</Label>
                      <Select id="parentId" name="parentId">
                        <option value="">Select Parent Account</option>
                        {(parents || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name} (@{p.username})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="relationship">Relationship</Label>
                      <Select id="relationship" name="relationship" defaultValue="Guardian">
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Guardian">Guardian</option>
                      </Select>
                    </div>
                  </div>
                </ActionForm>
              </CardContent>
            </Card>

            {/* Explicit Parent-Student Linking Form */}
            <Card>
              <CardHeader>
                <CardTitle>Link Parent to Student</CardTitle>
                <CardDescription>
                  Grants a Parent account RLS-verified access to the linked child&apos;s records, results, and fees.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActionForm
                  action={linkParentToStudentAction}
                  submitLabel="Save Parent Link"
                >
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="linkParentId">Parent Account</Label>
                      <Select id="linkParentId" name="parentId" required>
                        {(parents || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name} (@{p.username})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="linkStudentId">Student</Label>
                      <Select id="linkStudentId" name="studentId" required>
                        {uniqueStudents.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.admNo})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="linkRelationship">Relationship</Label>
                      <Select id="linkRelationship" name="relationship" defaultValue="Father">
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Guardian">Guardian</option>
                      </Select>
                    </div>
                  </div>
                </ActionForm>
              </CardContent>
            </Card>
          </div>

          {/* Promotion, Retention, Graduation & Reversal Console */}
          <Card>
            <CardHeader>
              <CardTitle>
                Academic Session Promotion, Retention & Graduation Console
              </CardTitle>
              <CardDescription>
                Preserves historical enrollments and results. Reversals are guarded against invalidating subsequent academic records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <PromotionConsole
                academicYears={academicYears || []}
                classes={classes || []}
                sections={sections || []}
                enrollments={(enrollments || []) as any}
              />

              {/* Promotion History & Super Admin Reversal Table */}
              {promotions && promotions.length > 0 && (
                <div className="pt-4 border-t border-slate-200 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Recorded Promotions & Reversal Controls
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Student</th>
                          <th className="p-2">Transition</th>
                          <th className="p-2">Action</th>
                          <th className="p-2">Status / Reversal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(promotions as any[]).map((pr) => (
                          <tr key={pr.id}>
                            <td className="p-2">{formatDateIN(pr.created_at)}</td>
                            <td className="p-2 font-semibold">
                              {pr.students?.profiles?.full_name} ({pr.students?.admission_no})
                            </td>
                            <td className="p-2">
                              {pr.from_year?.name} ({pr.from_class?.name}) →{' '}
                              {pr.to_year?.name} ({pr.to_class?.name})
                            </td>
                            <td className="p-2">
                              <Badge variant="default">{pr.action}</Badge>
                            </td>
                            <td className="p-2">
                              {pr.is_reversed ? (
                                <Badge variant="danger">
                                  REVERSED ({pr.reversal_reason})
                                </Badge>
                              ) : profile.role === 'super_admin' ? (
                                <ActionForm
                                  action={reversePromotionAction}
                                  submitLabel="Reverse Promotion"
                                  submitVariant="danger"
                                  className="flex items-center gap-2"
                                >
                                  <input type="hidden" name="promotionId" value={pr.id} />
                                  <Input
                                    name="reason"
                                    required
                                    defaultValue="Administrative correction"
                                    className="h-7 text-xs w-44"
                                  />
                                </ActionForm>
                              ) : (
                                <Badge variant="success">ACTIVE</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
