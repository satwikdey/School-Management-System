import { School, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1.5 text-white">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg">
            <School className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Vidya Bharati Model Senior Secondary School
          </h1>
          <p className="text-xs text-blue-200">
            School Management System v2 · CBSE · ICSE · WBBSE · WBCHSE · Custom Profiles
          </p>
        </div>

        <Card className="border-slate-800/20 shadow-2xl">
          <CardHeader>
            <CardTitle>Sign in to Your Account</CardTitle>
            <CardDescription>
              Enter your assigned username or institutional email. Public registration is disabled; accounts are provisioned by school administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Protected by Supabase Auth & PostgreSQL Row-Level Security</span>
        </div>
      </div>
    </div>
  );
}
