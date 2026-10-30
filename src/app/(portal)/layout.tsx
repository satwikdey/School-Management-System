import { requireAuth, APP_NAVIGATION } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();
  const supabase = createClient();

  const { data: settings } = await supabase
    .from('school_settings')
    .select('school_name, default_board_code, default_custom_board_name, academic_years(name)')
    .limit(1)
    .single();

  const schoolName =
    settings?.school_name || 'Vidya Bharati Model Senior Secondary School';
  const academicYearName =
    (settings as any)?.academic_years?.name || '2026-2027';
  const defaultBoardCode =
    settings?.default_board_code === 'CUSTOM'
      ? `CUSTOM (${settings.default_custom_board_name || 'School Profile'})`
      : settings?.default_board_code || 'CBSE';

  return (
    <AppShell
      profile={profile}
      schoolName={schoolName}
      academicYearName={academicYearName}
      defaultBoardCode={defaultBoardCode}
      navItems={APP_NAVIGATION}
    >
      {children}
    </AppShell>
  );
}
