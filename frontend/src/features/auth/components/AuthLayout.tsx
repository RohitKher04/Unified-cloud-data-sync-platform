import React from 'react';
import { cn } from '@/lib/utils';
import {
  Zap,
  Shield,
  RefreshCw,
  Mail,
  Database,
  Cloud,
  ArrowRight,
} from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const features = [
  { icon: <Mail className="h-4 w-4" />, label: 'Gmail Sync', desc: 'Real-time email synchronization' },
  { icon: <Shield className="h-4 w-4" />, label: 'Secure OAuth', desc: 'Zero-trust Google authorization' },
  { icon: <RefreshCw className="h-4 w-4" />, label: 'Auto Sync', desc: 'Background Celery workers' },
  { icon: <Database className="h-4 w-4" />, label: 'Smart Storage', desc: 'Unified PostgreSQL persistence' },
];

export function AuthLayout({ children }: AuthLayoutProps): React.JSX.Element {
  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left Brand Panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[56%] relative flex-col bg-zinc-950 overflow-hidden">
        {/* Ambient gradient orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/25 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 left-1/4 w-72 h-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(255 255 255 / 1) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">SyncPlatform</span>
          </div>

          {/* Hero text */}
          <div className="mt-auto mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 mb-6">
              <Cloud className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-xs font-medium text-indigo-300">Unified Cloud Data Sync</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
              Sync everything.
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Effortlessly.
              </span>
            </h1>

            <p className="mt-4 text-base text-zinc-400 leading-relaxed max-w-sm">
              Connect Gmail, Drive, and your entire Google Workspace to a unified data platform with enterprise-grade security.
            </p>

            {/* Feature cards */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              {features.map((f) => (
                <div
                  key={f.label}
                  className="group flex items-start gap-3 rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 hover:bg-white/[0.07] transition-colors duration-200"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25 transition-colors">
                    {f.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{f.label}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA arrow hint */}
            <div className="mt-8 flex items-center gap-2 text-xs text-zinc-500">
              <span>Get started in seconds</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-zinc-600">© {new Date().getFullYear()} SyncPlatform · All rights reserved</p>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10 bg-background">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2.5 mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">SyncPlatform</span>
        </div>

        <div className={cn('w-full max-w-md')}>{children}</div>
      </div>
    </div>
  );
}
