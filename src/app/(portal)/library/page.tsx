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
  createLibraryBookWithCopiesAction,
  submitBorrowRequestAction,
  reviewBorrowRequestAction,
  checkoutBookCopyAction,
  returnBookCopyAction,
} from '@/lib/actions/operations';
import { formatDateIN } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const profile = await requireAuth();
  const supabase = createClient();

  const [
    { data: books },
    { data: copies },
    { data: requests },
    { data: loans },
    { data: borrowers },
  ] = await Promise.all([
    supabase
      .from('library_books')
      .select('*, school_classes(name), subjects(name)')
      .order('title', { ascending: true }),
    supabase
      .from('library_book_copies')
      .select('*, library_books(title)')
      .order('accession_no', { ascending: true }),
    supabase
      .from('library_borrow_requests')
      .select('*, library_books(title), profiles:requester_id(full_name, username, role)')
      .order('created_at', { ascending: false }),
    supabase
      .from('library_loans')
      .select(
        `
        *,
        library_books (title),
        library_book_copies (accession_no, barcode),
        borrower:borrower_id (full_name, username, role)
      `
      )
      .order('issued_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name, username, role')
      .in('role', ['student', 'teacher']),
  ]);

  const isLibrarianOrAdmin = ['super_admin', 'admin', 'librarian'].includes(
    profile.role
  );
  const canRequestBook = ['student', 'teacher', 'admin', 'super_admin', 'librarian'].includes(
    profile.role
  );

  const availableCopies = ((copies || []) as any[]).filter(
    (c) => c.status === 'AVAILABLE'
  );
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Central Library, Copy Circulation & Borrow Requests
        </h2>
        <p className="text-xs text-slate-500">
          Catalogue, individual barcoded copies, student/staff borrowing requests, concurrency-safe checkouts, 14-day default loan duration, returns, and overdue tracking (no automatic fines).
        </p>
      </div>

      {/* Librarian Operations: Issue Copy & Add Book */}
      {isLibrarianOrAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-cyan-200">
            <CardHeader>
              <CardTitle>Issue / Checkout Book Copy (14-Day Default Loan)</CardTitle>
              <CardDescription>
                Uses row-level locking on the physical copy so competing checkouts of the same copy are safely serialized.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={checkoutBookCopyAction}
                submitLabel="Checkout Book Copy"
                resetOnSuccess
              >
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="chkCopyId">Select Available Physical Copy</Label>
                    <Select id="chkCopyId" name="copyId" required>
                      {availableCopies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.accession_no} — {c.library_books?.title} ({c.condition})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="chkBorrower">Borrower (Student / Staff)</Label>
                      <Select id="chkBorrower" name="borrowerId" required>
                        {(borrowers || []).map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.full_name} (@{b.username} · {b.role})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="chkDays">Loan Duration (Days)</Label>
                      <Input
                        id="chkDays"
                        name="loanDays"
                        type="number"
                        min={1}
                        max={90}
                        defaultValue={14}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="chkRemarks">Remarks</Label>
                    <Input
                      id="chkRemarks"
                      name="remarks"
                      placeholder="Standard 14-day academic loan"
                    />
                  </div>
                </div>
              </ActionForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Book & Barcoded Copies to Catalogue</CardTitle>
              <CardDescription>
                Creates a catalogue entry and generates individual physical copy records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={createLibraryBookWithCopiesAction}
                submitLabel="Add Book & Generate Copies"
                resetOnSuccess
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bkTitle">Book Title</Label>
                    <Input
                      id="bkTitle"
                      name="title"
                      required
                      placeholder="e.g. Organic Chemistry Class XII"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bkAuthor">Author</Label>
                    <Input
                      id="bkAuthor"
                      name="author"
                      required
                      placeholder="e.g. Morrison & Boyd"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bkIsbn">ISBN</Label>
                    <Input
                      id="bkIsbn"
                      name="isbn"
                      placeholder="978-81-317-0481-3"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bkCategory">Category</Label>
                    <Input
                      id="bkCategory"
                      name="category"
                      defaultValue="Science & Reference"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bkRack">Rack Location</Label>
                    <Input
                      id="bkRack"
                      name="rackLocation"
                      defaultValue="Rack B-09"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bkCopies">Number of Copies</Label>
                    <Input
                      id="bkCopies"
                      name="copyCount"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={2}
                    />
                  </div>
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Catalogue & Borrow Request Submission */}
      <Card>
        <CardHeader>
          <CardTitle>Library Catalogue & Copy Availability ({(books || []).length} Titles)</CardTitle>
          <CardDescription>
            Students and teachers can submit a borrow request directly from any catalogue title
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="p-2.5">Title & Author</th>
                  <th className="p-2.5">ISBN / Publisher</th>
                  <th className="p-2.5">Category & Rack</th>
                  <th className="p-2.5">Availability</th>
                  {canRequestBook && <th className="p-2.5">Borrow Request</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {((books || []) as any[]).map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="p-2.5">
                      <div className="font-bold text-slate-900">{b.title}</div>
                      <div className="text-[11px] text-slate-500">by {b.author}</div>
                    </td>
                    <td className="p-2.5 font-mono text-[11px]">
                      {b.isbn || '—'} · {b.publisher || ''}
                    </td>
                    <td className="p-2.5">
                      <Badge variant="outline">{b.category}</Badge>{' '}
                      <span className="text-slate-500">{b.rack_location}</span>
                    </td>
                    <td className="p-2.5">
                      <Badge variant={b.available_copies > 0 ? 'success' : 'danger'}>
                        {b.available_copies} / {b.total_copies} Available
                      </Badge>
                    </td>
                    {canRequestBook && (
                      <td className="p-2.5">
                        <ActionForm
                          action={submitBorrowRequestAction}
                          submitLabel="Request Book"
                          submitVariant="outline"
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="bookId" value={b.id} />
                          <Input
                            name="requestNote"
                            placeholder="Note (optional)"
                            className="h-7 text-xs w-36"
                          />
                        </ActionForm>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Active & Overdue Loans + Returns */}
      <Card>
        <CardHeader>
          <CardTitle>Active Circulation, Overdue List & Book Returns</CardTitle>
          <CardDescription>
            Loans past their 14-day due date are highlighted as OVERDUE. No automatic monetary fines are charged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="p-2.5">Copy Accession</th>
                  <th className="p-2.5">Book Title</th>
                  <th className="p-2.5">Borrower</th>
                  <th className="p-2.5">Issued Date</th>
                  <th className="p-2.5">Due Date</th>
                  <th className="p-2.5">Status</th>
                  {isLibrarianOrAdmin && <th className="p-2.5">Return Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {((loans || []) as any[]).map((ln) => {
                  const isOverdue = !ln.returned_at && ln.due_date < todayStr;
                  return (
                    <tr key={ln.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold">
                        {ln.library_book_copies?.accession_no}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900">
                        {ln.library_books?.title}
                      </td>
                      <td className="p-2.5">
                        {ln.borrower?.full_name} (@{ln.borrower?.username})
                      </td>
                      <td className="p-2.5">{formatDateIN(ln.issued_at)}</td>
                      <td className="p-2.5 font-semibold">
                        {formatDateIN(ln.due_date)}
                      </td>
                      <td className="p-2.5">
                        {ln.returned_at ? (
                          <Badge variant="secondary">
                            RETURNED ({formatDateIN(ln.returned_at)})
                          </Badge>
                        ) : isOverdue ? (
                          <Badge variant="danger">OVERDUE</Badge>
                        ) : (
                          <Badge variant="warning">ISSUED (Active)</Badge>
                        )}
                      </td>
                      {isLibrarianOrAdmin && (
                        <td className="p-2.5">
                          {!ln.returned_at ? (
                            <ActionForm
                              action={returnBookCopyAction}
                              submitLabel="Record Return"
                              submitVariant="primary"
                              className="flex items-center gap-1.5"
                            >
                              <input type="hidden" name="loanId" value={ln.id} />
                              <Select
                                name="returnCondition"
                                defaultValue="Good"
                                className="h-7 text-xs w-24"
                              >
                                <option value="Good">Good</option>
                                <option value="Fair">Fair</option>
                                <option value="Damaged">Damaged</option>
                              </Select>
                            </ActionForm>
                          ) : (
                            <span className="text-slate-400">Completed</span>
                          )}
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

      {/* Borrow Requests Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Borrowing Requests ({(requests || []).length})</CardTitle>
          <CardDescription>
            Student and staff book requests with librarian approval/rejection controls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Requester</th>
                  <th className="p-2.5">Book Title</th>
                  <th className="p-2.5">Note</th>
                  <th className="p-2.5">Status</th>
                  {isLibrarianOrAdmin && <th className="p-2.5">Review</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {((requests || []) as any[]).map((req) => (
                  <tr key={req.id}>
                    <td className="p-2.5">{formatDateIN(req.created_at)}</td>
                    <td className="p-2.5 font-semibold">
                      {req.profiles?.full_name} (@{req.profiles?.username})
                    </td>
                    <td className="p-2.5 font-semibold text-slate-900">
                      {req.library_books?.title}
                    </td>
                    <td className="p-2.5 text-slate-600">{req.request_note || '—'}</td>
                    <td className="p-2.5">
                      <Badge
                        variant={
                          req.status === 'APPROVED' || req.status === 'FULFILLED'
                            ? 'success'
                            : req.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {req.status}
                      </Badge>
                    </td>
                    {isLibrarianOrAdmin && (
                      <td className="p-2.5">
                        {req.status === 'PENDING' ? (
                          <div className="flex items-center gap-2">
                            <ActionForm
                              action={reviewBorrowRequestAction}
                              submitLabel="Approve"
                              submitVariant="primary"
                            >
                              <input type="hidden" name="requestId" value={req.id} />
                              <input type="hidden" name="status" value="APPROVED" />
                            </ActionForm>
                            <ActionForm
                              action={reviewBorrowRequestAction}
                              submitLabel="Reject"
                              submitVariant="danger"
                            >
                              <input type="hidden" name="requestId" value={req.id} />
                              <input type="hidden" name="status" value="REJECTED" />
                            </ActionForm>
                          </div>
                        ) : (
                          <span className="text-slate-400">Reviewed</span>
                        )}
                      </td>
                    )}
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
