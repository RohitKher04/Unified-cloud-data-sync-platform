import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

function FullPageSpinner(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading SyncPlatform…</p>
      </div>
    </div>
  );
}

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export const PublicOnlyRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;

  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
};
