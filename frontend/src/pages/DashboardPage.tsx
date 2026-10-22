import React, { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { integrationApi, syncApi, emailApi } from '@/lib/api';
import { formatRelativeTime, formatSmartTime } from '@/lib/formatters';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SkeletonCard, SkeletonRow } from '@/components/shared/Skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Plug,
  RefreshCw,
  Clock,
  ArrowRight,
  Inbox,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}): React.JSX.Element {
  return (
    <Card className={cn('transition-all duration-150 hover:shadow-sm', accent && 'border-primary/20 bg-primary/5')}>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          accent ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        )}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectHero(): React.JSX.Element {
  return (
    <Card className="border-dashed bg-gradient-to-br from-indigo-500/5 via-violet-500/5 to-transparent">
      <CardContent className="p-8 flex flex-col items-center text-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-primary ring-8 ring-primary/5">
          <Zap className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">Connect your first account</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Link your Gmail account to start syncing emails automatically. Takes under a minute.
          </p>
        </div>
        <Button asChild className="gap-2 shadow-md shadow-primary/20">
          <Link to="/integrations">
            <Plug className="h-4 w-4" />
            Connect Google Account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function greeting(name: string | null | undefined): string {
  const hour = new Date().getHours();
  const time = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${time}, ${name}` : time;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: integrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationApi.list,
  });

  const { data: syncJobs, isLoading: loadingJobs } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: () => syncApi.listJobs(),
    refetchInterval: (query) => {
      const latest = query.state.data?.[0];
      if (latest?.status === 'queued' || latest?.status === 'running') {
        return 3000;
      }
      return false;
    },
  });

  const hasIntegrations = (integrations?.length ?? 0) > 0;

  const { data: emailData, isLoading: loadingEmails } = useQuery({
    queryKey: ['emails-recent'],
    queryFn: () => emailApi.list({ limit: 5 }),
    enabled: hasIntegrations,
  });

  const { data: unreadEmailData } = useQuery({
    queryKey: ['emails-unread-count'],
    queryFn: () => emailApi.list({ is_read: false, limit: 1 }),
    enabled: hasIntegrations,
  });

  const latestJob = syncJobs?.[0];
  const isSyncRunning = latestJob?.status === 'queued' || latestJob?.status === 'running';

  // Automatically refresh email counts and integrations when a sync job finishes
  const prevJobStatus = useRef(latestJob?.status);
  useEffect(() => {
    if (prevJobStatus.current !== latestJob?.status) {
      if (latestJob?.status === 'completed' || latestJob?.status === 'failed') {
        void qc.invalidateQueries({ queryKey: ['emails-recent'] });
        void qc.invalidateQueries({ queryKey: ['emails-unread-count'] });
        void qc.invalidateQueries({ queryKey: ['integrations'] });
      }
      prevJobStatus.current = latestJob?.status;
    }
  }, [latestJob?.status, qc]);

  // If no integrations are connected, totalEmails MUST be 0 and recentEmails empty
  const totalEmails = hasIntegrations ? (emailData?.total ?? 0) : 0;
  const unreadEmails = hasIntegrations ? (unreadEmailData?.total ?? 0) : 0;
  const recentEmails = hasIntegrations ? (emailData?.items ?? []) : [];

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={greeting(user?.first_name)}
        description="Here's an overview of your sync activity and recent emails."
      />

      {/* Stat cards */}
      {loadingIntegrations || loadingJobs ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Mail className="h-5 w-5" />}
            label="Total Emails"
            value={totalEmails.toLocaleString()}
            sub="All synced messages"
            accent={totalEmails > 0}
          />
          <StatCard
            icon={<Inbox className="h-5 w-5" />}
            label="Unread"
            value={unreadEmails}
            sub="Awaiting review"
          />
          <StatCard
            icon={<Plug className="h-5 w-5" />}
            label="Integrations"
            value={integrations?.length ?? 0}
            sub={hasIntegrations ? `${integrations?.filter(i => i.status === 'connected').length} connected` : 'None connected'}
          />
          <StatCard
            icon={
              isSyncRunning ? (
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Clock className="h-5 w-5" />
              )
            }
            label="Last Sync"
            value={
              isSyncRunning
                ? 'Syncing…'
                : latestJob?.completed_at
                ? formatSmartTime(latestJob.completed_at)
                : '—'
            }
            sub={
              isSyncRunning
                ? `${latestJob?.records_processed ?? 0} records processed`
                : latestJob
                ? `${latestJob.records_processed} records`
                : 'No syncs yet'
            }
            accent={isSyncRunning}
          />
        </div>
      )}

      {/* Connect hero when no integrations */}
      {!loadingIntegrations && !hasIntegrations && <ConnectHero />}

      {/* Content row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Latest sync job card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Latest Sync</CardTitle>
              <Link to="/sync" className="text-xs text-primary hover:underline underline-offset-4">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loadingJobs ? (
              <SkeletonRow />
            ) : latestJob ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={latestJob.status} />
                    {isSyncRunning && (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(latestJob.created_at)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Processed', value: latestJob.records_processed },
                    { label: 'Created', value: latestJob.records_created },
                    { label: 'Updated', value: latestJob.records_updated },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-muted/50 p-2.5 text-center">
                      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                {latestJob.error_message && (
                  <p className="text-xs text-destructive bg-destructive/5 rounded-lg p-2">
                    {latestJob.error_message}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <RefreshCw className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No sync jobs yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent emails */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Emails</CardTitle>
              <Link to="/emails" className="text-xs text-primary hover:underline underline-offset-4">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {!hasIntegrations && !loadingIntegrations ? (
              <div className="text-center py-6">
                <Mail className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Connect an account to see emails</p>
              </div>
            ) : loadingEmails ? (
              <div className="space-y-0">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : recentEmails.length === 0 ? (
              <div className="text-center py-6">
                <Mail className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No emails synced yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60 -mx-6">
                {recentEmails.map((email) => {
                  const senderName = email.sender?.split('<')[0].trim() || email.sender || 'Unknown';
                  const initials = senderName.slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={email.id}
                      className="flex items-center gap-3 px-6 py-3 hover:bg-muted/40 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-xs font-semibold text-primary">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!email.is_read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          )}
                          <p className={cn(
                            'text-xs truncate',
                            !email.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'
                          )}>
                            {senderName}
                          </p>
                        </div>
                        <p className={cn(
                          'text-xs truncate mt-0.5',
                          !email.is_read ? 'font-medium text-foreground' : 'text-muted-foreground'
                        )}>
                          {email.subject || '(No subject)'}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatSmartTime(email.received_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
