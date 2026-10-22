export interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegistrationPendingResponse {
  message: string;
}

export interface GoogleConnectResponse {
  authorization_url: string;
}

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface Integration {
  id: number;
  provider: string;
  integration_type: string;
  external_email: string;
  status: IntegrationStatus | string;
  last_synced_at?: string | null;
  created_at?: string | null;
}

export type SyncJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SyncJob {
  id: number;
  integration_id: number;
  job_type: string;
  status: SyncJobStatus | string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SyncJobQueued {
  job_id: number;
  status: string;
}

export interface EmailListItem {
  id: number;
  integration_id: number;
  external_id: string;
  thread_id: string | null;
  subject: string | null;
  sender: string | null;
  recipients: string[];
  snippet: string | null;
  received_at: string | null;
  is_read: boolean;
  is_starred: boolean;
  labels: string[];
}

export interface EmailAttachment {
  filename: string;
  mime_type: string;
  size: number;
}

export interface EmailDetail extends EmailListItem {
  cc: string[];
  bcc: string[];
  body_text: string | null;
  body_html: string | null;
  attachments?: EmailAttachment[];
  created_at: string;
  updated_at: string;
}

export interface EmailListResponse {
  items: EmailListItem[];
  total: number;
  next_cursor: string | null;
}

export interface EmailUpdate {
  is_read?: boolean;
  is_starred?: boolean;
}

export interface ApiErrorResponse {
  error?: {
    code: string;
    message: string;
  };
  detail?: string | Array<{ msg?: string; message?: string }>;
  message?: string;
}
