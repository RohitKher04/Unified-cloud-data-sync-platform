import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Mail,
  Plug,
  Activity,
  Settings,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

const NAV_ITEMS = [
  { to: '/dashboard', icon: <LayoutDashboard className="h-4.5 w-4.5" />, label: 'Overview' },
  { to: '/emails', icon: <Mail className="h-4.5 w-4.5" />, label: 'Emails' },
  { to: '/integrations', icon: <Plug className="h-4.5 w-4.5" />, label: 'Integrations' },
  { to: '/sync', icon: <Activity className="h-4.5 w-4.5" />, label: 'Sync Activity' },
  { to: '/settings', icon: <Settings className="h-4.5 w-4.5" />, label: 'Settings' },
];

function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme } = useTheme();
  const themes = [
    { value: 'light' as const, icon: <Sun className="h-3.5 w-3.5" /> },
    { value: 'dark' as const, icon: <Moon className="h-3.5 w-3.5" /> },
    { value: 'system' as const, icon: <Monitor className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
      {themes.map(({ value, icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={value.charAt(0).toUpperCase() + value.slice(1)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150',
            theme === value
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function UserAvatar({ name, email }: { name?: string | null; email?: string | null }): React.JSX.Element {
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim();
  const initials = cleanName
    ? cleanName.split(/\s+/).map((n) => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
    : cleanEmail.slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-sm">
      {initials}
    </div>
  );
}

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : (user?.email ?? '');

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('Logout failed. Please try again.');
    }
  };

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-border', collapsed && 'justify-center px-2')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-base tracking-tight text-foreground">SyncPlatform</span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                collapsed && 'justify-center px-2'
              )
            }
          >
            <span className="shrink-0">{icon}</span>
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom user section */}
      <div className={cn('border-t border-border px-3 py-4 space-y-3', collapsed && 'px-2')}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-1">
            <UserAvatar name={displayName} email={user?.email ?? ''} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          title="Sign out"
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  // Current page title from nav
  const currentPage = NAV_ITEMS.find((n) => location.pathname.startsWith(n.to))?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 ease-in-out shrink-0',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {SidebarContent}
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute left-0 hidden md:flex items-center justify-center h-6 w-6 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground shadow-xs transition-all duration-150 hover:shadow-sm"
          style={{ bottom: '5.5rem', left: collapsed ? '3rem' : '14rem' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* ── Mobile Drawer Overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border z-50 flex flex-col">
            <button
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-4 sm:px-6">
          {/* Mobile menu button */}
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Page title */}
          <h2 className="text-sm font-semibold text-foreground flex-1 truncate">{currentPage}</h2>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-2">
              <UserAvatar name={displayName} email={user?.email ?? ''} />
              <span className="text-xs font-medium text-foreground hidden lg:block truncate max-w-28">
                {displayName || user?.email}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
