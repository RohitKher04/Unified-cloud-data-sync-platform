import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, TokenResponse } from '@/types';
import { authApi } from '@/features/auth/api';
import { tokenStorage, refreshAccessToken } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tokens: TokenResponse) => Promise<User>;
  logout: () => Promise<void>;
  setUserFromResponse: (user: User) => void;
  bootstrapSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const bootstrapSession = useCallback(async () => {
    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch {
      tokenStorage.clearTokens();
      queryClient.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrapSession();

    // Listen for global 401 unrecoverable failures
    const handleUnauthorized = (): void => {
      queryClient.clear();
      setUser(null);
      tokenStorage.clearTokens();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);

    // Proactively refresh access token every 15 minutes to prevent session expiration during active use
    const refreshInterval = setInterval(() => {
      if (tokenStorage.getRefreshToken()) {
        void refreshAccessToken();
      }
    }, 15 * 60 * 1000);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      clearInterval(refreshInterval);
    };
  }, [bootstrapSession]);

  const login = async (tokens: TokenResponse): Promise<User> => {
    queryClient.clear();
    tokenStorage.setTokens(tokens);
    const userData = await authApi.getCurrentUser();
    setUser(userData);
    return userData;
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Ignored - token cleared in finally
    } finally {
      queryClient.clear();
      tokenStorage.clearTokens();
      setUser(null);
    }
  };

  const setUserFromResponse = (newUser: User): void => {
    setUser(newUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        setUserFromResponse,
        bootstrapSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};