import React from 'react';

export const EmailsPage: React.FC = () => {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>Synchronized Emails</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Explore and search emails synchronized from your connected accounts.
        </p>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📬</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>No emails synchronized yet</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '450px', margin: '0.5rem auto 1.5rem' }}>
          Once Google OAuth is connected in Milestone 3 and the Gmail sync worker runs in Milestone 4, your messages will appear here with full pagination, search, and details.
        </p>
        <span className="badge badge-warning">Milestone 4 & 5 Scope</span>
      </div>
    </div>
  );
};

export const SyncActivityPage: React.FC = () => {
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>Sync Activity & Jobs</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Monitor background synchronization job states, checkpoints, and retries.
        </p>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔄</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>No sync jobs recorded</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '450px', margin: '0.5rem auto 1.5rem' }}>
          The sync state machine (Queued → Running → Completed / Failed) and history cursor tracking will be activated with Celery workers in Milestone 4 & 6.
        </p>
        <span className="badge badge-warning">Milestone 4 Scope</span>
      </div>
    </div>
  );
};
