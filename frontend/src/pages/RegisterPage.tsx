import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, UserPlus, ShieldCheck, RotateCcw } from 'lucide-react';

import {
  registerSchema,
  type RegisterFormData,
  verifyOtpSchema,
  type VerifyOtpFormData,
} from '@/features/auth/schemas';
import { authApi } from '@/features/auth/api';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/api-client';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { PasswordStrength } from '@/features/auth/components/PasswordStrength';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const RegisterPage: React.FC = () => {
  const [step, setStep] = useState<'register' | 'otp'>('register');
  const [pendingEmail, setPendingEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // ── Registration form
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  });

  const passwordValue = watch('password', '');

  const onRegister = async (data: RegisterFormData): Promise<void> => {
    setServerError(null);
    try {
      await authApi.register(data);
      setPendingEmail(data.email);
      setStep('otp');
      toast.success('Verification code sent to your email.');
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  // ── OTP form
  const {
    register: registerOtp,
    handleSubmit: handleOtpSubmit,
    formState: { errors: otpErrors, isSubmitting: isVerifying },
  } = useForm<VerifyOtpFormData>({
    resolver: zodResolver(verifyOtpSchema),
  });

  const onVerify = async (data: VerifyOtpFormData): Promise<void> => {
    setServerError(null);
    try {
      const tokens = await authApi.verifyEmail(pendingEmail, data.otp);
      await login(tokens);
      toast.success('Account created! Welcome to SyncPlatform 🎉');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  const handleResend = async (): Promise<void> => {
    setResending(true);
    setServerError(null);
    try {
      await authApi.resendEmailOtp(pendingEmail);
      toast.success('A new code was sent to your email.');
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  // ── OTP Step UI
  if (step === 'otp') {
    return (
      <AuthLayout>
        <div className="space-y-6">
          <div className="space-y-1.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to{' '}
              <span className="font-medium text-foreground">{pendingEmail}</span>. Enter it below to verify your account.
            </p>
          </div>

          {serverError && (
            <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              <span className="mt-0.5">⚠️</span>
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleOtpSubmit(onVerify)} className="space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="otp-code">Verification code</Label>
              <Input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                maxLength={6}
                className="text-lg tracking-[0.5em] text-center font-mono"
                aria-invalid={!!otpErrors.otp}
                {...registerOtp('otp')}
              />
              {otpErrors.otp && (
                <p className="text-xs text-destructive" role="alert">{otpErrors.otp.message}</p>
              )}
            </div>

            <Button id="otp-submit" type="submit" className="w-full h-10 font-semibold shadow-md shadow-primary/20" isLoading={isVerifying}>
              {!isVerifying && <ShieldCheck className="h-4 w-4" />}
              Verify account
            </Button>
          </form>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => { setStep('register'); setServerError(null); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Change email
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="flex items-center gap-1.5 font-medium text-primary hover:underline underline-offset-4 disabled:opacity-50 transition-colors"
            >
              {resending && <RotateCcw className="h-3.5 w-3.5 animate-spin" />}
              Resend code
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // ── Registration Step UI
  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Create account</h2>
          <p className="text-sm text-muted-foreground">
            Start syncing your cloud data in seconds.
          </p>
        </div>

        {serverError && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            <span className="mt-0.5">⚠️</span>
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onRegister)} className="space-y-4" noValidate>
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reg-first-name">First name</Label>
              <Input
                id="reg-first-name"
                type="text"
                autoComplete="given-name"
                autoFocus
                placeholder="First name"
                {...register('first_name')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-last-name">Last name</Label>
              <Input
                id="reg-last-name"
                type="text"
                autoComplete="family-name"
                placeholder="Last name"
                {...register('last_name')}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-email">Email address</Label>
            <Input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="user@email.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-password">Password</Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className="pr-11"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrength password={passwordValue} />
            {errors.password && (
              <p className="text-xs text-destructive" role="alert">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="reg-confirm-password">Confirm password</Label>
            <div className="relative">
              <Input
                id="reg-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat password"
                className="pr-11"
                aria-invalid={!!errors.confirmPassword}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive" role="alert">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            id="register-submit"
            type="submit"
            className="w-full h-10 text-sm font-semibold gap-2 shadow-md shadow-primary/20 mt-1"
            isLoading={isSubmitting}
          >
            {!isSubmitting && <UserPlus className="h-4 w-4" />}
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-primary hover:underline underline-offset-4 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
