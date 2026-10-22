import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Layers,
} from 'lucide-react';

import { syncApi, integrationApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/api-client';
import { formatRelativeTime, formatDuration } from '@/lib/formatters';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SkeletonRow, SkeletonCard } from '@/components/shared/Skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const SyncActivityPage: React.FC = () => {
  const qc = useQueryClient();

  const { data: integrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationApi.list,
  });

  const primaryIntegration = integrations?.find((i) => i.status === 'connected') || integrations?.[0];

  const {
    data: syncJobs,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: () => syncApi.listJobs(50),
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(
        (j) => j.status === 'queued' || j.status === 'running'
      );
      return hasActive ? 3000 : false;
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => {
      if (!primaryIntegration) throw new Error('No connected integration available.');
      return syncApi.trigger(primaryIntegration.id);
    },
    onSuccess: () => {
      toast.success('Sync job queued!');
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const jobs = syncJobs ?? [];
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;
  const activeCount = jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Sync Activity"
        description="Monitor background synchronization tasks, job statuses, and record processing history."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2 text-xs"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Refresh
            </Button>
            {primaryIntegration && (
              <Button
                size="sm"
                onClick={() => syncMutation.mutate()}
                isLoading={syncMutation.isPending || activeCount > 0}
                className="gap-2 text-xs"
              >
                {!syncMutation.isPending && activeCount === 0 && (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {activeCount > 0 ? 'Sync in Progress' : 'Sync Now'}
              </Button>
            )}
          </div>
        }
      />

      {/* Overview Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Total Jobs
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">{jobs.length}</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Activity className={cn('h-5 w-5', activeCount > 0 && 'animate-pulse')} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Active / Running
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">{activeCount}</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Completed
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">{completedCount}</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Failed
              </p>
              <p className="text-xl font-bold text-foreground tabular-nums">{failedCount}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Jobs List / Table */}
      <Card className="overflow-hidden border border-border shadow-xs">
        <CardHeader className="py-4 px-6 border-b border-border bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Job History</span>
            <span className="text-xs font-normal text-muted-foreground">
              Showing last {jobs.length} jobs
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border/60">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4">
                  <SkeletonRow />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">No sync jobs yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Sync jobs triggered via Integrations or Celery workers will be recorded and tracked here.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {jobs.map((job) => {
                const isActive = job.status === 'queued' || job.status === 'running';

                return (
                  <div
                    key={job.id}
                    className={cn(
                      'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:px-6 transition-colors duration-150 hover:bg-muted/30',
                      isActive && 'bg-primary/[0.02]'
                    )}
                  >
                    {/* Status & Job Info */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        <StatusBadge status={job.status} size="sm" />
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground capitalize">
                            {job.job_type || 'Initial'} Sync
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            #{job.id}
                          </span>
                          {isActive && (
                            <RefreshCw className="h-3 w-3 animate-spin text-primary shrink-0" />
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Started {formatRelativeTime(job.created_at)}
                          {job.completed_at && (
                            <> · Completed {formatRelativeTime(job.completed_at)}</>
                          )}
                        </p>

                        {job.error_message && (
                          <p className="text-xs text-destructive mt-1 bg-destructive/5 rounded-md px-2 py-1 max-w-md">
                            {job.error_message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Stats pills */}
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      <div className="rounded-lg bg-muted/50 px-2.5 py-1 text-center">
                        <span className="font-bold text-foreground tabular-nums">
                          {job.records_processed}
                        </span>
                        <span className="text-muted-foreground ml-1">processed</span>
                      </div>

                      <div className="rounded-lg bg-muted/50 px-2.5 py-1 text-center hidden md:block">
                        <span className="font-bold text-foreground tabular-nums">
                          {job.records_created}
                        </span>
                        <span className="text-muted-foreground ml-1">created</span>
                      </div>

                      <div className="rounded-lg bg-muted/50 px-2.5 py-1 text-center hidden md:block">
                        <span className="font-bold text-foreground tabular-nums">
                          {job.records_updated}
                        </span>
                        <span className="text-muted-foreground ml-1">updated</span>
                      </div>

                      <span className="text-muted-foreground font-mono tabular-nums text-[11px] w-14 text-right">
                        {formatDuration(job.started_at, job.completed_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
