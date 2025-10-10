export interface DemoRequestData {
  firstName: string;
  lastName: string;
  email: string;
  institution?: string;
  jobTitle?: string;
  timestamp: string;
  source: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  response?: string;
  error?: string;
  labelIds: string[]; // For compatibility with N8N response format
}

export interface DemoRequestRequest {
  body: DemoRequestData;
}

export interface DemoRequestResponse {
  success?: boolean;
  messageId?: string;
  response?: string;
  error?: string;
  labelIds?: string[];
}