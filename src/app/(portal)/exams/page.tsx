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
  Button,
} from '@/components/ui/primitives';
import { ActionForm, PrintButton } from '@/components/ui/action-form';
import {
  createExamAction,
  publishExamToggleAction,
  openExamCorrectionAction,
  discardExamCorrectionAction,
  saveRemarksAndSkillsAction,
  generateResultPinsAction,
  verifyResultPinAction,
} from '@/lib/actions/academics';
import { MarksEntryClient } from '@/components/exams/marks-entry-client';
import { ExamCreateForm } from '@/components/exams/exam-create-form';
import { resolveImmutableResultSummary, type ImmutableSummarySnapshot } from '@/lib/calculations';
import { Download, Lock, Unlock, KeyRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: { examId?: string; revisionId?: string };
}) {
  const profile = await requireAuth();
  const supabase = createClient();

  const [
    { data: settings },
    { data: exams },
    { data: classes },
    { data: configs },
    { data: years },
    { data: pins },
    { data: verifications },
  ] = await Promise.all([
    supabase.from('school_settings').select('*').limit(1).single(),
    supabase
      .from('exams')
      .select(
        `
        *,
        academic_years (name),
        school_classes (name, numeric_level),
        assessment_configs (name, board_code, custom_board_name, pass_percentage, version),
        assessment_terms (name, code, weight_percent)
      `
      )
      .order('created_at', { ascending: true }),
    supabase.from('school_classes').select('*').order('numeric_level', { ascending: true }),
    supabase
      .from('assessment_configs')
      .select('*, assessment_terms(*)')
      .eq('is_active', true),
    supabase.from('academic_years').select('*').order('name', { ascending: true }),
    profile.role === 'super_admin' || profile.role === 'admin'
      ? supabase.from('result_pins').select('*').order('created_at', { ascending: false }).limit(12)
      : Promise.resolve({ data: null }),
    supabase.from('result_pin_verifications').select('*').eq('user_id', profile.id),
  ]);

  const activeExam =
    ((exams || []) as any[]).find((e) => e.id === searchParams.examId) ||
    ((exams || []) as any[])[0];

  const isStaffEditor = ['super_admin', 'admin', 'teacher'].includes(profile.role);
  const isAdmin = ['super_admin', 'admin'].includes(profile.role);

  let subjects: any[] = [];
  let components: any[] = [];
  let enrollments: any[] = [];
  let markEntries: any[] = [];
  let summaries: any[] = [];
  let revisions: any[] = [];
  let selectedRevision: any | null = null;

  if (activeExam) {
    const revisionRes = await supabase
      .from('exam_result_revisions')
      .select('*')
      .eq('exam_id', activeExam.id)
      .order('revision_number', { ascending: false });
    revisions = revisionRes.data || [];
    const requestedRevisionId = searchParams.revisionId;
    const viewRevisionId = requestedRevisionId ||
      ((!isStaffEditor || !activeExam.active_draft_id) ? activeExam.current_revision_id : null);
    selectedRevision = revisions.find((revision) => revision.id === viewRevisionId) || null;

    const [subRes, compRes, enrRes, mkRes, sumRes, revisionStudentsRes] = await Promise.all([
      supabase
        .from('subjects')
        .select('*')
        .eq('class_id', activeExam.class_id)
        .order('code', { ascending: true }),
      supabase
        .from('assessment_components')
        .select('*')
        .eq('config_id', activeExam.config_id)
        .order('display_order', { ascending: true }),
      supabase
        .from('student_enrollments')
        .select('*, sections(name), students(id, admission_no, profiles(full_name))')
        .eq('academic_year_id', activeExam.academic_year_id)
        .eq('class_id', activeExam.class_id)
        .order('roll_no', { ascending: true }),
      supabase.from('mark_entries').select('*').eq('exam_id', activeExam.id),
      supabase
        .from('exam_student_summaries')
        .select(
          `
          *,
          student_enrollments (
            id,
            roll_no,
            sections (name),
            students (id, admission_no, house, profiles (full_name))
          )
        `
        )
        .eq('exam_id', activeExam.id)
        .order('class_rank', { ascending: true }),
      selectedRevision
        ? supabase.from('exam_result_revision_students').select('*').eq('revision_id', selectedRevision.id)
        : Promise.resolve({ data: null }),
    ]);

    subjects = subRes.data || [];
    components = (compRes.data || []).filter(
      (component: any) => component.term_id === null || component.term_id === activeExam.term_id
    );
    enrollments = enrRes.data || [];
    markEntries = mkRes.data || [];
    if (selectedRevision) {
      summaries = ((revisionStudentsRes.data || []) as any[]).map((row) => {
        const snapshot = row.report_snapshot || {};
        const summary = snapshot.summary || {};
        const student = snapshot.student || {};
        return {
          id: row.id,
          exam_id: row.exam_id,
          enrollment_id: row.enrollment_id,
          student_id: row.student_id,
          ...summary,
          published_snapshot: summary,
          student_enrollments: {
            id: row.enrollment_id,
            roll_no: student.roll_no,
            sections: { name: student.section_name },
            students: {
              id: row.student_id,
              admission_no: student.admission_no,
              house: student.house,
              profiles: { full_name: student.full_name },
            },
          },
        };
      }).sort((a, b) => Number(a.class_rank ?? 999) - Number(b.class_rank ?? 999));
    } else {
      summaries = sumRes.data || [];
    }
  }

  const currentYear =
    (years || []).find((y) => y.is_current) || (years || [])[0];
  const requirePin = Boolean(settings?.require_result_pin);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Examinations, Marks, Tabulation & Report Cards
          </h2>
          <p className="text-xs text-slate-500">
            Zero/Absent/Missing mark handling, shared competition ranks (1, 1, 3), term weighting, Result PINs, and immutable historical snapshots.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <PrintButton label="Print View" />
          {activeExam && isStaffEditor && (
            <a
              href={`/api/pdf/tabulation/${activeExam.id}${selectedRevision ? `?revisionId=${selectedRevision.id}` : ''}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
            >
              <Download className="h-3.5 w-3.5" />
              Download Tabulation PDF
            </a>
          )}
        </div>
      </div>

      {/* Exam Selector Bar */}
      <Card className="no-print">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {((exams || []) as any[]).map((ex) => {
              const selected = ex.id === activeExam?.id;
              return (
                <Link
                  key={ex.id}
                  href={`/exams?examId=${ex.id}`}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold">{ex.name}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span>{ex.school_classes?.name}</span>·
                    <span>{ex.assessment_configs?.board_code}</span>·
                    <span>
                      {ex.is_published ? 'PUBLISHED' : 'DRAFT (Unpublished)'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {activeExam && isAdmin && activeExam.active_draft_id && (
            <div className="flex flex-col gap-2">
              <ActionForm action={publishExamToggleAction} submitLabel="Publish Immutable Revision">
                <input type="hidden" name="examId" value={activeExam.id} />
                <input type="hidden" name="draftId" value={activeExam.active_draft_id} />
              </ActionForm>
              {activeExam.current_revision_id && (
                <ActionForm action={discardExamCorrectionAction} submitLabel="Discard Correction Draft" submitVariant="outline">
                  <input type="hidden" name="examId" value={activeExam.id} />
                  <input type="hidden" name="draftId" value={activeExam.active_draft_id} />
                </ActionForm>
              )}
            </div>
          )}
          {activeExam && isAdmin && !activeExam.active_draft_id && activeExam.current_revision_id && (
            <ActionForm action={openExamCorrectionAction} submitLabel="Create Correction Draft" submitVariant="secondary">
              <input type="hidden" name="examId" value={activeExam.id} />
              <div>
                <Label htmlFor="correctionReason">Correction reason</Label>
                <Input id="correctionReason" name="reason" required minLength={5} placeholder="Describe why a new published revision is required" />
              </div>
            </ActionForm>
          )}
        </CardContent>
      </Card>

      {activeExam && revisions.length > 0 && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Published Result History</CardTitle>
            <CardDescription>Every published revision is immutable. Superseded revisions remain available to authorized viewers.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {isStaffEditor && activeExam.active_draft_id && (
              <Link href={`/exams?examId=${activeExam.id}`} className={`rounded-md border px-3 py-2 text-xs font-semibold ${!selectedRevision ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-200'}`}>
                Working Draft
              </Link>
            )}
            {revisions.map((revision) => (
              <Link
                key={revision.id}
                href={`/exams?examId=${activeExam.id}&revisionId=${revision.id}`}
                className={`rounded-md border px-3 py-2 text-xs ${selectedRevision?.id === revision.id ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200'}`}
              >
                <span className="font-bold">Revision {revision.revision_number}</span>{' '}
                <span>{revision.id === activeExam.current_revision_id ? '(Current)' : '(Superseded)'}</span>
                <span className="block text-[10px] text-slate-500">{new Date(revision.published_at).toLocaleString('en-IN')} · {revision.correction_reason}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Optional Result PIN Verification Gate for Students & Parents when enabled */}
      {requirePin && (profile.role === 'student' || profile.role === 'parent') && (
        <Card className="border-amber-300 bg-amber-50/40 no-print">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <KeyRound className="h-4 w-4 text-amber-700" />
              Result-Access PIN Required by School Settings
            </CardTitle>
            <CardDescription>
              Result PIN protection is currently enabled. Enter a valid Result PIN (e.g. <code className="font-mono">VBM26-78901-ABCDEF</code>) for your student record to unlock published report cards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={verifyResultPinAction}
              submitLabel="Verify Result PIN"
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <input
                type="hidden"
                name="academicYearId"
                value={activeExam?.academic_year_id || currentYear?.id || ''}
              />
              <div>
                <Label htmlFor="pinStudentId">Student</Label>
                <Select id="pinStudentId" name="studentId" required>
                  {enrollments.map((enr: any) => (
                    <option key={enr.student_id} value={enr.student_id}>
                      {enr.students?.profiles?.full_name} ({enr.students?.admission_no})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="pinCode">Result PIN Code</Label>
                <Input
                  id="pinCode"
                  name="pinCode"
                  required
                  placeholder="VBM26-78901-ABCDEF"
                  className="font-mono"
                />
              </div>
              <div className="flex items-end text-xs text-slate-600">
                Verified sessions: {(verifications || []).length}
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      )}

      {/* Tabulation & Report Cards Section */}
      {activeExam && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{activeExam.name} — Tabulation & Report Cards</CardTitle>
                  {selectedRevision ? (
                    <Badge variant="success" className="gap-1">
                      <Lock className="h-3 w-3" /> Revision {selectedRevision.revision_number} · {selectedRevision.id === activeExam.current_revision_id ? 'Current' : 'Superseded'}
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1">
                      <Unlock className="h-3 w-3" /> Working Draft (Staff Only)
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  Board Profile: {activeExam.assessment_configs?.board_code} (v
                  {activeExam.assessment_configs?.version}) · Term:{' '}
                  {activeExam.assessment_terms?.name} (Weight:{' '}
                  {Number(activeExam.assessment_terms?.weight_percent ?? 50)}%) · Pass Threshold:{' '}
                  {Number(activeExam.assessment_configs?.pass_percentage ?? 33)}%
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {summaries.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                {requirePin && !isStaffEditor
                  ? 'Published results are locked behind Result PIN verification, or no results have been published for your student record yet.'
                  : 'No published summaries available yet. Enter marks below to compute student summaries and shared competition ranks.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2.5">Roll</th>
                      <th className="p-2.5">Student</th>
                      <th className="p-2.5">Total Marks</th>
                      <th className="p-2.5">Percentage</th>
                      <th className="p-2.5">Annual Weighted %</th>
                      <th className="p-2.5">Grade & Remark</th>
                      <th className="p-2.5">Competition Rank</th>
                      <th className="p-2.5">Comments & Skills</th>
                      <th className="p-2.5 no-print">Report Card PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {summaries.map((sum: any) => {
                      const resolved = resolveImmutableResultSummary({
                        isPublished: Boolean(selectedRevision),
                        totalObtained: Number(sum.total_obtained),
                        totalMax: Number(sum.total_max),
                        percentage: Number(sum.percentage),
                        annualWeightedPercentage: sum.annual_weighted_percentage
                          ? Number(sum.annual_weighted_percentage)
                          : null,
                        overallGrade: sum.overall_grade,
                        gradeRemark: sum.grade_remark,
                        isPassed: Boolean(sum.is_passed),
                        sectionRank: sum.section_rank,
                        classRank: sum.class_rank,
                        publishedSnapshot:
                          (sum.published_snapshot as ImmutableSummarySnapshot) || null,
                      });

                      return (
                        <tr key={sum.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono">
                            #{sum.student_enrollments?.roll_no}
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900">
                              {sum.student_enrollments?.students?.profiles?.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {sum.student_enrollments?.students?.admission_no} · Sec{' '}
                              {sum.student_enrollments?.sections?.name}
                            </div>
                          </td>
                          <td className="p-2.5 font-mono font-semibold">
                            {resolved.totalObtained.toFixed(2)} / {resolved.totalMax.toFixed(2)}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-blue-800">
                            {resolved.percentage.toFixed(2)}%
                          </td>
                          <td className="p-2.5 font-mono">
                            {resolved.annualWeightedPercentage !== null
                              ? `${resolved.annualWeightedPercentage.toFixed(2)}%`
                              : '—'}
                          </td>
                          <td className="p-2.5">
                            <Badge variant={resolved.isPassed ? 'success' : 'danger'}>
                              {resolved.overallGrade} — {resolved.gradeRemark}
                            </Badge>
                          </td>
                          <td className="p-2.5 font-bold">
                            Class #{resolved.classRank} (Sec #{resolved.sectionRank})
                          </td>
                          <td className="p-2.5 max-w-xs">
                            <div className="text-[11px] text-slate-700">
                              <span className="font-semibold">Teacher:</span>{' '}
                              {sum.teacher_comment || '—'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              <span className="font-semibold">Principal:</span>{' '}
                              {sum.principal_comment || '—'}
                            </div>
                          </td>
                          <td className="p-2.5 no-print">
                            <a
                              href={`/api/pdf/report-card/${sum.enrollment_id}?examId=${activeExam.id}${selectedRevision ? `&revisionId=${selectedRevision.id}` : ''}`}
                              className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              <Download className="h-3 w-3" />
                              PDF Report Card
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk Marks Entry & Teacher Comments for Staff */}
      {activeExam && isStaffEditor && activeExam.active_draft_id && !selectedRevision && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Bulk Marks Entry — {activeExam.name}</CardTitle>
            <CardDescription>
              Enter component scores for each student. Zero (0) is counted as 0.00; ABSENT contributes 0 and displays as AB; MISSING blocks publication of mandatory components.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MarksEntryClient
              examId={activeExam.id}
              draftId={activeExam.active_draft_id}
              subjects={subjects.map((s) => ({
                id: s.id,
                name: s.name,
                code: s.code,
              }))}
              components={components.map((c) => ({
                id: c.id,
                code: c.code,
                name: c.name,
                max_marks: Number(c.max_marks),
                pass_marks: Number(c.pass_marks),
              }))}
              enrollments={enrollments.map((e) => ({
                id: e.id,
                student_id: e.student_id,
                roll_no: e.roll_no,
                student_name: e.students?.profiles?.full_name || 'Student',
                admission_no: e.students?.admission_no || '',
              }))}
              existingMarks={markEntries.map((m) => ({
                enrollment_id: m.enrollment_id,
                subject_id: m.subject_id,
                component_id: m.component_id,
                status: m.status,
                marks_obtained:
                  m.marks_obtained !== null ? Number(m.marks_obtained) : null,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Teacher Comments & Skill Ratings Editor */}
      {activeExam && isStaffEditor && activeExam.active_draft_id && !selectedRevision && summaries.length > 0 && (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Teacher Remarks, Principal Comments & Skill Ratings</CardTitle>
            <CardDescription>
              Record qualitative remarks and 1–5 psychomotor/affective skill ratings for report cards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summaries.map((sum: any) => (
              <ActionForm
                key={sum.id}
                action={saveRemarksAndSkillsAction}
                submitLabel="Save Remarks"
                className="rounded-lg border border-slate-200 p-3.5"
              >
                <input type="hidden" name="summaryId" value={sum.id} />
                <input type="hidden" name="examId" value={activeExam.id} />
                <input type="hidden" name="draftId" value={activeExam.active_draft_id} />
                <div className="text-xs font-bold text-slate-900 mb-2">
                  #{sum.student_enrollments?.roll_no}{' '}
                  {sum.student_enrollments?.students?.profiles?.full_name} (
                  {sum.student_enrollments?.students?.admission_no})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Class Teacher Remark</Label>
                    <Input
                      name="teacherComment"
                      defaultValue={sum.teacher_comment || ''}
                      placeholder="Enter teacher comment"
                    />
                  </div>
                  <div>
                    <Label>Principal Remark (Admin only)</Label>
                    <Input
                      name="principalComment"
                      defaultValue={sum.principal_comment || ''}
                      disabled={!isAdmin}
                      placeholder="Enter principal comment"
                    />
                  </div>
                  <div>
                    <Label>Skill Ratings JSON (1–5 scale)</Label>
                    <Input
                      name="skillRatingsJson"
                      defaultValue={JSON.stringify(sum.skill_ratings || {})}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </ActionForm>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Admin Exam Setup & Result PIN Management */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
          <Card>
            <CardHeader>
              <CardTitle>Create New Examination</CardTitle>
              <CardDescription>
                Bind an exam to a class, assessment configuration version, and term/semester.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExamCreateForm
                academicYearId={currentYear?.id || ''}
                classes={(classes || []).map((schoolClass) => ({ id: schoolClass.id, name: schoolClass.name }))}
                configs={((configs || []) as any[]).map((config) => ({
                  id: config.id,
                  name: config.name,
                  board_code: config.board_code,
                  version: config.version,
                  class_id: config.class_id,
                  academic_year_id: config.academic_year_id,
                  assessment_terms: config.assessment_terms || [],
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Result-Access PIN Generator</CardTitle>
              <CardDescription>
                Status: {requirePin ? 'ENABLED in School Settings' : 'DISABLED initially (Toggle in Settings)'}. Each PIN allows up to 5 verifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionForm
                action={generateResultPinsAction}
                submitLabel="Generate Result PIN Batch"
                className="flex items-end gap-3"
              >
                <input
                  type="hidden"
                  name="academicYearId"
                  value={currentYear?.id || ''}
                />
                <div className="flex-1">
                  <Label htmlFor="pinCount">Number of PINs to Generate</Label>
                  <Input
                    id="pinCount"
                    name="count"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={5}
                  />
                </div>
              </ActionForm>

              <div className="grid grid-cols-2 gap-2 pt-2">
                {((pins || []) as any[]).map((p) => (
                  <div
                    key={p.id}
                    className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 flex items-center justify-between text-xs"
                  >
                    <code className="font-mono font-bold text-slate-900">
                      {p.pin_code}
                    </code>
                    <span className="text-[10px] text-slate-500">
                      Uses: {p.times_used}/{p.max_uses}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
