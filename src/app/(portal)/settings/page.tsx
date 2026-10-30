import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateSchoolSettingsAction } from '@/lib/actions/administration';
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
  Label,
  Button,
} from '@/components/ui/primitives';
import { BOARD_LABELS, formatDateTimeIN } from '@/lib/utils';
import { Settings, ShieldAlert, History } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsAndAuditPage({
  searchParams,
}: {
  searchParams?: { action?: string; page?: string };
}) {
  const profile = await requireRole(['super_admin', 'admin']);
  const supabase = createClient();

  const isSuperAdmin = profile.role === 'super_admin';
  const actionFilter = (searchParams?.action || '').trim();
  const page = Math.max(1, Number(searchParams?.page || 1));
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let auditQuery = supabase
    .from('audit_logs')
    .select(
      'id, actor_id, actor_role, action, entity_type, entity_id, reason, after_state, created_at, profiles!audit_logs_actor_id_fkey(full_name, username)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (actionFilter) {
    auditQuery = auditQuery.ilike('action', `%${actionFilter}%`);
  }

  const [{ data: settings }, { data: academicYears }, { data: logs, count: totalLogs }] =
    await Promise.all([
      supabase.from('school_settings').select('*').limit(1).maybeSingle(),
      supabase.from('academic_years').select('id, name, start_date, end_date, is_current').order('start_date', { ascending: false }),
      auditQuery,
    ]);

  const totalPages = Math.max(1, Math.ceil((totalLogs || 0) / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-700" />
          School Settings &amp; Security Audit Log
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Configure Indian localization defaults, academic year, board profile, Result PIN gate, and inspect immutable audit events
        </p>
      </div>

      {settings && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Institutional Configuration ({settings.school_acronym})</CardTitle>
              <CardDescription>
                {isSuperAdmin
                  ? 'Super Administrator access enabled — changes are recorded in the audit log.'
                  : 'Read-only view for Administrators. Only a Super Administrator can modify global school settings.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">Locale: {settings.locale} ({settings.currency_code})</Badge>
              <Badge variant="secondary">Timezone: {settings.timezone}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isSuperAdmin ? (
              <ActionForm
                action={updateSchoolSettingsAction}
                submitLabel="Save School Settings"
                className="space-y-4"
              >
                <input type="hidden" name="settingsId" value={settings.id} />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="set-name">School Name</Label>
                    <Input
                      id="set-name"
                      name="schoolName"
                      defaultValue={settings.school_name}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="set-acro">Acronym</Label>
                    <Input
                      id="set-acro"
                      name="schoolAcronym"
                      defaultValue={settings.school_acronym}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="set-motto">School Motto</Label>
                    <Input
                      id="set-motto"
                      name="schoolMotto"
                      defaultValue={settings.school_motto || ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="set-phone">Official Phone</Label>
                    <Input id="set-phone" name="phone" defaultValue={settings.phone} required />
                  </div>
                  <div>
                    <Label htmlFor="set-email">Official Email</Label>
                    <Input
                      id="set-email"
                      name="email"
                      type="email"
                      defaultValue={settings.email}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="set-addr">Campus Address</Label>
                  <Input id="set-addr" name="address" defaultValue={settings.address} required />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <Label htmlFor="set-board">School Default Board</Label>
                    <Select
                      id="set-board"
                      name="defaultBoardCode"
                      defaultValue={settings.default_board_code}
                    >
                      {Object.entries(BOARD_LABELS).map(([code, label]) => (
                        <option key={code} value={code}>
                          {code} — {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="set-custom-board">Custom Board Name (if CUSTOM)</Label>
                    <Input
                      id="set-custom-board"
                      name="defaultCustomBoardName"
                      defaultValue={settings.default_custom_board_name || ''}
                      placeholder="e.g. Vidya Mandir Autonomous"
                    />
                  </div>
                  <div>
                    <Label htmlFor="set-year">Current Academic Session (Apr–Mar)</Label>
                    <Select
                      id="set-year"
                      name="currentAcademicYearId"
                      defaultValue={settings.current_academic_year_id || ''}
                    >
                      {(academicYears || []).map((ay) => (
                        <option key={ay.id} value={ay.id}>
                          {ay.name} ({ay.start_date} to {ay.end_date})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="set-loan">Default Library Loan Days</Label>
                    <Input
                      id="set-loan"
                      name="defaultLoanDays"
                      type="number"
                      min={1}
                      max={90}
                      defaultValue={settings.default_loan_days}
                      required
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-950">
                      Require Result-Access PIN for Students &amp; Parents
                    </p>
                    <p className="text-xs text-amber-800">
                      When enabled, students and parents must unlock their enrollment with a valid PIN before PostgreSQL RLS returns published exam marks.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-950">
                    <input
                      type="checkbox"
                      name="requireResultPin"
                      value="true"
                      defaultChecked={settings.require_result_pin}
                      className="h-4 w-4 rounded border-amber-400"
                    />
                    Enable PIN Gate
                  </label>
                </div>
              </ActionForm>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">School Name</span>
                  <span className="font-semibold text-slate-900">{settings.school_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Default Board</span>
                  <span className="font-semibold text-slate-900">{settings.default_board_code}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Result PIN Required</span>
                  <span className="font-semibold text-slate-900">
                    {settings.require_result_pin ? 'Enabled' : 'Disabled (Default)'}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-blue-700" />
              Immutable Security &amp; Transaction Audit Log ({totalLogs || 0})
            </CardTitle>
            <CardDescription>
              Tracks admissions, password resets, board versioning, result publications, payments, reversals, promotions, and library circulation
            </CardDescription>
          </div>
          <form method="get" className="flex items-center gap-2">
            <Input
              name="action"
              defaultValue={actionFilter}
              placeholder="Filter action (e.g. PAYMENT)..."
              className="w-52"
            />
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3 font-semibold">Timestamp (IST)</th>
                  <th className="py-2.5 px-3 font-semibold">Actor</th>
                  <th className="py-2.5 px-3 font-semibold">Action</th>
                  <th className="py-2.5 px-3 font-semibold">Entity</th>
                  <th className="py-2.5 px-3 font-semibold">Reason / Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(logs || []).map((log) => {
                  const actor = log.profiles as unknown as {
                    full_name: string;
                    username: string;
                  } | null;
                  const isReversal = log.action.includes('REVERSED');
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {formatDateTimeIN(log.created_at)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">
                          {actor?.full_name || 'System'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {log.actor_role || 'system'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant={isReversal ? 'danger' : 'secondary'}>
                          {isReversal && <ShieldAlert className="h-3 w-3 mr-1" />}
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        <span className="font-mono text-[11px]">{log.entity_type}</span>
                      </td>
                      <td className="py-2.5 px-3 max-w-md truncate text-slate-600">
                        {log.reason ? (
                          <span className="font-medium text-rose-700">Reason: {log.reason} • </span>
                        ) : null}
                        <span className="font-mono text-[11px]">
                          {log.after_state ? JSON.stringify(log.after_state) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={`/settings?action=${encodeURIComponent(actionFilter)}&page=${page - 1}`}
                    className="rounded border border-slate-300 px-2.5 py-1 hover:bg-slate-50"
                  >
                    Previous
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={`/settings?action=${encodeURIComponent(actionFilter)}&page=${page + 1}`}
                    className="rounded border border-slate-300 px-2.5 py-1 hover:bg-slate-50"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
