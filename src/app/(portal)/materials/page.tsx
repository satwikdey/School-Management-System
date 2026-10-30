import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { uploadStudyMaterialAction } from '@/lib/actions/operations';
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
  Textarea,
  Label,
  Button,
} from '@/components/ui/primitives';
import { formatDateTimeIN } from '@/lib/utils';
import { FolderOpen, Upload, Download, ExternalLink, FileText, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default async function StudyMaterialsPage({
  searchParams,
}: {
  searchParams?: { classId?: string; q?: string };
}) {
  const profile = await requireAuth();
  const supabase = createClient();

  const canUpload = ['super_admin', 'admin', 'teacher'].includes(profile.role);

  const [
    { data: settings },
    { data: academicYears },
    { data: classes },
    { data: subjects },
    { data: teacherAssignments },
    { data: materials },
  ] = await Promise.all([
    supabase.from('school_settings').select('current_academic_year_id').limit(1).maybeSingle(),
    supabase.from('academic_years').select('id, name, is_current').order('start_date', { ascending: false }),
    supabase.from('school_classes').select('id, name, code, numeric_level').order('numeric_level'),
    supabase.from('subjects').select('id, name, code').order('name'),
    profile.role === 'teacher'
      ? supabase
          .from('teacher_assignments')
          .select('class_id, subject_id, academic_year_id')
          .eq('teacher_id', profile.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from('study_materials')
      .select(
        'id, title, description, file_name, mime_type, file_size_bytes, created_at, class_id, subject_id, school_classes(name), subjects(name, code), profiles!study_materials_uploaded_by_fkey(full_name)'
      )
      .order('created_at', { ascending: false }),
  ]);

  const currentYearId = settings?.current_academic_year_id || academicYears?.[0]?.id || '';
  const filterClassId = searchParams?.classId || '';
  const query = (searchParams?.q || '').trim().toLowerCase();

  // Filter classes & subjects available to teacher when uploading
  const assignedClassIds =
    profile.role === 'teacher'
      ? new Set((teacherAssignments || []).map((a) => a.class_id))
      : null;
  const assignedSubjectIds =
    profile.role === 'teacher'
      ? new Set((teacherAssignments || []).map((a) => a.subject_id))
      : null;

  const uploadableClasses = assignedClassIds
    ? (classes || []).filter((c) => assignedClassIds.has(c.id))
    : classes || [];
  const uploadableSubjects = assignedSubjectIds
    ? (subjects || []).filter((s) => assignedSubjectIds.has(s.id))
    : subjects || [];

  const filteredMaterials = (materials || []).filter((m) => {
    if (filterClassId && m.class_id !== filterClassId) return false;
    if (query) {
      const hay = `${m.title} ${m.description || ''} ${m.file_name}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-blue-700" />
            Study Materials &amp; Syllabus Repository
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Private Supabase Storage (`study-materials` bucket) with Row-Level Security and expiring signed download links
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 self-start sm:self-auto">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Max 10 MB • PDF, DOCX, PPTX, JPEG, PNG
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canUpload && (
          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-700" />
                Upload Study Material
              </CardTitle>
              <CardDescription>
                {profile.role === 'teacher'
                  ? 'Teachers can upload resources for their assigned classes and subjects.'
                  : 'Upload syllabus documents, notes, or sample papers to the private storage bucket.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionForm
                action={uploadStudyMaterialAction}
                submitLabel="Upload to Private Storage"
                resetOnSuccess
                className="space-y-3"
              >
                <div>
                  <Label htmlFor="mat-title">Material Title</Label>
                  <Input
                    id="mat-title"
                    name="title"
                    placeholder="e.g. Class X Quadratic Equations Formula Sheet"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="mat-year">Academic Year</Label>
                  <Select id="mat-year" name="academicYearId" defaultValue={currentYearId} required>
                    {(academicYears || []).map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name} {ay.is_current ? '(Current)' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="mat-class">Class</Label>
                    <Select id="mat-class" name="classId" required>
                      {uploadableClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="mat-subject">Subject</Label>
                    <Select id="mat-subject" name="subjectId" required>
                      {uploadableSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="mat-desc">Description / Instructions</Label>
                  <Textarea
                    id="mat-desc"
                    name="description"
                    placeholder="Chapter reference, practice exercise instructions..."
                  />
                </div>
                <div>
                  <Label htmlFor="mat-file">Attachment (PDF, DOCX, PPTX, JPEG, PNG ≤ 10 MB)</Label>
                  <Input
                    id="mat-file"
                    name="file"
                    type="file"
                    accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png"
                    required
                  />
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        )}

        <Card className={canUpload ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Available Study Materials ({filteredMaterials.length})</CardTitle>
              <CardDescription>
                Filtered automatically by PostgreSQL RLS for your role ({profile.role.replace('_', ' ')})
              </CardDescription>
            </div>
            <form method="get" className="flex flex-wrap items-center gap-2">
              <Input
                name="q"
                defaultValue={searchParams?.q || ''}
                placeholder="Search title or file..."
                className="w-44"
              />
              <Select name="classId" defaultValue={filterClassId} className="w-36">
                <option value="">All Classes</option>
                {(classes || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="outline" size="sm">
                Filter
              </Button>
            </form>
          </CardHeader>
          <CardContent>
            {filteredMaterials.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No study materials match your filter or current class enrollment.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredMaterials.map((item) => {
                  const cls = item.school_classes as unknown as { name: string } | null;
                  const sub = item.subjects as unknown as { name: string; code: string } | null;
                  const uploader = item.profiles as unknown as { full_name: string } | null;

                  return (
                    <div
                      key={item.id}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                          <span className="font-semibold text-sm text-slate-900">{item.title}</span>
                          {cls && <Badge variant="default">{cls.name}</Badge>}
                          {sub && (
                            <Badge variant="secondary">
                              {sub.name} ({sub.code})
                            </Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-slate-600">{item.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>File: {item.file_name}</span>
                          <span>•</span>
                          <span>Size: {formatBytes(item.file_size_bytes)}</span>
                          <span>•</span>
                          <span>Uploaded by: {uploader?.full_name || 'Faculty'}</span>
                          <span>•</span>
                          <span>{formatDateTimeIN(item.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`/api/materials/${item.id}/download`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                        <a
                          href={`/api/materials/${item.id}/download?mode=signed`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Signed Link (10m)
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
