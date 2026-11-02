import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plug,
  RefreshCw,
  Trash2,
  StopCircle,
} from 'lucide-react';

import { integrationApi, syncApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/api-client';
import type { Integration, SyncJob } from '@/types';
import { formatRelativeTime } from '@/lib/formatters';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SkeletonCard } from '@/components/shared/Skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Provider registry ─────────────────────────────────────────────────────────
const COMING_SOON = [
  { name: 'Google Drive', icon: '📁', desc: 'File & doc synchronization' },
  { name: 'Google Calendar', icon: '📅', desc: 'Events and scheduling' },
  { name: 'Microsoft Outlook', icon: '📫', desc: 'Microsoft Graph email sync' },
  { name: 'OneDrive', icon: '☁️', desc: 'Microsoft cloud storage' },
  { name: 'Dropbox', icon: '📦', desc: 'Multi-cloud delta sync' },
  { name: 'Slack', icon: '💬', desc: 'Message & channel export' },
  { name: 'Notion', icon: '📝', desc: 'Workspace data sync' },
];

// Google SVG icon
function GoogleIcon({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

// ── Job status poller for a single integration ────────────────────────────────
function useSyncPoller(activeJobId: number | null): SyncJob | null {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['sync-job', activeJobId],
    queryFn: () => syncApi.getJob(activeJobId!),
    enabled: activeJobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'queued' || status === 'running') return 2500;
      return false;
    },
  });

  // When job reaches terminal state, refresh integrations + jobs list
  useEffect(() => {
    if (
      data?.status === 'completed' ||
      data?.status === 'failed' ||
      data?.status === 'cancelled'
    ) {
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
    }
  }, [data?.status, qc]);

  return data ?? null;
}

// ── Single integration card ───────────────────────────────────────────────────
function IntegrationCard({
  integration,
  syncJobs,
  onConnect,
  isConnecting,
}: {
  integration: Integration;
  syncJobs?: SyncJob[];
  onConnect: () => void;
  isConnecting?: boolean;
}): React.JSX.Element {
  const qc = useQueryClient();
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const isDisconnected = integration.status === 'disconnected';

  // Check if a sync job for this integration is currently active in the global sync-jobs list
  const runningJobFromList = syncJobs?.find(
    (j) => j.integration_id === integration.id && (j.status === 'queued' || j.status === 'running')
  );

  const effectiveJobId = activeJobId ?? (runningJobFromList ? runningJobFromList.id : null);
  const polledJob = useSyncPoller(effectiveJobId);
  const activeJob = polledJob ?? runningJobFromList;
  const isActive = activeJob?.status === 'queued' || activeJob?.status === 'running';

  // Watch for job transition from active to completed/failed/cancelled
  const prevStatus = useRef(activeJob?.status);
  useEffect(() => {
    if (prevStatus.current && (prevStatus.current === 'queued' || prevStatus.current === 'running')) {
      if (activeJob?.status === 'completed') {
        toast.success(`Sync completed — ${activeJob.records_processed} records processed.`, {
          id: `sync-done-${integration.id}`,
        });
        setActiveJobId(null);
        void qc.invalidateQueries({ queryKey: ['integrations'] });
        void qc.invalidateQueries({ queryKey: ['emails-recent'] });
        void qc.invalidateQueries({ queryKey: ['emails-unread-count'] });
      } else if (activeJob?.status === 'failed') {
        toast.error(activeJob.error_message || 'Sync failed. Please try again.', {
          id: `sync-failed-${integration.id}`,
        });
        setActiveJobId(null);
      } else if (activeJob?.status === 'cancelled') {
        toast.info('Sync cancelled.', { id: `sync-cancelled-${integration.id}` });
        setActiveJobId(null);
      }
    }
    prevStatus.current = activeJob?.status;
  }, [activeJob?.status, activeJob?.records_processed, activeJob?.error_message, qc, integration.id]);

  const syncMutation = useMutation({
    mutationFn: () => syncApi.trigger(integration.id),
    onSuccess: (data) => {
      toast.success('Sync job queued!', { id: `sync-queued-${integration.id}` });
      setActiveJobId(data.job_id);
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('progress')) {
        toast.info('A sync is already in progress for this account.', {
          id: `sync-inprogress-${integration.id}`,
        });
      } else {
        toast.error(msg, { id: `sync-error-${integration.id}` });
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!activeJob) throw new Error('No active job to cancel.');
      return syncApi.cancelJob(activeJob.id);
    },
    onSuccess: () => {
      toast.info('Sync cancelled.', { id: `sync-cancelled-${integration.id}` });
      // Instant reset so UI updates immediately without waiting for poller
      setActiveJobId(null);
      if (activeJob) {
        qc.setQueryData(['sync-job', activeJob.id], (old: SyncJob | undefined) =>
          old ? { ...old, status: 'cancelled' } : undefined
        );
      }
      qc.setQueryData(['sync-jobs'], (old: SyncJob[] | undefined) =>
        old ? old.map((j) => (j.id === activeJob?.id ? { ...j, status: 'cancelled' } : j)) : undefined
      );
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (err) => toast.error(getErrorMessage(err) || 'Could not cancel sync.'),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => integrationApi.disconnect(integration.id),
    onSuccess: () => {
      toast.success(
        isDisconnected
          ? 'Account and data permanently removed.'
          : 'Account disconnected.',
        { id: `disconnect-${integration.id}` }
      );
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      void qc.invalidateQueries({ queryKey: ['emails-recent'] });
      void qc.invalidateQueries({ queryKey: ['emails'] });
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
    },
    onError: (err) => toast.error(getErrorMessage(err), { id: `disconnect-err-${integration.id}` }),
  });

  const isSyncing = syncMutation.isPending || isActive;

  return (
    <>
      <Card
        className={cn(
          'transition-all duration-200 border shadow-xs hover:shadow-md',
          isDisconnected
            ? 'border-dashed border-border/80 bg-muted/15'
            : 'border-border'
        )}
      >
        <CardContent className="p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/60 border border-border/60 shadow-xs">
                <GoogleIcon size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-foreground capitalize">
                    {integration.provider} {integration.integration_type}
                  </h3>
                  <StatusBadge status={integration.status} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {integration.external_email || integration.external_account_id}
                </p>
              </div>
            </div>

            {/* Syncing indicator badge */}
            {isActive && (
              <Badge variant="outline" className="gap-1.5 text-xs text-primary border-primary/30 bg-primary/5 animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Syncing…
              </Badge>
            )}
          </div>

          {/* Sync Progress Bar */}
          {isActive && activeJob && (
            <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Syncing in background</span>
                <span className="font-mono tabular-nums">
                  {activeJob.records_processed} processed
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-primary/20 overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse w-2/3 transition-all duration-300" />
              </div>
            </div>
          )}

          {/* Details / timestamps */}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/70 block">
                Connected
              </span>
              <span>{formatRelativeTime(integration.created_at)}</span>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/70 block">
                Last Sync
              </span>
              <span>
                {integration.last_synced_at
                  ? formatRelativeTime(integration.last_synced_at)
                  : 'Never'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {isDisconnected ? (
              <>
                <Button
                  size="sm"
                  onClick={onConnect}
                  disabled={isConnecting}
                  className="gap-2 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/25 shadow-xs transition-colors"
                >
                  <GoogleIcon size={14} />
                  Reconnect Account
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowConfirm(true)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  title="Permanently remove account and data"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : isActive ? (
              /* Instant Cancel button when syncing */
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30"
              >
                <StopCircle className="h-3.5 w-3.5" />
                Cancel
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={isSyncing}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
                  {isSyncing ? 'Syncing…' : 'Sync Now'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirm(true)}
                  disabled={disconnectMutation.isPending}
                  className="text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Disconnect/Delete confirmation */}
      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title={isDisconnected ? 'Permanently Remove Account?' : 'Disconnect Google Account?'}
        description={
          isDisconnected
            ? 'This will permanently delete this integration and purge all associated synced emails and history from your database.'
            : 'Background sync will stop and your credentials will be revoked. You can reconnect this account at any time.'
        }
        confirmLabel={isDisconnected ? 'Remove Permanently' : 'Disconnect'}
        variant="destructive"
        isLoading={disconnectMutation.isPending}
        onConfirm={() => {
          disconnectMutation.mutate();
          setShowConfirm(false);
        }}
      />
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export const IntegrationsPage: React.FC = () => {
  const [connecting, setConnecting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toastShown = useRef(false);

  // Stop button spinner if user navigated back via browser arrow (bfcache restore) or switched tabs
  useEffect(() => {
    const handlePageShow = (): void => {
      setConnecting(false);
    };
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        setConnecting(false);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (!connected && !error) return;
    if (toastShown.current) return;
    toastShown.current = true;

    if (connected === 'true') {
      toast.success('Google account connected successfully!', { id: 'oauth-connected' });
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
      navigate('/integrations', { replace: true });
    } else if (error) {
      let message = 'Google authorization failed. Start the connection again.';
      if (error !== 'cancelled' && error !== 'failed' && error !== 'no_code') {
        try {
          message = decodeURIComponent(error);
        } catch {
          message = error;
        }
      }
      toast.error(message, {
        id: 'oauth-error',
      });
      navigate('/integrations', { replace: true });
    }
  }, [searchParams, navigate, qc]);

  const { data: syncJobs } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: () => syncApi.listJobs(10),
    // Live poll sync status in Integrations page too!
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(
        (j) => j.status === 'queued' || j.status === 'running'
      );
      return hasActive ? 2500 : false;
    },
  });

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationApi.list,
  });

  const handleConnect = async (): Promise<void> => {
    setConnecting(true);
    try {
      const authUrl = await integrationApi.getConnectUrl();
      window.location.href = authUrl;
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Could not start Google authorization.');
      setConnecting(false);
    }
  };

  const activeIntegrations = integrations?.filter((i) => i.status !== 'disconnected') ?? [];
  const disconnectedIntegrations = integrations?.filter((i) => i.status === 'disconnected') ?? [];

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        title="Integrations"
        description="Connect and manage your cloud service providers to sync messages, files, and data."
        actions={
          <Button
            onClick={handleConnect}
            isLoading={connecting}
            className="gap-2 shadow-xs"
          >
            {!connecting && <GoogleIcon size={16} />}
            Connect Google
          </Button>
        }
      />

      {/* Connected Accounts */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Connected Accounts
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active integrations syncing data to your unified inbox.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : activeIntegrations.length === 0 ? (
          <EmptyState
            icon={<Plug className="h-6 w-6" />}
            title="No connected integrations"
            description="Connect your Gmail account to begin synchronizing emails in real-time."
            action={{
              label: 'Connect Google',
              onClick: handleConnect,
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                syncJobs={syncJobs}
                onConnect={handleConnect}
                isConnecting={connecting}
              />
            ))}
          </div>
        )}
      </div>

      {/* Previously Disconnected Accounts */}
      {disconnectedIntegrations.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Previously Disconnected
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              These accounts are paused. Reconnect to resume sync, or remove permanently.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disconnectedIntegrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                syncJobs={syncJobs}
                onConnect={handleConnect}
                isConnecting={connecting}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available / Coming Soon Services */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Available Integrations
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            More cloud platforms coming soon to Unified Cloud Data Sync.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {COMING_SOON.map((service) => (
            <Card
              key={service.name}
              className="p-4 flex items-center justify-between border-dashed border-border/80 bg-muted/10 opacity-70 hover:opacity-100 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" role="img" aria-label={service.name}>
                  {service.icon}
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">{service.name}</p>
                  <p className="text-[11px] text-muted-foreground">{service.desc}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] text-muted-foreground font-normal shrink-0">
                Soon
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};