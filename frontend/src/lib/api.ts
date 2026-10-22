import { apiClient } from '@/lib/api-client';
import type {
  GoogleConnectResponse,
  Integration,
  SyncJob,
  SyncJobQueued,
  EmailListResponse,
  EmailDetail,
  EmailUpdate,
} from '@/types';

export const integrationApi = {
  list: async (): Promise<Integration[]> => {
    const res = await apiClient.get<Integration[]>('/integrations');
    return res.data;
  },

  getConnectUrl: async (): Promise<string> => {
    const res = await apiClient.get<GoogleConnectResponse>('/integrations/google/connect');
    return res.data.authorization_url;
  },

  disconnect: async (integrationId: number): Promise<void> => {
    await apiClient.delete(`/integrations/${integrationId}`);
  },
};

export const syncApi = {
  trigger: async (integrationId: number): Promise<SyncJobQueued> => {
    const res = await apiClient.post<SyncJobQueued>(`/integrations/${integrationId}/sync`);
    return res.data;
  },

  listJobs: async (limit = 50): Promise<SyncJob[]> => {
    const res = await apiClient.get<SyncJob[]>(`/sync/jobs?limit=${limit}`);
    return res.data;
  },

  getJob: async (jobId: number): Promise<SyncJob> => {
    const res = await apiClient.get<SyncJob>(`/sync/jobs/${jobId}`);
    return res.data;
  },
};

export const emailApi = {
  list: async (params?: {
    limit?: number;
    offset?: number;
    q?: string;
    is_read?: boolean;
    is_starred?: boolean;
  }): Promise<EmailListResponse> => {
    const res = await apiClient.get<EmailListResponse>('/emails', { params });
    return res.data;
  },

  getDetail: async (emailId: number): Promise<EmailDetail> => {
    const res = await apiClient.get<EmailDetail>(`/emails/${emailId}`);
    return res.data;
  },

  update: async (emailId: number, data: EmailUpdate): Promise<EmailDetail> => {
    const res = await apiClient.patch<EmailDetail>(`/emails/${emailId}`, data);
    return res.data;
  },
};
