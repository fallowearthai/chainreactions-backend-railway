// Common TypeScript types shared across all services

export interface APIResponse<T = any> {
  success: true;
  data: T;
  message: string;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
  timestamp: string;
  path?: string;
  code?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: PaginationInfo;
}

export interface HealthCheckResponse extends APIResponse {
  data: {
    service: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    version?: string;
    uptime?: number;
    timestamp: string;
    dependencies?: {
      name: string;
      status: 'connected' | 'disconnected' | 'degraded';
      responseTime?: number;
    }[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}