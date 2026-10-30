'use client';

import * as React from 'react';
import Link from 'next/link';
import { loginAction } from '@/lib/actions/auth';
import { Button, Input, Label } from '@/components/ui/primitives';
import { AlertCircle, Loader2, KeyRound, UserCheck } from 'lucide-react';

const QUICK_ACCOUNTS = [
  { role: 'Super Admin', username: 'superadmin', email: 'superadmin@vidyabharati.edu.in' },
  { role: 'Administrator', username: 'admin', email: 'admin@vidyabharati.edu.in' },
  { role: 'Teacher', username: 'teacher', email: 'teacher@vidyabharati.edu.in' },
  { role: 'Accountant', username: 'accountant', email: 'accountant@vidyabharati.edu.in' },
  { role: 'Librarian', username: 'librarian', email: 'librarian@vidyabharati.edu.in' },
  { role: 'Student', username: 'student', email: 'student@vidyabharati.edu.in' },
  { role: 'Parent', username: 'parent', email: 'parent@vidyabharati.edu.in' },
];

export function LoginForm() {
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.set('identifier', identifier);
    fd.set('password', password);

    try {
      const res = await loginAction(fd);
      if (res && 'error' in res && res.error) {
        setError(res.error);
        setPending(false);
      }
    } catch {
      // Redirect throws NEXT_REDIRECT in Next.js App Router, which is normal
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="identifier">Username or Email Address</Label>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            required
            autoComplete="username"
            placeholder="e.g. superadmin or admin@vidyabharati.edu.in"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" className="w-full h-10" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Sign in to Portal
        </Button>
      </form>

      <div className="pt-4 border-t border-slate-200">
        <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5 text-blue-700" />
          Demo Accounts — Click any role to autofill (Password: <code className="bg-slate-100 px-1 rounded">School@2026</code>)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {QUICK_ACCOUNTS.map((acc) => (
            <button
              key={acc.username}
              type="button"
              onClick={() => {
                setIdentifier(acc.username);
                setPassword('School@2026');
                setError(null);
              }}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <div className="text-[11px] font-semibold text-slate-900">{acc.role}</div>
              <div className="text-[10px] text-slate-500">@{acc.username}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
