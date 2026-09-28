import React from 'react';
import { useAuth } from '../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Welcome, {user?.first_name || 'User'}!
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.35rem' }}>
          Your account is active and verified.
        </p>
      </div>

      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1.5px solid #eef2f6',
        padding: '2rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Account Profile
          </h2>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '0.3rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0'
          }}>
            ● Active
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ padding: '1rem', background: 'var(--input-bg)', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email Address
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              {user?.email}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--input-bg)', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                First Name
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {user?.first_name || '—'}
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'var(--input-bg)', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Last Name
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {user?.last_name || '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--input-bg)', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                User ID
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                #{user?.id}
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'var(--input-bg)', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Member Since
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
