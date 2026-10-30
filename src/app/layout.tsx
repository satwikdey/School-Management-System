import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vidya Bharati SMS v2 — School Management System',
  description:
    'Modern Indian School Management System built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, and Supabase',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
