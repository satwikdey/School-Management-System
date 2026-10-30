import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Label,
} from '@/components/ui/primitives';
import { ActionForm } from '@/components/ui/action-form';
import {
  createUserAccountAction,
  adminResetUserPasswordAction,
} from '@/lib/actions/administration';
import { ROLE_LABELS, ROLE_BADGE_STYLES, cn, type UserRole } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const actor = await requireRole(['super_admin', 'admin']);
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*, staff_records(employee_code, designation, department)')
    .order('role', { ascending: true })
    .order('full_name', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Users, Staff & Account Security
        </h2>
        <p className="text-xs text-slate-500">
          Administrator-provisioned accounts across all seven roles. Public registration is disabled.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Create New User / Staff Account</CardTitle>
            <CardDescription>
              {actor.role === 'super_admin'
                ? 'As Super Administrator, you can provision accounts for all 7 roles including Administrator and Super Administrator.'
                : 'As Administrator, you can provision operational accounts (Teacher, Accountant, Librarian, Student, Parent).'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={createUserAccountAction}
              submitLabel="Create Account"
              resetOnSuccess
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    required
                    placeholder="Prof. Suman Bose"
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    required
                    placeholder="suman.bose"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="suman.bose@vidyabharati.edu.in"
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
                  <Label htmlFor="role">Role</Label>
                  <Select id="role" name="role" defaultValue="teacher">
                    {actor.role === 'super_admin' && (
                      <>
                        <option value="super_admin">Super Administrator</option>
                        <option value="admin">Administrator</option>
                      </>
                    )}
                    <option value="teacher">Teacher</option>
                    <option value="accountant">Accountant</option>
                    <option value="librarian">Librarian</option>
                    <option value="parent">Parent</option>
                    <option value="student">Student</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="phone">Phone (+91)</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="+91 98300 00000"
                  />
                </div>
                <div>
                  <Label htmlFor="designation">Designation (Staff)</Label>
                  <Input
                    id="designation"
                    name="designation"
                    placeholder="Assistant Teacher"
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department (Staff)</Label>
                  <Input
                    id="department"
                    name="department"
                    placeholder="Science & Mathematics"
                  />
                </div>
                <div>
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input
                    id="qualification"
                    name="qualification"
                    placeholder="M.Sc., B.Ed."
                  />
                </div>
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Administrator Password Reset</CardTitle>
            <CardDescription>
              Immediately reset the password for a user account and record the action in the audit log.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={adminResetUserPasswordAction}
              submitLabel="Reset User Password"
              submitVariant="secondary"
              resetOnSuccess
            >
              <div className="space-y-3">
                <div>
                  <Label htmlFor="targetUserId">Select Account</Label>
                  <Select id="targetUserId" name="targetUserId" required>
                    {(profiles || [])
                      .filter(
                        (p) =>
                          actor.role === 'super_admin' ||
                          (p.role !== 'super_admin' && p.role !== 'admin')
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} (@{p.username} — {p.role})
                        </option>
                      ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="newPassword">New Password (min 8 chars)</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Enter new password"
                  />
                </div>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>

      {/* Directory of All Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>School User & Staff Directory ({(profiles || []).length})</CardTitle>
          <CardDescription>
            All active accounts across Super Admin, Admin, Teacher, Accountant, Librarian, Student, and Parent roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="p-2.5">Code</th>
                  <th className="p-2.5">Full Name</th>
                  <th className="p-2.5">Username</th>
                  <th className="p-2.5">Email</th>
                  <th className="p-2.5">Role</th>
                  <th className="p-2.5">Designation / Dept</th>
                  <th className="p-2.5">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {((profiles || []) as any[]).map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono text-[11px]">{p.code}</td>
                    <td className="p-2.5 font-semibold text-slate-900">{p.full_name}</td>
                    <td className="p-2.5 text-slate-600">@{p.username}</td>
                    <td className="p-2.5 text-slate-600">{p.email}</td>
                    <td className="p-2.5">
                      <span
                        className={cn(
                          'rounded border px-2 py-0.5 text-[11px] font-semibold',
                          ROLE_BADGE_STYLES[p.role as UserRole]
                        )}
                      >
                        {ROLE_LABELS[p.role as UserRole]}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-600">
                      {p.staff_records?.designation
                        ? `${p.staff_records.designation} (${p.staff_records.department || ''})`
                        : '—'}
                    </td>
                    <td className="p-2.5 text-slate-600">{p.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
