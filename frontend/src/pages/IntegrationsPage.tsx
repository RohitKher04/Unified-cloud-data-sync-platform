import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plug,
  RefreshCw,
  Trash2,
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
      if (status === 'queued' || status === 'running') return 4000;
      return false;
    },
  });

  // When job reaches terminal state, refresh integrations + jobs list
  useEffect(() => {
    if (data?.status === 'completed' || data?.status === 'failed') {
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
}: {
  integration: Integration;
  syncJobs?: SyncJob[];
}): React.JSX.Element {
  const qc = useQueryClient();
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Check if a sync job for this integration is currently active in the global sync-jobs list
  const runningJobFromList = syncJobs?.find(
    (j) => j.integration_id === integration.id && (j.status === 'queued' || j.status === 'running')
  );

  const effectiveJobId = activeJobId ?? (runningJobFromList ? runningJobFromList.id : null);
  const polledJob = useSyncPoller(effectiveJobId);
  const activeJob = polledJob ?? runningJobFromList;
  const isActive = activeJob?.status === 'queued' || activeJob?.status === 'running';

  // Watch for job transition from active to completed/failed
  const prevStatus = useRef(activeJob?.status);
  useEffect(() => {
    if (prevStatus.current && (prevStatus.current === 'queued' || prevStatus.current === 'running')) {
      if (activeJob?.status === 'completed') {
        toast.success(`Sync completed — ${activeJob.records_processed} records processed.`);
        setActiveJobId(null);
        void qc.invalidateQueries({ queryKey: ['integrations'] });
        void qc.invalidateQueries({ queryKey: ['emails-recent'] });
        void qc.invalidateQueries({ queryKey: ['emails-unread-count'] });
      } else if (activeJob?.status === 'failed') {
        toast.error(activeJob.error_message || 'Sync failed. Please try again.');
        setActiveJobId(null);
      }
    }
    prevStatus.current = activeJob?.status;
  }, [activeJob?.status, activeJob?.records_processed, activeJob?.error_message, qc]);

  const syncMutation = useMutation({
    mutationFn: () => syncApi.trigger(integration.id),
    onSuccess: (data) => {
      toast.success('Sync job queued!');
      setActiveJobId(data.job_id);
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('progress')) {
        toast.info('A sync is already in progress for this account.');
      } else {
        toast.error(msg);
      }
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => integrationApi.disconnect(integration.id),
    onSuccess: () => {
      toast.success('Account disconnected.');
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      void qc.removeQueries({ queryKey: ['emails-recent'] });
      void qc.removeQueries({ queryKey: ['emails'] });
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const isSyncing = syncMutation.isPending || isActive;

  return (
    <>
      <Card className="transition-all duration-150 hover:shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {/* Provider icon */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background shadow-xs">
              <GoogleIcon size={22} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">Google Gmail</span>
                <StatusBadge status={integration.status} size="sm" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{integration.external_email}</p>
              {integration.last_synced_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last synced {formatRelativeTime(integration.last_synced_at)}
                </p>
              )}

              {/* Active job progress strip */}
              {isActive && activeJob && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                  </div>
                  <span className="text-xs text-blue-500 font-medium capitalize">{activeJob.status}…</span>
                  <span className="text-xs text-muted-foreground">
                    {activeJob.records_processed} records
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
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
                variant="ghost"
                size="icon"
                onClick={() => setShowConfirm(true)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Disconnect"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {
          setShowConfirm(false);
          disconnectMutation.mutate();
        }}
        isLoading={disconnectMutation.isPending}
        variant="destructive"
        title="Disconnect account?"
        description={`This will disconnect ${integration.external_email} and remove its synchronized data from SyncPlatform.`}
        confirmLabel="Disconnect"
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

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected === 'true') {
      toast.success('Google account connected successfully!');
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
      navigate('/integrations', { replace: true });
    } else if (error) {
      toast.error('Google authorization failed or was cancelled.');
      navigate('/integrations', { replace: true });
    }
  }, [searchParams, navigate, qc]);

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationApi.list,
  });

  const { data: syncJobs } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: () => syncApi.listJobs(),
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(
        (j) => j.status === 'queued' || j.status === 'running'
      );
      return hasActive ? 3000 : false;
    },
  });

  const handleConnect = async (): Promise<void> => {
    setConnecting(true);
    try {
      const url = await integrationApi.getConnectUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(getErrorMessage(err));
      setConnecting(false);
    }
  };

  const hasIntegrations = (integrations?.length ?? 0) > 0;

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Integrations"
        description="Connect third-party cloud accounts to automatically synchronize your data."
        actions={
          <Button
            onClick={handleConnect}
            isLoading={connecting}
            className="gap-2 shadow-sm shadow-primary/20"
          >
            {!connecting && <GoogleIcon size={16} />}
            Connect Google Account
          </Button>
        }
      />

      {/* Connected accounts */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Connected Accounts
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !hasIntegrations ? (
          <EmptyState
            icon={<Plug className="h-8 w-8" />}
            title="No accounts connected"
            description="Connect your Google account to start syncing Gmail messages automatically."
            action={{
              label: 'Connect Google Account',
              onClick: handleConnect,
              isLoading: connecting,
              icon: <GoogleIcon size={15} />,
            }}
          />
        ) : (
          <div className="space-y-3">
            {integrations?.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                syncJobs={syncJobs}
              />
            ))}
          </div>
        )}
      </section>

      {/* Coming soon providers */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Coming Soon
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {COMING_SOON.map(({ name, icon, desc }) => (
            <div
              key={name}
              className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-4 opacity-60 cursor-default select-none"
            >
              <span className="text-xl">{icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{desc}</p>
                <Badge variant="muted" className="mt-1.5 text-[10px] px-1.5 py-0">
                  Coming soon
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
