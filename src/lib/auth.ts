import 'server-only';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/utils';

export interface AuthenticatedProfile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  code: string;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  nationality: string;
  state: string | null;
  district: string | null;
  address: string | null;
  photo_path: string | null;
  is_active: boolean;
}

export async function getCurrentProfile(): Promise<AuthenticatedProfile | null> {
  noStore();
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    return null;
  }

  return profile as AuthenticatedProfile;
}

export async function requireAuth(): Promise<AuthenticatedProfile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/login');
  }
  return profile;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<AuthenticatedProfile> {
  const profile = await requireAuth();
  if (!allowedRoles.includes(profile.role)) {
    redirect('/dashboard?error=unauthorized');
  }
  return profile;
}

export interface NavItem {
  href: string;
  label: string;
  iconName: string;
  roles: UserRole[];
}

export const APP_NAVIGATION: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    iconName: 'LayoutDashboard',
    roles: ['super_admin', 'admin', 'teacher', 'accountant', 'librarian', 'student', 'parent'],
  },
  {
    href: '/students',
    label: 'Students & Promotions',
    iconName: 'GraduationCap',
    roles: ['super_admin', 'admin', 'teacher', 'parent', 'student'],
  },
  {
    href: '/users',
    label: 'Users & Staff',
    iconName: 'Users',
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/academics',
    label: 'Academics & Classes',
    iconName: 'BookOpen',
    roles: ['super_admin', 'admin', 'teacher', 'student', 'parent'],
  },
  {
    href: '/boards',
    label: 'Boards & Assessment',
    iconName: 'Award',
    roles: ['super_admin', 'admin', 'teacher'],
  },
  {
    href: '/exams',
    label: 'Examinations & Results',
    iconName: 'FileSpreadsheet',
    roles: ['super_admin', 'admin', 'teacher', 'student', 'parent'],
  },
  {
    href: '/timetables',
    label: 'Timetables',
    iconName: 'CalendarClock',
    roles: ['super_admin', 'admin', 'teacher', 'student', 'parent'],
  },
  {
    href: '/fees',
    label: 'Fees & Receipts',
    iconName: 'IndianRupee',
    roles: ['super_admin', 'admin', 'accountant', 'student', 'parent'],
  },
  {
    href: '/library',
    label: 'Library & Circulation',
    iconName: 'Library',
    roles: ['super_admin', 'admin', 'librarian', 'teacher', 'student', 'parent'],
  },
  {
    href: '/materials',
    label: 'Study Materials',
    iconName: 'FolderDown',
    roles: ['super_admin', 'admin', 'teacher', 'student', 'parent'],
  },
  {
    href: '/notices',
    label: 'Notices & Calendar',
    iconName: 'Megaphone',
    roles: ['super_admin', 'admin', 'teacher', 'accountant', 'librarian', 'student', 'parent'],
  },
  {
    href: '/settings',
    label: 'Settings & Audit Log',
    iconName: 'Settings',
    roles: ['super_admin', 'admin'],
  },
  {
    href: '/account',
    label: 'My Profile & Security',
    iconName: 'UserCog',
    roles: ['super_admin', 'admin', 'teacher', 'accountant', 'librarian', 'student', 'parent'],
  },
];
