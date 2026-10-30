import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@/components/ui/primitives';
import { ActionForm } from '@/components/ui/action-form';
import { requestPasswordRecoveryAction } from '@/lib/actions/auth';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account Password Recovery</CardTitle>
          <CardDescription>
            Enter your institutional email address to receive a password reset link, or contact a School Administrator for an immediate password reset.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ActionForm action={requestPasswordRecoveryAction} submitLabel="Send Recovery Link">
            <div>
              <Label htmlFor="email">Institutional Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="name@vidyabharati.edu.in"
              />
            </div>
          </ActionForm>
          <div className="pt-2 border-t border-slate-100 text-center">
            <Link href="/login" className="text-xs font-medium text-blue-700 hover:underline">
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
