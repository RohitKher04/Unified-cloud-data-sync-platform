import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Sun,
  Moon,
  Monitor,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/lib/theme';
import { integrationApi } from '@/lib/api';
import { formatFullDateTime } from '@/lib/formatters';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [disconnectId, setDisconnectId] = useState<number | null>(null);

  // Query connected integrations for the Danger zone
  const { data: integrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationApi.list,
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: number) => integrationApi.disconnect(id),
    onSuccess: () => {
      toast.success('Integration disconnected.');
      void qc.invalidateQueries({ queryKey: ['integrations'] });
      void qc.invalidateQueries({ queryKey: ['emails'] });
      setDisconnectId(null);
    },
    onError: () => toast.error('Failed to disconnect integration.'),
  });

  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`.trim()
    : user?.email ?? '';

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('Logout failed. Please try again.');
    }
  };

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark' as const, label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system' as const, label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Settings"
        description="Manage your account profile, appearance, and integration security."
      />

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-primary" />
            Profile Details
          </CardTitle>
          <CardDescription className="text-xs">
            Your personal information loaded securely from your authenticated session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Full Name
              </p>
              <p className="text-sm font-medium text-foreground">{displayName || '—'}</p>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Email Address
              </p>
              <p className="text-sm font-medium text-foreground truncate">{user?.email ?? '—'}</p>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Account Created
              </p>
              <p className="text-sm font-medium text-foreground">
                {user?.created_at ? formatFullDateTime(user.created_at) : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security & Credentials Policy */}
      <Card className="border-indigo-500/20 bg-indigo-500/[0.02]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Security & Credential Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            Google OAuth access tokens and refresh tokens are stored <strong className="text-foreground">AES-256 encrypted</strong> on the server.
          </p>
          <p>
            The frontend application never sees, receives, or persists Google credentials. You can revoke access at any time by disconnecting below.
          </p>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Appearance</CardTitle>
          <CardDescription className="text-xs">
            Select how SyncHub appears on your system.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-3">
            {themeOptions.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all duration-150',
                  theme === value
                    ? 'border-primary bg-primary/5 text-primary shadow-xs'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {icon}
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone: Connected Integrations & Sign Out */}
      <Card className="border-destructive/30">
        <CardHeader className="border-b border-destructive/10 pb-4">
          <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-xs">
            Manage connected integration access or terminate your current session.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4 divide-y divide-border/60">
          {/* Connected Integrations list */}
          <div className="pb-4 space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Connected Cloud Accounts
            </h4>

            {loadingIntegrations ? (
              <p className="text-xs text-muted-foreground">Loading accounts…</p>
            ) : (integrations?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">No accounts currently connected.</p>
            ) : (
              <div className="space-y-2">
                {integrations?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500 font-bold text-xs">
                        G
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {item.external_email}
                        </p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {item.provider} · {item.integration_type}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisconnectId(item.id)}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/60 text-xs h-8 gap-1.5 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sign Out */}
          <div className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">Sign out of SyncHub</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Revokes your current session tokens on this browser.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 gap-2 text-xs h-8"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        isOpen={disconnectId !== null}
        onClose={() => setDisconnectId(null)}
        title="Disconnect Google Account?"
        description="Disconnecting will remove your stored OAuth credentials. Synced emails may be removed from your local database."
        confirmLabel="Yes, Disconnect"
        variant="destructive"
        isLoading={disconnectMutation.isPending}
        onConfirm={() => {
          if (disconnectId) {
            disconnectMutation.mutate(disconnectId);
          }
        }}
      />
    </div>
  );
};
