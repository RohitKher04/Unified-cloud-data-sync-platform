import { apiClient, tokenStorage } from '@/lib/api-client';
import type {
  LoginFormData,
  RegisterFormData,
} from './schemas';
import type {
  TokenResponse,
  User,
  RegistrationPendingResponse,
} from '@/types';

export const authApi = {
  login: async (credentials: LoginFormData): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/login', credentials);
    tokenStorage.setTokens(response.data);
    return response.data;
  },

  register: async (formData: RegisterFormData): Promise<RegistrationPendingResponse> => {
    const payload = {
      email: formData.email,
      password: formData.password,
      first_name: formData.first_name || null,
      last_name: formData.last_name || null,
    };
    const response = await apiClient.post<RegistrationPendingResponse>('/auth/register', payload);
    return response.data;
  },

  verifyEmail: async (email: string, otp: string): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/verify-email', {
      email,
      otp,
    });
    tokenStorage.setTokens(response.data);
    return response.data;
  },

  resendEmailOtp: async (email: string): Promise<RegistrationPendingResponse> => {
    const response = await apiClient.post<RegistrationPendingResponse>('/auth/resend-email-otp', {
      email,
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/users/me');
    return response.data;
  },

  logout: async (): Promise<void> => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refresh_token: refreshToken });
      }
    } finally {
      tokenStorage.clearTokens();
    }
  },
};
