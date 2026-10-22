import React from 'react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Mail, Activity } from 'lucide-react';

/**
 * @deprecated This file was the initial scaffold placeholder.
 * The real production pages are:
 * - src/pages/EmailsPage.tsx
 * - src/pages/SyncActivityPage.tsx
 */
export const EmailsPlaceholderPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Emails"
        description="Explore and search emails synchronized from your connected accounts."
      />
      <EmptyState
        icon={<Mail className="h-8 w-8" />}
        title="No emails synchronized yet"
        description="Connect your Google account in Integrations and run a sync to see your messages here."
      />
    </div>
  );
};

export const SyncActivityPlaceholderPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Sync Activity"
        description="Monitor background synchronization jobs, retries, and history."
      />
      <EmptyState
        icon={<Activity className="h-8 w-8" />}
        title="No sync jobs recorded"
        description="Trigger a sync from the Integrations page to see job history and status updates here."
      />
    </div>
  );
};
