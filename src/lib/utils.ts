import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'teacher'
  | 'accountant'
  | 'librarian'
  | 'student'
  | 'parent';

export type BoardCode = 'CBSE' | 'ICSE' | 'WBBSE' | 'WBCHSE' | 'CUSTOM';

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrator',
  admin: 'Administrator',
  teacher: 'Teacher',
  accountant: 'Accountant',
  librarian: 'Librarian',
  student: 'Student',
  parent: 'Parent',
};

export const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 text-purple-900 border-purple-300',
  admin: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  teacher: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  accountant: 'bg-amber-100 text-amber-900 border-amber-300',
  librarian: 'bg-cyan-100 text-cyan-900 border-cyan-300',
  student: 'bg-blue-100 text-blue-900 border-blue-300',
  parent: 'bg-rose-100 text-rose-900 border-rose-300',
};

export const BOARD_LABELS: Record<BoardCode, string> = {
  CBSE: 'CBSE (Central Board of Secondary Education — Demo Profile)',
  ICSE: 'ICSE (Indian Certificate of Secondary Education — Demo Profile)',
  WBBSE: 'WBBSE (West Bengal Board of Secondary Education — Demo Profile)',
  WBCHSE: 'WBCHSE (West Bengal Council of Higher Secondary Education — Semester I–IV Demo Profile)',
  CUSTOM: 'Custom School Assessment Profile',
};

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount ?? 0);
  if (Number.isNaN(num)) return '₹0.00';
  return inrFormatter.format(num);
}

export function formatDateIN(
  value: string | Date | null | undefined,
  includeTime = false
): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }
      : {}),
  }).format(d);
}

export function formatDateTimeIN(
  value: string | Date | null | undefined
): string {
  return formatDateIN(value, true);
}

export function formatBoardDisplay(
  boardCode: BoardCode | string | null | undefined,
  customName?: string | null
): string {
  if (!boardCode) return 'CBSE';
  if (boardCode === 'CUSTOM' && customName) {
    return `CUSTOM (${customName})`;
  }
  return String(boardCode);
}
