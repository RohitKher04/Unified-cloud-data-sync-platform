import type { TokenResponse, User } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000/api/v1';

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

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = tokenStorage.getAccessToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Only refresh token on 401 for protected endpoints (NOT for login/register)
  const isAuthEndpoint = endpoint.startsWith('/auth/');
  if (response.status === 401 && !isAuthEndpoint && tokenStorage.getRefreshToken()) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${tokenStorage.getAccessToken()}`);
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      tokenStorage.clearTokens();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
  }

  if (!response.ok) {
    let errorDetail = 'Request failed';
    try {
      const errorJson = await response.json();
      const rawDetail = errorJson.detail !== undefined ? errorJson.detail : errorJson.message;
      if (Array.isArray(rawDetail)) {
        // FastAPI Pydantic validation error format
        errorDetail = rawDetail.map((item: any) => item.msg || item.message || JSON.stringify(item)).join('; ');
      } else if (typeof rawDetail === 'string') {
        errorDetail = rawDetail;
      } else if (typeof rawDetail === 'object' && rawDetail !== null) {
        errorDetail = (rawDetail as any).message || (rawDetail as any).detail || JSON.stringify(rawDetail);
      } else if (rawDetail) {
        errorDetail = String(rawDetail);
      } else {
        errorDetail = response.statusText || 'Request failed';
      }
    } catch {
      errorDetail = response.statusText || 'Network request failed';
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const data: TokenResponse = await response.json();
      tokenStorage.setTokens(data);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const authApi = {
  login: (email: string, password: string): Promise<TokenResponse> =>
    apiFetch<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }): Promise<TokenResponse> =>
    apiFetch<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: async (refreshToken: string): Promise<void> => {
    try {
      await apiFetch<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } finally {
      tokenStorage.clearTokens();
    }
  },

  getCurrentUser: (): Promise<User> => apiFetch<User>('/users/me'),
};
