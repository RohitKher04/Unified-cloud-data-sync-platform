import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/RouteGuards';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { EmailsPage } from '@/pages/EmailsPage';
import { SyncActivityPage } from '@/pages/SyncActivityPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function AppRouter(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public-only routes (login, register) */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* OAuth callback — public, no layout */}
        <Route path="/integrations/callback" element={<OAuthCallbackPage />} />

        {/* Protected routes wrapped in Dashboard Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/emails" element={<EmailsPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/sync" element={<SyncActivityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Default redirect for root */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 404 Not Found Page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
