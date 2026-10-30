'use client';

import * as React from 'react';
import { Button } from '@/components/ui/primitives';
import { CheckCircle2, AlertCircle, Loader2, Printer } from 'lucide-react';

interface ActionFormProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action'> {
  action: (formData: FormData) => Promise<{ error?: string; success?: string } | void>;
  submitLabel: string;
  submitVariant?: 'primary' | 'secondary' | 'outline' | 'danger';
  resetOnSuccess?: boolean;
  children: React.ReactNode;
}

export function ActionForm({
  action,
  submitLabel,
  submitVariant = 'primary',
  resetOnSuccess = false,
  children,
  className,
  ...props
}: ActionFormProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await action(formData);
      if (res && 'error' in res && res.error) {
        setError(res.error);
      } else if (res && 'success' in res && res.success) {
        setSuccess(res.success);
        if (resetOnSuccess) {
          formRef.current?.reset();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={className} {...props}>
      {children}

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button type="submit" variant={submitVariant} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function PrintButton({ label = 'Print Report' }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="no-print"
      onClick={() => window.print()}
    >
      <Printer className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
