import React from 'react';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>Account Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Manage your account profile and authentication details.
        </p>
      </div>

      <div className="card" style={{ maxWidth: '680px', marginBottom: '1.5rem' }}>
        <h2 className="card-title">User Profile</h2>
        <p className="card-subtitle">Verified platform user identity</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Email Address
            </span>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {user?.email}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                First Name
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {user?.first_name || '—'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Last Name
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-main)', marginTop: '0.2rem' }}>
                {user?.last_name || '—'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Account Created
              </span>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {user?.created_at ? new Date(user.created_at).toLocaleString() : '—'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Status
              </span>
              <div style={{ marginTop: '0.2rem' }}>
                <span className="badge badge-success">● Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '680px' }}>
        <h2 className="card-title">Security & Session</h2>
        <p className="card-subtitle">Tokens and cryptographic protection details</p>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
          <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Password Hashing</span>
            <span style={{ fontWeight: 600 }}>Argon2id (phpass memory-hard)</span>
          </li>
          <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Access Token Expiry</span>
            <span style={{ fontWeight: 600 }}>15 minutes (short-lived JWT)</span>
          </li>
          <li style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
            <span style={{ color: 'var(--text-muted)' }}>Refresh Token Rotation</span>
            <span style={{ fontWeight: 600 }}>Active (Tracked in user_sessions)</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
