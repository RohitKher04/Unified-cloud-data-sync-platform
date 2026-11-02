import React, { useMemo } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
}

interface Requirement {
  label: string;
  met: boolean;
}

interface StrengthResult {
  score: number; // 0-4
  label: string;
  color: string;
  width: string;
}

function calculateStrength(password: string): StrengthResult {
  if (!password) return { score: 0, label: '', color: '', width: 'w-0' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const clamped = Math.min(score, 4);

  const map: Record<number, Omit<StrengthResult, 'score'>> = {
    0: { label: '', color: '', width: 'w-0' },
    1: { label: 'Weak', color: 'bg-red-500', width: 'w-1/4' },
    2: { label: 'Fair', color: 'bg-amber-500', width: 'w-2/4' },
    3: { label: 'Good', color: 'bg-indigo-500', width: 'w-3/4' },
    4: { label: 'Strong', color: 'bg-emerald-500', width: 'w-full' },
  };

  return { score: clamped, ...map[clamped] };
}

export function PasswordStrength({ password }: PasswordStrengthProps): React.JSX.Element {
  const strength = useMemo(() => calculateStrength(password), [password]);

  const requirements: Requirement[] = useMemo(
    () => [
      {
        label: 'At least 8 characters',
        met: password.length >= 8,
      },
      {
        label: 'One uppercase letter (A-Z)',
        met: /[A-Z]/.test(password),
      },
      {
        label: 'One lowercase letter (a-z)',
        met: /[a-z]/.test(password),
      },
      {
        label: 'One number (0-9)',
        met: /[0-9]/.test(password),
      },
    ],
    [password]
  );

  return (
    <div className="space-y-2 pt-1">
      {/* Strength progress bar (shows once user starts typing) */}
      {password && (
        <div className="space-y-1.5">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                strength.color,
                strength.width
              )}
            />
          </div>
          {strength.label && (
            <p
              className={cn(
                'text-xs font-medium',
                strength.score <= 1 && 'text-red-500',
                strength.score === 2 && 'text-amber-500',
                strength.score === 3 && 'text-indigo-400',
                strength.score === 4 && 'text-emerald-500'
              )}
            >
              {strength.label} password
            </p>
          )}
        </div>
      )}

      {/* Live Requirements Checklist - All instructions shown at once */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-2.5 space-y-1.5 text-xs">
        <p className="font-medium text-muted-foreground text-[11px] uppercase tracking-wider">
          Password must contain:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {requirements.map((req) => (
            <div
              key={req.label}
              className={cn(
                'flex items-center gap-1.5 transition-colors duration-200',
                req.met
                  ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-muted-foreground'
              )}
            >
              {req.met ? (
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 stroke-[2.5]" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0 ml-1 mr-1" />
              )}
              <span className="truncate">{req.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}