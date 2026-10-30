'use client';

import * as React from 'react';
import { saveBulkMarksAction } from '@/lib/actions/academics';
import { Button, Select, Input, Badge } from '@/components/ui/primitives';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ComponentItem {
  id: string;
  code: string;
  name: string;
  max_marks: number;
  pass_marks: number;
}

interface EnrollmentItem {
  id: string;
  student_id: string;
  roll_no: number;
  student_name: string;
  admission_no: string;
}

interface ExistingMarkItem {
  enrollment_id: string;
  subject_id: string;
  component_id: string;
  status: 'PRESENT' | 'ABSENT' | 'MISSING';
  marks_obtained: number | null;
}

interface MarksEntryClientProps {
  examId: string;
  draftId: string;
  subjects: Array<{ id: string; name: string; code: string }>;
  components: ComponentItem[];
  enrollments: EnrollmentItem[];
  existingMarks: ExistingMarkItem[];
}

export function MarksEntryClient({
  examId,
  draftId,
  subjects,
  components,
  enrollments,
  existingMarks,
}: MarksEntryClientProps) {
  const [selectedSubjectId, setSelectedSubjectId] = React.useState(
    subjects[0]?.id || ''
  );

  // Build state key: `${enrollmentId}:${componentId}`
  const buildState = React.useCallback(
    (subId: string) => {
      const map: Record<
        string,
        { status: 'PRESENT' | 'ABSENT' | 'MISSING'; marks: string }
      > = {};
      for (const enr of enrollments) {
        for (const comp of components) {
          const found = existingMarks.find(
            (m) =>
              m.enrollment_id === enr.id &&
              m.subject_id === subId &&
              m.component_id === comp.id
          );
          const key = `${enr.id}:${comp.id}`;
          if (found) {
            map[key] = {
              status: found.status,
              marks:
                found.status === 'PRESENT' && found.marks_obtained !== null
                  ? String(found.marks_obtained)
                  : '',
            };
          } else {
            map[key] = { status: 'MISSING', marks: '' };
          }
        }
      }
      return map;
    },
    [enrollments, components, existingMarks]
  );

  const [grid, setGrid] = React.useState(() => buildState(selectedSubjectId));
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    setGrid(buildState(selectedSubjectId));
    setError(null);
    setSuccess(null);
  }, [selectedSubjectId, buildState]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const payload: Array<{
      enrollment_id: string;
      student_id: string;
      component_id: string;
      status: 'PRESENT' | 'ABSENT' | 'MISSING';
      marks_obtained: number | null;
    }> = [];

    for (const enr of enrollments) {
      for (const comp of components) {
        const cell = grid[`${enr.id}:${comp.id}`] || {
          status: 'MISSING',
          marks: '',
        };
        if (cell.status === 'PRESENT') {
          if (cell.marks.trim() === '') {
            payload.push({
              enrollment_id: enr.id,
              student_id: enr.student_id,
              component_id: comp.id,
              status: 'MISSING',
              marks_obtained: null,
            });
            continue;
          }
          const num = Number(cell.marks);
          if (Number.isNaN(num) || num < 0 || num > Number(comp.max_marks)) {
            setError(
              `Invalid marks for ${enr.student_name} (${comp.code}): must be between 0 and ${comp.max_marks}.`
            );
            setPending(false);
            return;
          }
          payload.push({
            enrollment_id: enr.id,
            student_id: enr.student_id,
            component_id: comp.id,
            status: 'PRESENT',
            marks_obtained: num,
          });
        } else {
          payload.push({
            enrollment_id: enr.id,
            student_id: enr.student_id,
            component_id: comp.id,
            status: cell.status,
            marks_obtained: null,
          });
        }
      }
    }

    const fd = new FormData();
    fd.set('examId', examId);
    fd.set('draftId', draftId);
    fd.set('subjectId', selectedSubjectId);
    fd.set('entriesJson', JSON.stringify(payload));

    const res = await saveBulkMarksAction(fd);
    if (res?.error) {
      setError(res.error);
    } else if (res?.success) {
      setSuccess(res.success);
    }
    setPending(false);
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Select Subject:</span>
          <Select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-64"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </Select>
        </div>
        <div className="text-[11px] text-slate-500">
          Distinguishes <Badge variant="success">PRESENT (0..Max)</Badge>,{' '}
          <Badge variant="warning">ABSENT (AB = 0)</Badge>, and{' '}
          <Badge variant="danger">MISSING (Blocks Publish)</Badge>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-700 font-semibold">
            <tr>
              <th className="p-2.5">Roll</th>
              <th className="p-2.5">Student</th>
              {components.map((c) => (
                <th key={c.id} className="p-2.5">
                  {c.name} ({c.code} · Max {Number(c.max_marks)})
                </th>
              ))}
              <th className="p-2.5">Row Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {enrollments.map((enr) => {
              let rowTotal = 0;
              let rowMax = 0;
              for (const comp of components) {
                rowMax += Number(comp.max_marks);
                const cell = grid[`${enr.id}:${comp.id}`];
                if (cell?.status === 'PRESENT') {
                  rowTotal += Number(cell.marks || 0);
                }
              }

              return (
                <tr key={enr.id}>
                  <td className="p-2.5 font-mono">#{enr.roll_no}</td>
                  <td className="p-2.5">
                    <div className="font-semibold text-slate-900">{enr.student_name}</div>
                    <div className="text-[10px] text-slate-500">{enr.admission_no}</div>
                  </td>
                  {components.map((comp) => {
                    const key = `${enr.id}:${comp.id}`;
                    const cell = grid[key] || { status: 'MISSING', marks: '' };
                    return (
                      <td key={comp.id} className="p-2.5">
                        <div className="flex items-center gap-1.5">
                          <Select
                            aria-label={`Status for ${enr.student_name} ${comp.code}`}
                            value={cell.status}
                            onChange={(e) => {
                              const nextStatus = e.target.value as
                                | 'PRESENT'
                                | 'ABSENT'
                                | 'MISSING';
                              setGrid((prev) => ({
                                ...prev,
                                [key]: {
                                  status: nextStatus,
                                  marks: nextStatus === 'PRESENT' ? prev[key]?.marks || '' : '',
                                },
                              }));
                            }}
                            className="w-28 h-8 text-xs"
                          >
                            <option value="PRESENT">PRESENT</option>
                            <option value="ABSENT">ABSENT (AB)</option>
                            <option value="MISSING">MISSING</option>
                          </Select>
                          {cell.status === 'PRESENT' ? (
                            <Input
                              aria-label={`Marks for ${enr.student_name} ${comp.code}`}
                              type="number"
                              step="0.01"
                              min={0}
                              max={Number(comp.max_marks)}
                              value={cell.marks}
                              onChange={(e) =>
                                setGrid((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], marks: e.target.value },
                                }))
                              }
                              onBlur={(e) => {
                                if (e.target.value.trim() === '') {
                                  setGrid((prev) => ({
                                    ...prev,
                                    [key]: { status: 'MISSING', marks: '' },
                                  }));
                                }
                              }}
                              className="w-20 h-8 text-xs font-mono"
                            />
                          ) : (
                            <span className="inline-flex h-8 w-20 items-center justify-center rounded border border-slate-200 bg-slate-50 font-mono text-xs text-slate-500">
                              {cell.status === 'ABSENT' ? 'AB (0)' : '—'}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2.5 font-mono font-bold text-slate-900">
                    {rowTotal} / {rowMax}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Subject Marks & Recalculate Ranks
        </Button>
      </div>
    </form>
  );
}
