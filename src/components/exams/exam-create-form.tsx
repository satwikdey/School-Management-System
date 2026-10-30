'use client';

import * as React from 'react';
import { createExamAction } from '@/lib/actions/academics';
import { ActionForm } from '@/components/ui/action-form';
import { Input, Label, Select } from '@/components/ui/primitives';

interface ExamClassOption { id: string; name: string }
interface ExamTermOption { id: string; name: string; code: string }
interface ExamConfigOption {
  id: string;
  name: string;
  board_code: string;
  version: number;
  class_id: string | null;
  academic_year_id: string | null;
  assessment_terms: ExamTermOption[];
}

export function ExamCreateForm({
  academicYearId,
  classes,
  configs,
}: {
  academicYearId: string;
  classes: ExamClassOption[];
  configs: ExamConfigOption[];
}) {
  const initialClassId = classes[0]?.id ?? '';
  const [classId, setClassId] = React.useState(initialClassId);
  const matchingConfigs = configs.filter(
    (config) => config.class_id === classId && config.academic_year_id === academicYearId
  );
  const [configId, setConfigId] = React.useState(matchingConfigs[0]?.id ?? '');

  React.useEffect(() => {
    const next = configs.find(
      (config) => config.class_id === classId && config.academic_year_id === academicYearId
    );
    setConfigId(next?.id ?? '');
  }, [academicYearId, classId, configs]);

  const selectedConfig = matchingConfigs.find((config) => config.id === configId);
  const terms = selectedConfig?.assessment_terms ?? [];

  return (
    <ActionForm action={createExamAction} submitLabel="Create Examination" resetOnSuccess>
      <input type="hidden" name="academicYearId" value={academicYearId} />
      <div className="space-y-3">
        <div>
          <Label htmlFor="exName">Examination Title</Label>
          <Input id="exName" name="name" required placeholder="e.g. WBBSE Class IX First Summative Evaluation" />
        </div>
        <div>
          <Label htmlFor="exClass">Class</Label>
          <Select id="exClass" name="classId" required value={classId} onChange={(event) => setClassId(event.target.value)}>
            {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="exConfig">Assessment Configuration</Label>
          <Select
            id="exConfig"
            name="configId"
            required
            value={configId}
            onChange={(event) => setConfigId(event.target.value)}
            disabled={matchingConfigs.length === 0}
          >
            {matchingConfigs.length === 0 && <option value="">No matching configuration</option>}
            {matchingConfigs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.name} ({config.board_code} v{config.version})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="exTerm">Term / Semester</Label>
          <Select id="exTerm" name="termId" required disabled={!selectedConfig || terms.length === 0}>
            {terms.length === 0 && <option value="">No terms for this configuration</option>}
            {terms.map((term) => <option key={term.id} value={term.id}>{term.name} ({term.code})</option>)}
          </Select>
        </div>
      </div>
    </ActionForm>
  );
}
