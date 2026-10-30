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
} from '@/components/ui/primitives';
import { ActionForm, PrintButton } from '@/components/ui/action-form';
import {
  createFeeDefinitionAndInvoicesAction,
  recordFeePaymentAction,
  reverseFeePaymentAction,
} from '@/lib/actions/operations';
import { formatINR, formatDateIN } from '@/lib/utils';
import { Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function FeesPage() {
  const profile = await requireRole([
    'super_admin',
    'admin',
    'accountant',
    'student',
    'parent',
  ]);
  const supabase = createClient();

  const [
    { data: years },
    { data: classes },
    { data: feeDefs },
    { data: invoices },
    { data: receipts },
    { data: transactions },
  ] = await Promise.all([
    supabase.from('academic_years').select('*').eq('is_current', true).limit(1),
    supabase.from('school_classes').select('*').order('numeric_level', { ascending: true }),
    supabase
      .from('fee_definitions')
      .select('*, school_classes(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('student_invoices')
      .select(
        `
        *,
        students (admission_no, profiles (full_name)),
        student_enrollments (roll_no, school_classes (name), sections (name))
      `
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('payment_receipts')
      .select(
        `
        *,
        student_invoices (invoice_no, title),
        students (admission_no, profiles (full_name))
      `
      )
      .order('issued_at', { ascending: false }),
    supabase
      .from('payment_transactions')
      .select('*')
      .order('paid_at', { ascending: false }),
  ]);

  const currentYearId = years?.[0]?.id || '';
  const canManageFees = ['super_admin', 'admin', 'accountant'].includes(profile.role);
  const unpaidOrPartialInvoices = ((invoices || []) as any[]).filter(
    (inv) => inv.status === 'UNPAID' || inv.status === 'PARTIAL'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Student Fees, Invoices, Partial Payments & Receipts (INR)
          </h2>
          <p className="text-xs text-slate-500">
            Decimal monetary amounts (₹), Cash/UPI/Bank Transfer recording, idempotency protection, overpayment prevention, and audited reversals.
          </p>
        </div>
        <PrintButton label="Print Fee Register" />
      </div>

      {/* Staff Payment Recording & Fee Definition Creation */}
      {canManageFees && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
          <Card className="border-emerald-200">
            <CardHeader>
              <CardTitle>Record Student Fee Payment (Cash / UPI / Bank)</CardTitle>
              <CardDescription>
                Transactional payment recording: prevents duplicate submissions and overpayment, updates balance, and issues a numbered receipt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={recordFeePaymentAction}
                submitLabel="Record Payment & Issue Receipt"
                resetOnSuccess
              >
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={`idem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}
                />
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="payInvoiceId">Select Unpaid / Partial Student Invoice</Label>
                    <Select id="payInvoiceId" name="invoiceId" required>
                      {unpaidOrPartialInvoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_no} — {inv.students?.profiles?.full_name} ({inv.title}) · Balance: {formatINR(inv.balance)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="payAmount">Amount Paid (INR ₹)</Label>
                      <Input
                        id="payAmount"
                        name="amount"
                        type="number"
                        step="0.01"
                        min={1}
                        required
                        placeholder="e.g. 2000.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="payMethod">Payment Mode</Label>
                      <Select id="payMethod" name="paymentMethod" defaultValue="UPI">
                        <option value="CASH">CASH</option>
                        <option value="UPI">UPI</option>
                        <option value="BANK_TRANSFER">BANK_TRANSFER (NEFT/RTGS/IMPS)</option>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="payRef">Reference / UTR No. (Optional)</Label>
                      <Input
                        id="payRef"
                        name="referenceNo"
                        placeholder="e.g. UPI-4128901241"
                      />
                    </div>
                    <div>
                      <Label htmlFor="payNotes">Remarks (Optional)</Label>
                      <Input
                        id="payNotes"
                        name="notes"
                        placeholder="Installment payment"
                      />
                    </div>
                  </div>
                </div>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Fee Definition & Generate Class Invoices</CardTitle>
              <CardDescription>
                Defines a fee head and automatically generates invoices for all active students in the selected class.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={createFeeDefinitionAndInvoicesAction}
                submitLabel="Create Fee & Generate Invoices"
                resetOnSuccess
              >
                <input type="hidden" name="academicYearId" value={currentYearId} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="feeTitle">Fee Title</Label>
                    <Input
                      id="feeTitle"
                      name="title"
                      required
                      placeholder="e.g. Term II Examination Fee"
                    />
                  </div>
                  <div>
                    <Label htmlFor="feeCode">Fee Code</Label>
                    <Input
                      id="feeCode"
                      name="code"
                      required
                      placeholder="e.g. FEE-2026-EXAM-T2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="feeAmount">Amount (INR ₹)</Label>
                    <Input
                      id="feeAmount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min={1}
                      required
                      placeholder="1500.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="feeClass">Target Class (Optional)</Label>
                    <Select id="feeClass" name="classId">
                      <option value="">All Classes (School-wide)</option>
                      {(classes || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="feeDueDate">Due Date</Label>
                    <Input
                      id="feeDueDate"
                      name="dueDate"
                      type="date"
                      defaultValue="2026-11-15"
                    />
                  </div>
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Student Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Fee Invoices & Balances ({(invoices || []).length})</CardTitle>
          <CardDescription>
            Real-time invoice status (UNPAID, PARTIAL, PAID) with decimal INR precision
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="p-2.5">Invoice No</th>
                  <th className="p-2.5">Student</th>
                  <th className="p-2.5">Class</th>
                  <th className="p-2.5">Fee Head</th>
                  <th className="p-2.5">Net Amount</th>
                  <th className="p-2.5">Paid</th>
                  <th className="p-2.5">Balance</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {((invoices || []) as any[]).map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-semibold">{inv.invoice_no}</td>
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-900">
                        {inv.students?.profiles?.full_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {inv.students?.admission_no}
                      </div>
                    </td>
                    <td className="p-2.5">
                      {inv.student_enrollments?.school_classes?.name} (
                      {inv.student_enrollments?.sections?.name})
                    </td>
                    <td className="p-2.5 font-medium">{inv.title}</td>
                    <td className="p-2.5 font-mono">{formatINR(inv.net_amount)}</td>
                    <td className="p-2.5 font-mono text-emerald-700 font-semibold">
                      {formatINR(inv.amount_paid)}
                    </td>
                    <td className="p-2.5 font-mono text-rose-700 font-semibold">
                      {formatINR(inv.balance)}
                    </td>
                    <td className="p-2.5">
                      <Badge
                        variant={
                          inv.status === 'PAID'
                            ? 'success'
                            : inv.status === 'PARTIAL'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Numbered Payment Receipts & Super Admin Reversals */}
      <Card>
        <CardHeader>
          <CardTitle>Numbered Payment Receipts & Audited Reversals</CardTitle>
          <CardDescription>
            Download official PDF receipts. Corrections are preserved via audited reversals (Super Admin only).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="p-2.5">Receipt No</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Student</th>
                  <th className="p-2.5">Invoice</th>
                  <th className="p-2.5">Method & Ref</th>
                  <th className="p-2.5">Amount Paid</th>
                  <th className="p-2.5">Balance After</th>
                  <th className="p-2.5 no-print">PDF Receipt / Reversal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {((receipts || []) as any[]).map((rcp) => {
                  const tx = (transactions || []).find((t) => t.id === rcp.transaction_id);
                  return (
                    <tr key={rcp.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-slate-900">
                        {rcp.receipt_no}
                        {rcp.is_void && (
                          <Badge variant="danger" className="ml-1.5">
                            VOID
                          </Badge>
                        )}
                      </td>
                      <td className="p-2.5">{formatDateIN(rcp.issued_at, true)}</td>
                      <td className="p-2.5 font-semibold">
                        {rcp.students?.profiles?.full_name} ({rcp.students?.admission_no})
                      </td>
                      <td className="p-2.5">{rcp.student_invoices?.invoice_no}</td>
                      <td className="p-2.5">
                        <Badge variant="outline">{rcp.payment_method}</Badge>{' '}
                        <span className="font-mono text-[11px] text-slate-500">
                          {rcp.reference_no || ''}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-emerald-700">
                        {formatINR(rcp.amount_paid)}
                      </td>
                      <td className="p-2.5 font-mono">{formatINR(rcp.balance_remaining)}</td>
                      <td className="p-2.5 no-print">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/api/pdf/receipt/${rcp.id}`}
                            className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            <Download className="h-3 w-3" />
                            PDF Receipt
                          </a>
                          {profile.role === 'super_admin' && !rcp.is_void && tx && (
                            <ActionForm
                              action={reverseFeePaymentAction}
                              submitLabel="Reverse"
                              submitVariant="danger"
                              className="flex items-center gap-1.5"
                            >
                              <input type="hidden" name="transactionId" value={tx.id} />
                              <Input
                                name="reason"
                                required
                                defaultValue="Duplicate entry reversal"
                                className="h-7 text-xs w-36"
                              />
                            </ActionForm>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Fee Definitions Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Fee Structure ({(feeDefs || []).length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {((feeDefs || []) as any[]).map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-slate-200 p-4 space-y-1 bg-slate-50/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-slate-500">{f.code}</span>
                  <Badge variant="default">
                    {f.school_classes?.name || 'All Classes'}
                  </Badge>
                </div>
                <p className="text-sm font-bold text-slate-900">{f.title}</p>
                <p className="text-base font-bold text-emerald-700">{formatINR(f.amount)}</p>
                <p className="text-[11px] text-slate-500">
                  Due: {formatDateIN(f.due_date)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
