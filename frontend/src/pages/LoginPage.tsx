import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedEmail, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-split-wrapper">
      {/* Left Navy Branding Side */}
      <div className="auth-brand-side">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b528b, #60a5fa)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            fontWeight: 700
          }}>
            ⚡
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>DataSync</span>
        </div>

        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.25, marginBottom: '0.75rem' }}>
            Unified Cloud Data Sync
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.925rem', lineHeight: 1.5 }}>
            Securely access and manage your cloud data synchronization across external platforms.
          </p>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          © {new Date().getFullYear()} DataSync Platform
        </div>
      </div>

      {/* Right Form Side */}
      <div className="auth-form-side">
        <div className="auth-box">
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Sign In
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginTop: '0.35rem' }}>
              Enter your credentials to access your account.
            </p>
          </div>

          {error && (
            <div className="alert-error" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="form-input"
                style={error ? { borderColor: '#ef4444' } : {}}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                style={error ? { borderColor: '#ef4444' } : {}}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" />
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--navy-accent)', fontWeight: 600, textDecoration: 'none' }}>
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
