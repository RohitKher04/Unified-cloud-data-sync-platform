import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
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
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // Clamp to max 4
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

export function PasswordStrength({ password }: PasswordStrengthProps): React.JSX.Element | null {
  const strength = useMemo(() => calculateStrength(password), [password]);

  if (!password) return null;

  return (
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
        <p className={cn(
          'text-xs font-medium',
          strength.score <= 1 && 'text-red-500',
          strength.score === 2 && 'text-amber-500',
          strength.score === 3 && 'text-indigo-400',
          strength.score === 4 && 'text-emerald-500',
        )}>
          {strength.label} password
        </p>
      )}
    </div>
  );
}
