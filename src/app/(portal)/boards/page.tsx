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
  Label,
} from '@/components/ui/primitives';
import { ActionForm } from '@/components/ui/action-form';
import { versionAssessmentConfigAction } from '@/lib/actions/academics';
import { formatBoardDisplay } from '@/lib/utils';
import { Lock, GitBranch, Info } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BoardsPage() {
  const profile = await requireRole(['super_admin', 'admin', 'teacher']);
  const supabase = createClient();

  const { data: configs } = await supabase
    .from('assessment_configs')
    .select(
      `
      *,
      academic_years (name),
      school_classes (name, numeric_level),
      assessment_terms (*),
      assessment_components (*),
      grade_bands (*)
    `
    )
    .order('board_code', { ascending: true })
    .order('version', { ascending: false });

  const isAdmin = profile.role === 'super_admin' || profile.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Indian Boards & Versioned Assessment Configurations
        </h2>
        <p className="text-xs text-slate-500">
          Selectable CBSE, ICSE, WBBSE, WBCHSE (Semester I–II for Class XI, Semester III–IV for Class XII), and Custom assessment profiles.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
        <Info className="h-4 w-4 shrink-0 text-blue-700 mt-0.5" />
        <div>
          <span className="font-semibold">School-Managed Demonstration Profiles & Immutable Versioning:</span>{' '}
          These profiles are editable school-managed templates, not claims of official board certification. Once an assessment configuration is used by a published examination, it is automatically locked (<code className="font-mono">is_locked = true</code>). Editing a locked configuration creates a new version (<code className="font-mono">v+1</code>) so historical published results are never silently altered.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {((configs || []) as any[]).map((cfg) => {
          const terms = (cfg.assessment_terms || []).sort(
            (a: any, b: any) => a.display_order - b.display_order
          );
          const components = (cfg.assessment_components || []).sort(
            (a: any, b: any) => a.display_order - b.display_order
          );
          const grades = (cfg.grade_bands || []).sort(
            (a: any, b: any) => a.display_order - b.display_order
          );

          return (
            <Card key={cfg.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="default">
                        {formatBoardDisplay(cfg.board_code, cfg.custom_board_name)}
                      </Badge>
                      <Badge variant="outline">Version v{cfg.version}</Badge>
                      {cfg.school_classes?.name && (
                        <Badge variant="secondary">{cfg.school_classes.name}</Badge>
                      )}
                      {cfg.is_locked ? (
                        <Badge variant="warning" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Locked (Used by Exam)
                        </Badge>
                      ) : (
                        <Badge variant="success">Editable Draft</Badge>
                      )}
                      {!cfg.is_active && <Badge variant="secondary">Archived Version</Badge>}
                    </div>
                    <CardTitle className="mt-2">{cfg.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {cfg.description} · Pass Threshold: {Number(cfg.pass_percentage).toFixed(2)}%
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Terms / Semesters */}
                  <div className="rounded-lg border border-slate-200 p-3.5 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Terms / Semesters & Annual Weights
                    </h4>
                    <div className="space-y-1.5">
                      {terms.map((t: any) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between text-xs border-b border-slate-100 pb-1"
                        >
                          <span className="font-medium text-slate-800">
                            {t.name} ({t.code})
                          </span>
                          <Badge variant="outline">
                            Weight: {Number(t.weight_percent).toFixed(0)}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Assessment Components */}
                  <div className="rounded-lg border border-slate-200 p-3.5 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Assessment Components & Maxima
                    </h4>
                    <div className="space-y-1.5">
                      {components.map((c: any) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between text-xs border-b border-slate-100 pb-1"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">{c.name}</span>{' '}
                            <span className="text-slate-400">({c.code})</span>
                          </div>
                          <span className="font-mono text-[11px] font-semibold">
                            Max: {Number(c.max_marks)} (Pass: {Number(c.pass_marks)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Grade Bands */}
                  <div className="rounded-lg border border-slate-200 p-3.5 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Grade Bands ({grades.length})
                    </h4>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {grades.map((g: any) => (
                        <div
                          key={g.id}
                          className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 border border-slate-200"
                        >
                          <span className="font-bold text-slate-900">{g.grade}</span>
                          <span className="text-slate-600">
                            {Number(g.min_percentage)}–{Number(g.max_percentage)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Versioning Form for Administrators */}
                {isAdmin && cfg.is_active && (
                  <div className="pt-3 border-t border-slate-200">
                    <ActionForm
                      action={versionAssessmentConfigAction}
                      submitLabel={`Clone & Create Version v${cfg.version + 1}`}
                      submitVariant="secondary"
                      className="flex flex-col sm:flex-row sm:items-end gap-3"
                    >
                      <input type="hidden" name="configId" value={cfg.id} />
                      <div className="flex-1">
                        <Label htmlFor={`name-${cfg.id}`} className="flex items-center gap-1">
                          <GitBranch className="h-3.5 w-3.5 text-blue-700" />
                          New Version Profile Name (Preserves Published Historical Results on v{cfg.version})
                        </Label>
                        <Input
                          id={`name-${cfg.id}`}
                          name="newName"
                          required
                          defaultValue={`${cfg.name} (Rev ${cfg.version + 1})`}
                        />
                      </div>
                      <div className="w-44">
                        <Label htmlFor={`pass-${cfg.id}`}>New Pass Threshold (%)</Label>
                        <Input
                          id={`pass-${cfg.id}`}
                          name="newPassPercentage"
                          type="number"
                          step="0.5"
                          min={1}
                          max={100}
                          required
                          defaultValue={Number(cfg.pass_percentage)}
                        />
                      </div>
                    </ActionForm>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
