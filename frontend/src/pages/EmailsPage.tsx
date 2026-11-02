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
  ChevronDown,
  Check,
  Layers,
  Plug,
  X,
  Keyboard,
  StopCircle,
} from 'lucide-react';

import { emailApi, integrationApi, syncApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/api-client';
import { formatSmartTime } from '@/lib/formatters';
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
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'starred'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  // References to email rows for keyboard auto-scroll
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Close account dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const connectedIntegrations = integrations?.filter((i) => i.status === 'connected') || [];
  const primaryIntegration =
    integrations?.find((i) => i.status === 'connected') || integrations?.[0];
  const hasIntegrations = (integrations?.length ?? 0) > 0;

  const currentAccount = selectedIntegrationId
    ? integrations?.find((i) => i.id === selectedIntegrationId)
    : primaryIntegration;

  // Query sync jobs (isolated key so it doesn't conflict with other pages)
  const { data: syncJobs } = useQuery({
    queryKey: ['sync-jobs', 'emails'],
    queryFn: () => syncApi.listJobs(10),
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(
        (j) => j.status === 'queued' || j.status === 'running'
      );
      return hasActive ? 2500 : 8000;
    },
  });

  // Active running job for current account or any account
  const activeJobForCurrent = syncJobs?.find(
    (j) =>
      (selectedIntegrationId ? j.integration_id === selectedIntegrationId : true) &&
      (j.status === 'queued' || j.status === 'running')
  );

  const isSyncRunning = Boolean(activeJobForCurrent);

  // Live account counts for the dropdown
  const { data: accountCounts } = useQuery({
    queryKey: ['email-counts-per-integration', integrations?.map((i) => i.id)],
    queryFn: async () => {
      if (!integrations || integrations.length === 0) return {};
      const counts: Record<string, number> = {};

      const allRes = await emailApi.list({ limit: 1 });
      counts.all = allRes.total;

      await Promise.all(
        integrations.map(async (i) => {
          const res = await emailApi.list({ integration_id: i.id, limit: 1 });
          counts[String(i.id)] = res.total;
        })
      );

      return counts;
    },
    enabled: Boolean(integrations && integrations.length > 0),
    refetchInterval: isSyncRunning ? 2500 : false,
  });

  // Automatically refresh email counts when sync finishes
  const prevSyncStatus = useRef(activeJobForCurrent?.status);
  useEffect(() => {
    if (
      prevSyncStatus.current &&
      (prevSyncStatus.current === 'queued' || prevSyncStatus.current === 'running')
    ) {
      if (activeJobForCurrent?.status === 'completed') {
        toast.success(`Sync completed — ${activeJobForCurrent.records_processed} records processed.`);
        void qc.invalidateQueries({ queryKey: ['emails'] });
        void qc.invalidateQueries({ queryKey: ['emails-unread-count'] });
        void qc.invalidateQueries({ queryKey: ['email-counts-per-integration'] });
        void qc.invalidateQueries({ queryKey: ['integrations'] });
      } else if (activeJobForCurrent?.status === 'failed') {
        toast.error(activeJobForCurrent.error_message || 'Sync failed.');
      } else if (activeJobForCurrent?.status === 'cancelled') {
        toast.info('Sync cancelled.');
      }
    }
    prevSyncStatus.current = activeJobForCurrent?.status;
  }, [activeJobForCurrent?.status, activeJobForCurrent?.records_processed, activeJobForCurrent?.error_message, qc]);

  // Trigger sync mutation
  const syncMutation = useMutation({
    mutationFn: () => {
      const target = currentAccount || primaryIntegration;
      if (!target) throw new Error('No connected integration available.');
      return syncApi.trigger(target.id);
    },
    onSuccess: () => {
      toast.success('Sync job queued!');
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
      void qc.invalidateQueries({ queryKey: ['emails'] });
      void qc.invalidateQueries({ queryKey: ['email-counts-per-integration'] });
    },
    onError: (err) => toast.error(getErrorMessage(err) || 'Could not queue sync job.'),
  });

  // Cancel active sync mutation
  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!activeJobForCurrent) throw new Error('No active sync job to cancel.');
      return syncApi.cancelJob(activeJobForCurrent.id);
    },
    onSuccess: () => {
      toast.info('Sync cancelled.');
      void qc.invalidateQueries({ queryKey: ['sync-jobs'] });
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
    onError: (err) => toast.error(getErrorMessage(err) || 'Could not cancel sync.'),
  });

  // Query emails with filters, search, and pagination (Live polls every 2.5s during sync)
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
        integrationId: selectedIntegrationId,
      },
    ],
    queryFn: () =>
      emailApi.list({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        integration_id: selectedIntegrationId ?? undefined,
        q: debouncedQuery || undefined,
        is_read: activeTab === 'unread' ? false : undefined,
        is_starred: activeTab === 'starred' ? true : undefined,
      }),
    enabled: hasIntegrations,
    refetchInterval: isSyncRunning ? 2500 : false,
  });

  // Query unread count for the tab badge (Live polls during sync)
  const { data: unreadData } = useQuery({
    queryKey: ['emails-unread-count', selectedIntegrationId],
    queryFn: () =>
      emailApi.list({
        is_read: false,
        limit: 1,
        integration_id: selectedIntegrationId ?? undefined,
      }),
    enabled: hasIntegrations,
    refetchInterval: isSyncRunning ? 2500 : false,
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

  const handleRowClick = (email: EmailListItem): void => {
    setSelectedEmailId(email.id);
    if (!email.is_read) {
      toggleReadMutation.mutate({ id: email.id, isRead: false });
    }
  };

  // Keyboard navigation shortcuts: j, k, Enter, /, ?
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea';

      if (isInput) {
        if (e.key === 'Escape') {
          searchInputRef.current?.blur();
        }
        return;
      }

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
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          return next;
        });
      } else if (e.key === 'k') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

  const selectedIntegration = connectedIntegrations.find((i) => i.id === selectedIntegrationId);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Emails"
        description="Search, view, and organize messages synchronized from your connected accounts."
        actions={
          <div className="flex items-center gap-2">
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
          {/* Controls bar: Account Dropdown + Filter Tabs + Sync & Cancel (when account is selected) + Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Left side actions */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Custom Dark-Mode-Safe Account Dropdown */}
              {connectedIntegrations.length > 0 && (
                <div className="relative" ref={accountMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-accent/60 transition-colors shadow-xs"
                    title="Filter by account"
                  >
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-35 sm:max-w-45">
                      {selectedIntegration
                        ? selectedIntegration.external_email
                        : `All Accounts (${accountCounts?.all !== undefined ? accountCounts.all.toLocaleString() : total})`}
                    </span>
                    <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-150', isAccountMenuOpen && 'rotate-180')} />
                  </button>

                  {/* Dropdown Menu */}
                  {isAccountMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 w-72 rounded-xl border border-border bg-popover p-1.5 shadow-xl z-50 text-xs">
                      {/* All Accounts Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIntegrationId(null);
                          setIsAccountMenuOpen(false);
                          setPage(1);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors',
                          selectedIntegrationId === null
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-foreground hover:bg-muted'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">All Accounts</span>
                          {selectedIntegrationId === null && <Check className="h-3.5 w-3.5 text-primary ml-1" />}
                        </div>
                        {accountCounts?.all !== undefined && (
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {accountCounts.all.toLocaleString()}
                          </Badge>
                        )}
                      </button>

                      <div className="my-1 border-t border-border" />

                      {/* Individual Accounts */}
                      {connectedIntegrations.map((account) => {
                        const isSelected = selectedIntegrationId === account.id;
                        const count = accountCounts?.[String(account.id)];

                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => {
                              setSelectedIntegrationId(account.id);
                              setIsAccountMenuOpen(false);
                              setPage(1);
                            }}
                            className={cn(
                              'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-foreground hover:bg-muted'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                              <span className="truncate">{account.external_email}</span>
                              {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-1" />}
                            </div>
                            {count !== undefined && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {count.toLocaleString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Filter Tabs Container */}
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1">
                {/* All Tab */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('all');
                    setPage(1);
                    setHighlightedIndex(-1);
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                    activeTab === 'all'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>All</span>
                </button>

                {/* Unread tab */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('unread');
                    setPage(1);
                    setHighlightedIndex(-1);
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                    activeTab === 'unread'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
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

                {/* Starred tab */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('starred');
                    setPage(1);
                    setHighlightedIndex(-1);
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150',
                    activeTab === 'starred'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Star className="h-3 w-3" />
                  <span>Starred</span>
                </button>
              </div>

              {/* Sync Arrow Button (Only shown when an individual account is selected) */}
              {selectedIntegrationId !== null && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || isSyncRunning}
                  className={cn(
                    'h-9 px-2.5 text-xs gap-1.5 transition-colors',
                    isSyncRunning && 'border-primary/40 bg-primary/5 text-primary'
                  )}
                  title="Sync now"
                >
                  <RefreshCw
                    className={cn(
                      'h-3.5 w-3.5',
                      (syncMutation.isPending || isSyncRunning) && 'animate-spin'
                    )}
                  />
                  <span>{isSyncRunning ? 'Syncing…' : 'Sync'}</span>
                </Button>
              )}

              {/* Cancel Button if need to cancel (Only shown when an account is selected and job is running) */}
              {selectedIntegrationId !== null && isSyncRunning && activeJobForCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="h-9 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30 shrink-0 gap-1"
                  title="Cancel active sync job"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </Button>
              )}
            </div>

            {/* Right: Search Input */}
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
                  type="button"
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
                  <h3 className="text-sm font-semibold text-foreground">No emails found</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {debouncedQuery
                      ? 'No messages matched your search query. Try different keywords.'
                      : activeTab === 'unread'
                      ? 'You have caught up with all your unread messages.'
                      : activeTab === 'starred'
                      ? 'No starred messages yet. Star important emails to find them here.'
                      : 'Your inbox is empty. Select an account above to sync emails.'}
                  </p>
                </div>
                {debouncedQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchInput('')}
                    className="text-xs"
                  >
                    Clear Search
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
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      onClick={() => handleRowClick(email)}
                      className={cn(
                        'group flex items-center gap-3.5 px-4 py-3 sm:px-5 sm:py-3.5 cursor-pointer transition-colors duration-150',
                        isHighlighted && 'ring-2 ring-primary/40 bg-primary/5',
                        !email.is_read
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      {/* Unread dot */}
                      <div className="flex w-2 justify-center shrink-0">
                        {!email.is_read ? (
                          <div
                            className="h-2 w-2 rounded-full bg-primary"
                            title="Unread"
                          />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-transparent" />
                        )}
                      </div>

                      {/* Star Button */}
                      <button
                        type="button"
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
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-muted-foreground/40 hover:text-muted-foreground'
                        )}
                        title={email.is_starred ? 'Unstar email' : 'Star email'}
                      >
                        <Star
                          className={cn(
                            'h-4 w-4',
                            email.is_starred && 'fill-amber-500'
                          )}
                        />
                      </button>

                      {/* Sender Avatar */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials}
                      </div>

                      {/* Sender & Subject + Snippet */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-xs truncate max-w-45 sm:max-w-55',
                              !email.is_read
                                ? 'font-semibold text-foreground'
                                : 'font-normal text-muted-foreground'
                            )}
                          >
                            {senderName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              'truncate',
                              !email.is_read
                                ? 'font-medium text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {email.subject || '(No Subject)'}
                          </span>
                          {email.snippet && (
                            <>
                              <span className="text-muted-foreground/50 shrink-0">
                                —
                              </span>
                              <span className="text-muted-foreground truncate hidden md:inline">
                                {email.snippet}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div className="shrink-0 text-right">
                        <span
                          className={cn(
                            'text-xs whitespace-nowrap',
                            !email.is_read
                              ? 'font-medium text-primary'
                              : 'text-muted-foreground'
                          )}
                        >
                          {email.received_at ? formatSmartTime(email.received_at) : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination footer */}
            {!loadingEmails && total > 0 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6 text-xs text-muted-foreground">
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
                type="button"
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