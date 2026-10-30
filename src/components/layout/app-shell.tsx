'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  Award,
  FileSpreadsheet,
  CalendarClock,
  IndianRupee,
  Library,
  FolderDown,
  Megaphone,
  Settings,
  UserCog,
  LogOut,
  Menu,
  X,
  School,
} from 'lucide-react';
import { cn, ROLE_LABELS, ROLE_BADGE_STYLES, type UserRole } from '@/lib/utils';
import type { AuthenticatedProfile, NavItem } from '@/lib/auth';
import { logoutAction } from '@/lib/actions/auth';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  Award,
  FileSpreadsheet,
  CalendarClock,
  IndianRupee,
  Library,
  FolderDown,
  Megaphone,
  Settings,
  UserCog,
};

interface AppShellProps {
  profile: AuthenticatedProfile;
  schoolName: string;
  academicYearName: string;
  defaultBoardCode: string;
  navItems: NavItem[];
  children: React.ReactNode;
}

export function AppShell({
  profile,
  schoolName,
  academicYearName,
  defaultBoardCode,
  navItems,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const visibleNav = navItems.filter((item) => item.roles.includes(profile.role));

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-900 text-slate-100 border-r border-slate-800">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow">
            <School className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-white">
              {schoolName}
            </p>
            <p className="text-[11px] text-slate-400">
              Session {academicYearName} · {defaultBoardCode}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = ICONS[item.iconName] || LayoutDashboard;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {profile.full_name}
              </p>
              <p className="truncate text-[11px] text-slate-400">@{profile.username}</p>
            </div>
            <span
              className={cn(
                'rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                ROLE_BADGE_STYLES[profile.role as UserRole]
              )}
            >
              {ROLE_LABELS[profile.role as UserRole]}
            </span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-rose-600 hover:text-white transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-72 max-w-xs flex-1 flex-col bg-slate-900 text-white">
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
              <span className="text-sm font-bold">{schoolName}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {visibleNav.map((item) => {
                const Icon = ICONS[item.iconName] || LayoutDashboard;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium',
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Toggle navigation menu"
              className="lg:hidden rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 sm:text-base">
                {schoolName}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Academic Session {academicYearName} · Default Board: {defaultBoardCode} · INR (en-IN) · Asia/Kolkata
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-semibold',
                ROLE_BADGE_STYLES[profile.role as UserRole]
              )}
            >
              {ROLE_LABELS[profile.role as UserRole]}
            </span>
            <Link
              href="/account"
              className="hidden sm:inline-flex text-xs font-medium text-slate-700 hover:text-blue-700"
            >
              {profile.full_name}
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
