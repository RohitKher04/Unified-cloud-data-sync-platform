import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export type BadgeStatusType =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'pending'
  | string;

export interface StatusBadgeProps {
  status: BadgeStatusType;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'default';
}

export function StatusBadge({
  status,
  showIcon = true,
  className,
  size = 'default',
}: StatusBadgeProps): React.JSX.Element {
  const normalized = (status || '').toLowerCase();

  switch (normalized) {
    case 'running':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          {showIcon && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          )}
          <RefreshCw className={cn('h-3 w-3 animate-spin', !showIcon && 'hidden')} />
          <span>Syncing</span>
        </span>
      );

    case 'completed':
    case 'connected':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          {showIcon && <CheckCircle2 className="h-3 w-3" />}
          <span>{normalized === 'connected' ? 'Connected' : 'Completed'}</span>
        </span>
      );

    case 'failed':
    case 'error':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full bg-destructive/10 text-destructive border border-destructive/20',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          {showIcon && <XCircle className="h-3 w-3" />}
          <span>{normalized === 'error' ? 'Error' : 'Failed'}</span>
        </span>
      );

    case 'cancelled':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          {showIcon && <AlertCircle className="h-3 w-3" />}
          <span>Cancelled</span>
        </span>
      );

    case 'queued':
    case 'pending':
    case 'disconnected':
    default:
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-medium rounded-full bg-muted text-muted-foreground border border-border',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
            className
          )}
        >
          {showIcon && <Clock className="h-3 w-3" />}
          <span className="capitalize">{normalized || 'Unknown'}</span>
        </span>
      );
  }
}
