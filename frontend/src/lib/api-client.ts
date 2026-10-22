import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { TokenResponse } from '@/types';

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:8000/api/v1';

export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem('access_token'),
  getRefreshToken: (): string | null => localStorage.getItem('refresh_token'),
  setTokens: (tokens: TokenResponse): void => {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
  },
  clearTokens: (): void => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Single in-flight refresh promise to prevent duplicate refresh calls
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await axios.post<TokenResponse>(
      `${API_BASE_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );
    tokenStorage.setTokens(response.data);
    const newToken = response.data.access_token;
    if (apiClient.defaults.headers.common) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    }
    return newToken;
  } catch {
    tokenStorage.clearTokens();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    return null;
  } finally {
    refreshPromise = null;
  }
}

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccessToken();
    if (token && config.headers) {
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

// Response Interceptor: ONE shared in-flight token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const is401 = error.response?.status === 401;
    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/verify-email');

    if (is401 && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken();
      }

      const newAccessToken = await refreshPromise;
      if (newAccessToken) {
        if (!originalRequest.headers) {
          originalRequest.headers = {} as any;
        }
        if (typeof (originalRequest.headers as any).set === 'function') {
          (originalRequest.headers as any).set('Authorization', `Bearer ${newAccessToken}`);
        } else {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Extract user-friendly, safe error message without leaking sensitive stack traces.
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object') {
      // 1. Structured { error: { code, message } }
      if ('error' in data && typeof data.error === 'object' && data.error !== null) {
        const customErr = data.error as { message?: string };
        if (customErr.message) return customErr.message;
      }
      // 2. FastAPI validation error: { detail: [{ msg: "..." }] } or { detail: "..." }
      if ('detail' in data) {
        const detail = (data as { detail: unknown }).detail;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail)) {
          return detail
            .map((item: { msg?: string; message?: string }) => item.msg || item.message || '')
            .filter(Boolean)
            .join(', ') || 'Validation error';
        }
      }
      // 3. Fallback message field: { message: "..." }
      if ('message' in data && typeof (data as { message: unknown }).message === 'string') {
        return (data as { message: string }).message;
      }
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return 'The server took too long to respond. Please try again.';
    }
    if (!error.response) {
      return 'Network connection lost. Please check your internet connection.';
    }
    if (error.response.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (error.response.status === 404) {
      return 'The requested resource was not found.';
    }
    if (error.response.status >= 500) {
      return 'An internal server error occurred. Please try again later.';
    }
    return error.message || 'An unexpected error occurred.';
  }

  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}
