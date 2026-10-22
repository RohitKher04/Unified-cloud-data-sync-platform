import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Zap } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { Integration } from '@/types';
import { queryClient } from '@/lib/query-client';

type State = 'loading' | 'success' | 'error';

export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setState('error');
      setMessage('Google authorization was cancelled or denied. Please try again.');
      setTimeout(() => navigate('/integrations', { replace: true }), 3000);
      return;
    }

    if (!code || !stateParam) {
      setState('error');
      setMessage('Invalid OAuth response. Missing required parameters.');
      setTimeout(() => navigate('/integrations', { replace: true }), 3000);
      return;
    }

    // Exchange code via backend callback
    apiClient
      .get<Integration>(`/integrations/google/callback`, {
        params: { code, state: stateParam },
      })
      .then((res) => {
        setState('success');
        setMessage(`${res.data.external_email} connected successfully!`);
        // Invalidate integrations query so dashboard/integrations refresh
        void queryClient.invalidateQueries({ queryKey: ['integrations'] });
        toast.success('Google account connected!');
        setTimeout(() => navigate('/integrations', { replace: true }), 2000);
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : 'Failed to complete Google authorization.';
        setState('error');
        setMessage(msg);
        toast.error(msg);
        setTimeout(() => navigate('/integrations', { replace: true }), 3500);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
        {/* Logo */}
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
          <Zap className="h-6 w-6 text-white" />
        </div>

        {/* State icon + message */}
        {state === 'loading' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <h2 className="text-lg font-bold text-foreground">Completing authorization…</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Please wait while we connect your Google account.
              </p>
            </div>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-8 ring-emerald-500/5">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Account connected!</h2>
              <p className="text-sm text-muted-foreground mt-1">{message}</p>
              <p className="text-xs text-muted-foreground mt-2">Redirecting you back…</p>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 ring-8 ring-destructive/5">
              <XCircle className="h-9 w-9 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Authorization failed</h2>
              <p className="text-sm text-muted-foreground mt-1">{message}</p>
              <p className="text-xs text-muted-foreground mt-2">Redirecting you back…</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
