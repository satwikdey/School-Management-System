'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives';
import { AlertTriangle } from 'lucide-react';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="border-rose-200 bg-rose-50/40 max-w-xl mx-auto mt-10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-rose-800">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          Unable to Load Module
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-700">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <Button onClick={reset} variant="primary">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
