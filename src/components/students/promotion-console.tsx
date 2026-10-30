'use client';

import * as React from 'react';
import { promoteStudentsAction } from '@/lib/actions/administration';
import { Button, Select, Label, Badge } from '@/components/ui/primitives';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface StudentRow {
  studentId: string;
  fullName: string;
  admissionNo: string;
  rollNo: number;
}

interface PromotionConsoleProps {
  academicYears: Array<{ id: string; name: string; is_current: boolean }>;
  classes: Array<{ id: string; name: string; numeric_level: number }>;
  sections: Array<{ id: string; class_id: string; name: string }>;
  enrollments: Array<{
    student_id: string;
    academic_year_id: string;
    class_id: string;
    section_id: string;
    roll_no: number;
    status: string;
    students: { admission_no: string; profiles: { full_name: string } };
  }>;
}

export function PromotionConsole({
  academicYears,
  classes,
  sections,
  enrollments,
}: PromotionConsoleProps) {
  const currentYear = academicYears.find((y) => y.is_current) || academicYears[0];
  const nextYear =
    academicYears.find((y) => y.name > (currentYear?.name || '')) ||
    academicYears[academicYears.length - 1];

  const [fromYearId, setFromYearId] = React.useState(currentYear?.id || '');
  const [toYearId, setToYearId] = React.useState(nextYear?.id || '');

  const class10 = classes.find((c) => c.numeric_level === 10) || classes[0];
  const class11 = classes.find((c) => c.numeric_level === 11) || classes[0];

  const [fromClassId, setFromClassId] = React.useState(class10?.id || '');
  const [toClassId, setToClassId] = React.useState(class11?.id || '');

  const fromSections = sections.filter((s) => s.class_id === fromClassId);
  const toSections = sections.filter((s) => s.class_id === toClassId);

  const [fromSectionId, setFromSectionId] = React.useState(fromSections[0]?.id || '');
  const [toSectionId, setToSectionId] = React.useState(toSections[0]?.id || '');

  React.useEffect(() => {
    const fs = sections.find((s) => s.class_id === fromClassId);
    if (fs) setFromSectionId(fs.id);
  }, [fromClassId, sections]);

  React.useEffect(() => {
    const ts = sections.find((s) => s.class_id === toClassId);
    if (ts) setToSectionId(ts.id);
  }, [toClassId, sections]);

  const matchingStudents: StudentRow[] = enrollments
    .filter(
      (e) =>
        e.academic_year_id === fromYearId &&
        e.class_id === fromClassId &&
        e.section_id === fromSectionId &&
        e.status === 'active'
    )
    .map((e) => ({
      studentId: e.student_id,
      fullName: e.students?.profiles?.full_name || 'Student',
      admissionNo: e.students?.admission_no || '-',
      rollNo: e.roll_no,
    }));

  const [decisions, setDecisions] = React.useState<
    Record<string, 'PROMOTE' | 'RETAIN' | 'GRADUATE'>
  >({});
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function handlePromoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (matchingStudents.length === 0) return;
    setPending(true);
    setError(null);
    setSuccess(null);

    const payload = matchingStudents.map((st) => ({
      student_id: st.studentId,
      action: decisions[st.studentId] || 'PROMOTE',
      remarks: `Batch transition from ${fromYearId.slice(0, 4)}`,
    }));

    const fd = new FormData();
    fd.set('fromAcademicYearId', fromYearId);
    fd.set('toAcademicYearId', toYearId);
    fd.set('fromClassId', fromClassId);
    fd.set('fromSectionId', fromSectionId);
    fd.set('toClassId', toClassId);
    fd.set('toSectionId', toSectionId);
    fd.set('decisionsJson', JSON.stringify(payload));

    const res = await promoteStudentsAction(fd);
    if (res?.error) {
      setError(res.error);
    } else if (res?.success) {
      setSuccess(res.success);
    }
    setPending(false);
  }

  return (
    <form onSubmit={handlePromoteSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <Label>From Session</Label>
          <Select value={fromYearId} onChange={(e) => setFromYearId(e.target.value)}>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>From Class</Label>
          <Select value={fromClassId} onChange={(e) => setFromClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>From Section</Label>
          <Select value={fromSectionId} onChange={(e) => setFromSectionId(e.target.value)}>
            {fromSections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>To Session</Label>
          <Select value={toYearId} onChange={(e) => setToYearId(e.target.value)}>
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>To Class</Label>
          <Select value={toClassId} onChange={(e) => setToClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>To Section</Label>
          <Select value={toSectionId} onChange={(e) => setToSectionId(e.target.value)}>
            {toSections.map((s) => (
              <option key={s.id} value={s.id}>
                Section {s.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {matchingStudents.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          No active students found in the selected source class/section for this academic session.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold">
              <tr>
                <th className="p-2.5">Roll</th>
                <th className="p-2.5">Admission No</th>
                <th className="p-2.5">Student Name</th>
                <th className="p-2.5">Decision Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {matchingStudents.map((st) => (
                <tr key={st.studentId}>
                  <td className="p-2.5 font-medium">#{st.rollNo}</td>
                  <td className="p-2.5">
                    <Badge variant="outline">{st.admissionNo}</Badge>
                  </td>
                  <td className="p-2.5 font-semibold text-slate-900">{st.fullName}</td>
                  <td className="p-2.5">
                    <Select
                      aria-label={`Promotion decision for ${st.fullName}`}
                      value={decisions[st.studentId] || 'PROMOTE'}
                      onChange={(e) =>
                        setDecisions((prev) => ({
                          ...prev,
                          [st.studentId]: e.target.value as 'PROMOTE' | 'RETAIN' | 'GRADUATE',
                        }))
                      }
                      className="max-w-xs"
                    >
                      <option value="PROMOTE">Promote to Target Class</option>
                      <option value="RETAIN">Retain in Current Class (Next Session)</option>
                      <option value="GRADUATE">Graduate / Pass Out</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || matchingStudents.length === 0}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Execute Batch Promotion / Retention / Graduation
        </Button>
      </div>
    </form>
  );
}
