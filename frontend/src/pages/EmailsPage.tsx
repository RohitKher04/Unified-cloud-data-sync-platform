import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Mail,
  Search,
  Star,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plug,
  X,
  Keyboard,
} from 'lucide-react';

import { emailApi, integrationApi, syncApi } from '@/lib/api';
import { formatSmartTime, formatRelativeTime } from '@/lib/formatters';
import type { EmailListItem } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonRow } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmailDetailDrawer } from '@/features/emails/EmailDetailDrawer';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

export const EmailsPage: React.FC = () => {
  const qc = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'starred'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  // Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
      setHighlightedIndex(-1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Query connected integrations
  const { data: integrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationApi.list,
  });

  const primaryIntegration =
    integrations?.find((i) => i.status === 'connected') || integrations?.[0];
  const hasIntegrations = (integrations?.length ?? 0) > 0;

  // Query sync jobs to detect if active sync is running
  const { data: syncJobs } = useQuery({
    queryKey: ['sync-jobs'],
    queryFn: () => syncApi.listJobs(10),
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(
        (j) => j.status === 'queued' || j.status === 'running'
      );
      return hasActive ? 3000 : false;
    },
  });

  const latestJob = syncJobs?.[0];
  const isSyncRunning =
    latestJob?.status === 'queued' || latestJob?.status === 'running';

  // Trigger quick sync mutation
  const syncMutation = useMutation({
    mutationFn: () => {
      if (!primaryIntegration) throw new Error('No connected integration available.');
      return syncApi.trigger(primaryIntegration.id);
    },
    onSuccess: () => {
      toast.success('Sync job queued!');
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
      void qc.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: () => toast.error('Could not queue sync job. Try again.'),
  });

  // Query emails with filters, search, and pagination
  const {
    data: emailData,
    isLoading: loadingEmails,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      'emails',
      {
        page,
        q: debouncedQuery,
        tab: activeTab,
      },
    ],
    queryFn: () =>
      emailApi.list({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        q: debouncedQuery || undefined,
        is_read: activeTab === 'unread' ? false : undefined,
        is_starred: activeTab === 'starred' ? true : undefined,
      }),
    enabled: hasIntegrations,
  });

  // Query unread count for the tab badge
  const { data: unreadData } = useQuery({
    queryKey: ['emails-unread-count'],
    queryFn: () => emailApi.list({ is_read: false, limit: 1 }),
    enabled: hasIntegrations,
  });

  const total = emailData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const items = emailData?.items ?? [];
  const unreadCount = unreadData?.total ?? 0;

  // Inline star toggle mutation
  const toggleStarMutation = useMutation({
    mutationFn: ({ id, isStarred }: { id: number; isStarred: boolean }) =>
      emailApi.update(id, { is_starred: !isStarred }),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ['emails'] });
      toast.success(variables.isStarred ? 'Email unstarred' : 'Email starred');
    },
  });

  // Inline read toggle mutation
  const toggleReadMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: number; isRead: boolean }) =>
      emailApi.update(id, { is_read: !isRead }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['emails'] });
      void qc.invalidateQueries({ queryKey: ['emails-unread-count'] });
    },
  });

  const handleRowClick = (email: EmailListItem) => {
    setSelectedEmailId(email.id);
    if (!email.is_read) {
      toggleReadMutation.mutate({ id: email.id, isRead: false });
    }
  };

  // Keyboard navigation shortcuts: j, k, Enter, /, ?
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea';

      // Shortcuts when search input is focused
      if (isInput) {
        if (e.key === 'Escape') {
          searchInputRef.current?.blur();
        }
        return;
      }

      // Drawer is open - handled by drawer
      if (selectedEmailId !== null) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      if (e.key === 'j') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev < items.length - 1 ? prev + 1 : prev;
          return next;
        });
      } else if (e.key === 'k') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          return next;
        });
      } else if (e.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < items.length) {
          e.preventDefault();
          handleRowClick(items[highlightedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, highlightedIndex, selectedEmailId]);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Emails"
        description="Search, view, and organize messages synchronized from your connected accounts."
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Sync Status Chip */}
            {primaryIntegration && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors',
                  isSyncRunning
                    ? 'border-primary/40 bg-primary/5 text-primary'
                    : 'border-border bg-muted/40 text-muted-foreground'
                )}
              >
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isSyncRunning
                      ? 'bg-primary animate-pulse'
                      : 'bg-emerald-500'
                  )}
                />
                <span className="font-medium">
                  {isSyncRunning
                    ? 'Sync in progress…'
                    : primaryIntegration.last_synced_at
                    ? `Synced ${formatRelativeTime(primaryIntegration.last_synced_at)}`
                    : 'Connected'}
                </span>
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || isSyncRunning}
                  className="hover:text-foreground disabled:opacity-40 ml-1 transition-colors"
                  title="Trigger sync now"
                >
                  <RefreshCw
                    className={cn(
                      'h-3 w-3',
                      (syncMutation.isPending || isSyncRunning) && 'animate-spin'
                    )}
                  />
                </button>
              </div>
            )}

            {/* Keyboard shortcuts trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShortcutsModal(true)}
              className="h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Shortcuts</span>
              <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono border">?</kbd>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2 text-xs h-8"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* When no accounts connected */}
      {!loadingIntegrations && !hasIntegrations && (
        <EmptyState
          icon={<Plug className="h-8 w-8" />}
          title="No accounts connected"
          description="Connect your Google account in Integrations to view and search your emails here."
          action={{
            label: 'Go to Integrations',
            onClick: () => (window.location.href = '/integrations'),
          }}
        />
      )}

      {hasIntegrations && (
        <>
          {/* Controls bar: Search + Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1">
              <button
                onClick={() => {
                  setActiveTab('all');
                  setPage(1);
                  setHighlightedIndex(-1);
                }}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                  activeTab === 'all'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>All</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('unread');
                  setPage(1);
                  setHighlightedIndex(-1);
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                  activeTab === 'unread'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <Badge variant="default" className="h-4 px-1.5 text-[10px] font-bold">
                    {unreadCount}
                  </Badge>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('starred');
                  setPage(1);
                  setHighlightedIndex(-1);
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                  activeTab === 'starred'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Star className="h-3 w-3" />
                <span>Starred</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search emails... (press '/' to focus)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Search feedback */}
          {debouncedQuery && (
            <div className="text-xs text-muted-foreground">
              Showing results for <span className="font-semibold text-foreground">"{debouncedQuery}"</span>
            </div>
          )}

          {/* Email List Card */}
          <Card className="overflow-hidden border border-border shadow-xs">
            {loadingEmails ? (
              <div className="divide-y divide-border/60">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-4">
                    <SkeletonRow />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {debouncedQuery
                      ? 'No matching emails found'
                      : activeTab === 'unread'
                      ? 'No unread emails'
                      : activeTab === 'starred'
                      ? 'No starred emails'
                      : 'No emails synchronized yet'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {debouncedQuery
                      ? `No emails match the keyword "${debouncedQuery}". Try another search term.`
                      : activeTab !== 'all'
                      ? 'Emails matching this filter will show up here.'
                      : 'Go to Integrations and click "Sync Now" to synchronize your Gmail inbox.'}
                  </p>
                </div>
                {debouncedQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchInput('')}
                    className="text-xs"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {items.map((email, index) => {
                  const senderName =
                    email.sender?.split('<')[0]?.trim() ||
                    email.sender ||
                    'Unknown Sender';
                  const initials = (senderName || 'U').slice(0, 2).toUpperCase();
                  const isHighlighted = highlightedIndex === index;

                  return (
                    <div
                      key={email.id}
                      onClick={() => handleRowClick(email)}
                      className={cn(
                        'group flex items-center gap-3.5 px-4 py-3 sm:px-5 sm:py-3.5 cursor-pointer transition-colors duration-150',
                        isHighlighted && 'ring-2 ring-primary/40 bg-primary/5',
                        !email.is_read
                          ? 'bg-primary/[0.03] hover:bg-primary/[0.07]'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      {/* Star Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStarMutation.mutate({
                            id: email.id,
                            isStarred: email.is_starred,
                          });
                        }}
                        className={cn(
                          'shrink-0 p-1 rounded-md transition-colors',
                          email.is_starred
                            ? 'text-amber-400 hover:text-amber-500'
                            : 'text-muted-foreground/40 hover:text-muted-foreground group-hover:text-muted-foreground'
                        )}
                        title={email.is_starred ? 'Unstar' : 'Star'}
                      >
                        <Star
                          className={cn(
                            'h-4 w-4 transition-transform group-hover:scale-110',
                            email.is_starred && 'fill-current'
                          )}
                        />
                      </button>

                      {/* Read indicator dot */}
                      <div className="shrink-0 flex items-center justify-center w-2">
                        {!email.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>

                      {/* Sender Avatar */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-xs font-semibold text-primary">
                        {initials}
                      </div>

                      {/* Sender Name */}
                      <div className="w-36 sm:w-44 shrink-0 truncate">
                        <span
                          className={cn(
                            'text-xs truncate block',
                            !email.is_read
                              ? 'font-bold text-foreground'
                              : 'font-medium text-foreground/80'
                          )}
                        >
                          {senderName}
                        </span>
                      </div>

                      {/* Subject & Snippet */}
                      <div className="flex-1 min-w-0 flex items-baseline gap-2">
                        <span
                          className={cn(
                            'text-xs truncate shrink-0 max-w-sm',
                            !email.is_read
                              ? 'font-bold text-foreground'
                              : 'font-normal text-foreground/90'
                          )}
                        >
                          {email.subject || '(No Subject)'}
                        </span>
                        <span className="text-xs text-muted-foreground truncate hidden md:inline">
                          — {email.snippet || ''}
                        </span>
                      </div>

                      {/* Date */}
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {formatSmartTime(email.received_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination footer */}
            {items.length > 0 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/20 text-xs text-muted-foreground">
                <span>
                  Showing{' '}
                  <strong className="text-foreground font-semibold">
                    {(page - 1) * PAGE_SIZE + 1}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-foreground font-semibold">
                    {Math.min(page * PAGE_SIZE, total)}
                  </strong>{' '}
                  of <strong className="text-foreground font-semibold">{total}</strong> emails
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                      setHighlightedIndex(-1);
                    }}
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium text-foreground px-1">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages}
                    onClick={() => {
                      setPage((p) => Math.min(totalPages, p + 1));
                      setHighlightedIndex(-1);
                    }}
                    title="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Slide-over email reader drawer */}
      <EmailDetailDrawer
        emailId={selectedEmailId}
        onClose={() => setSelectedEmailId(null)}
      />

      {/* Keyboard Shortcuts Help Dialog */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs"
            onClick={() => setShowShortcutsModal(false)}
          />
          <div className="relative z-50 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Next email in list</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-[11px]">j</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Previous email in list</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-[11px]">k</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Open selected email</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-[11px]">Enter</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Focus search box</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-[11px]">/</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Close email / clear</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-[11px]">Esc</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Open shortcut help</span>
                <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-[11px]">?</kbd>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShortcutsModal(false)}
              className="w-full text-xs"
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
