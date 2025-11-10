// Profile types based on existing database structure
export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  email: string;
  displayName?: string;
  companyId?: string;
  department?: string;
  title?: string;
  phone?: string;
  timezone?: string;
  language?: string;
}

export interface UpdateUserRequest {
  displayName?: string;
  department?: string;
  title?: string;
  phone?: string;
  timezone?: string;
  language?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  emailNotifications?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  timezone?: string;
}

// Role management types
export interface UserRole {
  id: string;
  userId: string;
  role: 'admin' | 'user' | 'manager';
  assignedBy: string;
  assignedAt: string;
  expiresAt?: string;
}

export interface AssignRoleRequest {
  userId: string;
  role: 'admin' | 'user' | 'manager';
  expiresAt?: string;
}

// Usage and credits types
export interface UserUsageCredits {
  id: string;
  userId: string;
  ordinarySearchCredits: number;
  longSearchCredits: number;
  accountType: 'admin' | 'premium' | 'free_trial';
  creditsResetDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  transactionType: 'ordinary_search' | 'long_search';
  creditsUsed: number;
  remainingCredits?: number;
  searchDetails?: Record<string, any>;
  createdAt: string;
}

export interface AddCreditsRequest {
  userId: string;
  amount: number;
  reason: string;
  transactionType: 'bonus' | 'refund' | 'purchase';
}

export interface UsageStats {
  userId: string;
  period: TimePeriod;
  totalSearches: number;
  ordinarySearches: number;
  longSearches: number;
  creditsUsed: number;
  averageExecutionTime: number;
  topSearchTypes: string[];
}

export interface TimePeriod {
  start: string;
  end: string;
}

// Search history types
export interface SearchHistoryEntry {
  id: string;
  userId: string;
  searchType: 'entity_search' | 'entity_relations' | 'entity_relations_standard' | 'entity_relations_deepthinking' | 'company-search' | 'company-relations';
  targetInstitution: string;
  riskEntity?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  searchParameters?: Record<string, any>;
  searchResults?: Record<string, any>;
  chainReactionResults?: Record<string, any>;
  datasetMatches?: Record<string, any>;
  executionTime?: number;
  createdAt: string;
  updatedAt: string;
}

// Admin and management types
export interface UserManagementFilters {
  status?: 'active' | 'inactive';
  role?: 'admin' | 'user' | 'manager';
  accountType?: 'admin' | 'premium' | 'free_trial';
  company?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  lastActiveAfter?: string;
  lastActiveBefore?: string;
}

export interface PaginatedUsers {
  users: (UserProfile & { credits: UserUsageCredits; role: UserRole })[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface BulkUserOperation {
  action: 'deactivate' | 'delete' | 'addCredits' | 'assignRole';
  userIds: string[];
  data?: any; // Additional data for specific operations
}

export interface BulkOperationResult {
  successful: string[];
  failed: { userId: string; error: string }[];
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

// Approval workflow types
export interface ApprovalRequest {
  id: string;
  userId: string;
  requestType: 'user_creation' | 'user_upgrade' | 'credit_increase' | 'feature_access';
  requestData: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNotes?: string;
}

export interface CreateApprovalRequest {
  userId: string;
  requestType: 'user_creation' | 'user_upgrade' | 'credit_increase' | 'feature_access';
  requestData: Record<string, any>;
  notes?: string;
}

// Company management types (for future expansion)
export interface Company {
  id: string;
  name: string;
  domain?: string;
  description?: string;
  industry?: string;
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  subscriptionPlan?: 'trial' | 'basic' | 'professional' | 'enterprise';
  settings?: CompanySettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  maxUsers?: number;
  defaultCredits?: number;
  allowedFeatures?: string[];
  customPolicies?: Record<string, any>;
}

// Re-export from AuthTypes to avoid circular imports
export type { APIResponse, ErrorResponse } from './AuthTypes';

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}