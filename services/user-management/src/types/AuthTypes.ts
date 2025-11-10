import { User, Session } from '@supabase/supabase-js';
import { UserProfile } from './UserTypes';

// Auth request/response types
export interface SignUpRequest {
  email: string;
  password: string;
  displayName?: string;
  company?: string;
  department?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthResponse {
  user?: User;
  session?: Session;
  error?: string;
  message?: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
  validationErrors?: any[];
  timestamp: string;
  path: string;
}

export interface TokenValidation {
  valid: boolean;
  user?: User;
  error?: string;
}

// User metadata types
export interface UserMetadata {
  displayName?: string;
  company?: string;
  department?: string;
  title?: string;
  phone?: string;
}


// JWT types (for service-to-service authentication)
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  companyId?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Security types
export interface SecurityContext {
  user: User;
  profile: UserProfile;
  permissions: string[];
  sessionId: string;
  ipAddress: string;
  userAgent: string;
}

export interface AuditEvent {
  action: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// Email verification types
export interface EmailVerificationRequest {
  email: string;
  token: string;
  type: 'signup' | 'change' | 'invite';
}

// Session management types
export interface SessionInfo {
  id: string;
  userId: string;
  createdAt: string;
  lastAccessedAt: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}