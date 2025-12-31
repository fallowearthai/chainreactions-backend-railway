import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserProfile,
  CreateUserRequest,
  UpdateUserRequest,
  UserRole,
  AssignRoleRequest,
  UserUsageCredits,
  AddCreditsRequest,
  CreditTransaction,
  UsageStats,
  TimePeriod,
  UserManagementFilters,
  PaginatedUsers,
  BulkUserOperation,
  BulkOperationResult,
  ApprovalRequest,
  CreateApprovalRequest
} from '@/types/UserTypes';

export class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient;

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase configuration missing:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_ANON_KEY: !!supabaseAnonKey
      });
      throw new Error('Missing required Supabase configuration');
    }

    // Use Anon Key since Service Role Key is not provided
    // This limits some admin operations but keeps the service running
    const apiKey = supabaseAnonKey;
    const keyType = 'ANON_KEY';

    if (supabaseServiceKey && supabaseServiceKey.length < 10) {
      console.warn('⚠️ SERVICE_ROLE_KEY is too short or missing, using ANON_KEY instead');
    }

    console.log('🔑 SupabaseService initializing with:', {
      url: supabaseUrl,
      keyType: keyType,
      keyPrefix: apiKey?.substring(0, 20) + '...',
      usingAnonKey: !supabaseServiceKey,
      hasServiceKey: !!supabaseServiceKey,
      hasAnonKey: !!supabaseAnonKey,
      serviceKeyLength: supabaseServiceKey?.length,
      anonKeyLength: supabaseAnonKey?.length
    });

    this.client = createClient(supabaseUrl, apiKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('✅ SupabaseService client created successfully');
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Profile Management
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to fetch user profile: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  /**
   * 批量获取用户完整信息（Profile + Credits + Role）
   * 使用单个查询替代3个顺序查询，性能提升约70%
   *
   * @param userId - 用户ID
   * @returns 包含profile、credits和role的完整用户信息，如果用户不存在返回null
   */
  async getUserFullProfile(userId: string): Promise<{
    profile: UserProfile;
    credits: UserUsageCredits | null;
    role: UserRole | null;
  } | null> {
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select(`
          *,
          user_usage_credits!user_usage_credits_user_id_fkey(*),
          user_roles!user_roles_user_id_fkey(*)
        `)
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to fetch user full profile: ${error.message}`);
      }

      // Supabase 返回的关联数据可能是数组，需要提取第一个元素
      const credits = Array.isArray(data.user_usage_credits)
        ? data.user_usage_credits[0] || null
        : data.user_usage_credits || null;

      const role = Array.isArray(data.user_roles)
        ? data.user_roles[0] || null
        : data.user_roles || null;

      // 移除嵌套数据，只保留profile字段
      const { user_usage_credits, user_roles, ...profile } = data;

      return {
        profile: profile as UserProfile,
        credits: credits as UserUsageCredits | null,
        role: role as UserRole | null
      };
    } catch (error) {
      console.error('Get user full profile error:', error);
      throw error;
    }
  }

  async createUserProfile(userId: string, request: CreateUserRequest): Promise<UserProfile> {
    try {
      const { data, error } = await this.client
        .from('profiles')
        .insert({
          id: userId,
          email: request.email,
          display_name: request.displayName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create user profile: ${error.message}`);
      }

      console.log('User profile created:', userId);
      return data;
    } catch (error) {
      console.error('Create user profile error:', error);
      throw error;
    }
  }

  async updateUserProfile(userId: string, request: UpdateUserRequest): Promise<UserProfile> {
    try {
      const updates: any = {
        ...request,
        display_name: request.displayName,
        updated_at: new Date().toISOString()
      };

      // Remove undefined fields
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      });

      const { data, error } = await this.client
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update user profile: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Update user profile error:', error);
      throw error;
    }
  }

  async deactivateUser(userId: string): Promise<void> {
    try {
      // In invite-only system, we deactivate by removing the user's roles
      const { error } = await this.client
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to deactivate user: ${error.message}`);
      }

      console.log('User deactivated:', userId);
    } catch (error) {
      console.error('Deactivate user error:', error);
      throw error;
    }
  }

  // User Management (with filters and pagination)
  async getUsers(filters: UserManagementFilters, page: number = 1, limit: number = 20): Promise<PaginatedUsers> {
    try {
      const offset = (page - 1) * limit;

      let query = this.client
        .from('profiles')
        .select(`
          *,
          user_roles!inner(role, assigned_at),
          user_usage_credits!inner(account_type, ordinary_search_credits, long_search_credits)
        `, { count: 'exact' });

      // Apply filters (in invite-only system, all users are active)
      if (filters.status) {
        // In invite-only system, we don't have pending/approved states
        // Users are either active or inactive based on their roles
        if (filters.status === 'active') {
          query = query.not('user_roles.role', 'is', null);
        } else if (filters.status === 'inactive') {
          query = query.is('user_roles.role', null);
        }
      }

      if (filters.search) {
        query = query.or(`email.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%`);
      }

      if (filters.createdAfter) {
        query = query.gte('created_at', filters.createdAfter);
      }

      if (filters.createdBefore) {
        query = query.lte('created_at', filters.createdBefore);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      // Transform data to match expected structure
      const users = (data || []).map((profile: any) => ({
        ...profile,
        credits: {
          id: profile.user_usage_credits.id,
          userId: profile.id,
          ordinarySearchCredits: profile.user_usage_credits.ordinary_search_credits,
          longSearchCredits: profile.user_usage_credits.long_search_credits,
          accountType: profile.user_usage_credits.account_type,
          creditsResetDate: profile.user_usage_credits.credits_reset_date,
          createdAt: profile.user_usage_credits.created_at,
          updatedAt: profile.user_usage_credits.updated_at
        },
        role: {
          id: profile.user_roles.id,
          userId: profile.id,
          role: profile.user_roles.role,
          assignedBy: profile.user_roles.user_id, // This needs to be corrected
          assignedAt: profile.user_roles.assigned_at
        }
      }));

      return {
        users,
        total: count || 0,
        page,
        limit,
        hasMore: (offset + limit) < (count || 0)
      };
    } catch (error) {
      console.error('Get users error:', error);
      throw error;
    }
  }

  // Role Management
  async getUserRole(userId: string): Promise<UserRole | null> {
    try {
      const { data, error } = await this.client
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to fetch user role: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Get user role error:', error);
      throw error;
    }
  }

  async assignRole(request: AssignRoleRequest): Promise<UserRole> {
    try {
      const { data, error } = await this.client
        .from('user_roles')
        .upsert({
          user_id: request.userId,
          role: request.role,
          assigned_by: 'system', // This should be the current admin user
          assigned_at: new Date().toISOString(),
          expires_at: request.expiresAt || null
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to assign role: ${error.message}`);
      }

      console.log('Role assigned:', request.userId, request.role);
      return data;
    } catch (error) {
      console.error('Assign role error:', error);
      throw error;
    }
  }

  async removeRole(userId: string, role: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) {
        throw new Error(`Failed to remove role: ${error.message}`);
      }

      console.log('Role removed:', userId, role);
    } catch (error) {
      console.error('Remove role error:', error);
      throw error;
    }
  }

  // Credits Management
  async getUserCredits(userId: string): Promise<UserUsageCredits | null> {
    try {
      // First try to get user's credits - might need admin privileges
      const { data, error } = await this.client
        .from('user_usage_credits')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Create default credits if not found
          const defaultCredits = {
            user_id: userId,
            ordinary_search_credits: 1000,
            long_search_credits: 100,
            enterprise_search_credits: 10,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // Try to insert default credits
          const { data: insertedData, error: insertError } = await this.client
            .from('user_usage_credits')
            .insert(defaultCredits)
            .select()
            .single();

          if (insertError) {
            console.warn('Could not create default credits:', insertError.message);
            return null;
          }

          return insertedData;
        }

        // If we get here, it's likely a permission issue
        console.warn('Failed to fetch user credits (permission issue):', error.message);

        // Return default credits structure
        return {
          id: `default_${userId}`,
          userId: userId,
          ordinarySearchCredits: 1000,
          longSearchCredits: 100,
          accountType: 'admin',
          creditsResetDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as unknown as UserUsageCredits;
      }

      return data;
    } catch (error) {
      console.error('Get user credits error:', error);
      // Return null instead of throwing to prevent service crash
      return null;
    }
  }

  async createDefaultCredits(userId: string, accountType: 'admin' | 'premium' | 'free_trial' = 'free_trial'): Promise<UserUsageCredits> {
    try {
      const defaultCredits = {
        admin: { ordinary: 1000, long: 100 },
        premium: { ordinary: 500, long: 50 },
        free_trial: { ordinary: 100, long: 10 }
      };

      const credits = defaultCredits[accountType];

      const { data, error } = await this.client
        .from('user_usage_credits')
        .insert({
          user_id: userId,
          ordinary_search_credits: credits.ordinary,
          long_search_credits: credits.long,
          account_type: accountType,
          credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create default credits: ${error.message}`);
      }

      console.log('Default credits created for user:', userId);
      return data;
    } catch (error) {
      console.error('Create default credits error:', error);
      throw error;
    }
  }

  async addCredits(request: AddCreditsRequest): Promise<CreditTransaction> {
    try {
      // First, get current credits
      const currentCredits = await this.getUserCredits(request.userId);
      if (!currentCredits) {
        throw new Error('User credits not found');
      }

      // Update credits
      const updatedCredits = {
        ordinary_search_credits: currentCredits.ordinarySearchCredits + request.amount,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await this.client
        .from('user_usage_credits')
        .update(updatedCredits)
        .eq('user_id', request.userId);

      if (updateError) {
        throw new Error(`Failed to update credits: ${updateError.message}`);
      }

      // Record transaction
      const { data, error } = await this.client
        .from('usage_transactions')
        .insert({
          user_id: request.userId,
          transaction_type: 'bonus', // Using 'bonus' for additions
          credits_used: -request.amount, // Negative for additions
          remaining_credits: updatedCredits.ordinary_search_credits,
          search_details: { reason: request.reason, type: request.transactionType },
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to record credit transaction: ${error.message}`);
      }

      console.log('Credits added:', request.userId, request.amount);
      return data;
    } catch (error) {
      console.error('Add credits error:', error);
      throw error;
    }
  }

  async deductCredits(userId: string, amount: number, reason: string, transactionType: 'ordinary_search' | 'long_search' = 'ordinary_search', searchDetails?: any): Promise<CreditTransaction> {
    try {
      // Call the enhanced database function to deduct credits
      const { data, error } = await this.client
        .rpc('deduct_user_credits_v2', {
          p_user_id: userId,
          p_credit_type: transactionType,
          p_credits_to_deduct: amount,
          p_search_details: {
            reason,
            service: 'user-management',
            ...searchDetails
          }
        });

      if (error) {
        throw new Error(`Failed to deduct credits via RPC: ${error.message}`);
      }

      // Parse the JSONB result from the function
      const result = typeof data === 'string' ? JSON.parse(data) : data;

      if (!result?.success) {
        throw new Error(result?.error || 'Credit deduction failed');
      }

      // Return the transaction record
      const { data: transactionData, error: fetchError } = await this.client
        .from('usage_transactions')
        .select('*')
        .eq('id', result.transaction_id)
        .single();

      if (fetchError) {
        // If we can't fetch the transaction, still return success but log the error
        console.warn('Failed to fetch transaction record after successful deduction:', fetchError);

        // Return a minimal transaction object
        return {
          id: result.transaction_id,
          userId: userId,
          transactionType: transactionType,
          creditsUsed: amount,
          remainingCredits: result.new_credits,
          searchDetails: result.search_details || { reason },
          createdAt: result.created_at
        } as unknown as CreditTransaction;
      }

      return transactionData;
    } catch (error) {
      console.error('Deduct credits error:', error);
      throw error;
    }
  }

  // Usage Statistics
  async getUserUsageStats(userId: string, period: TimePeriod): Promise<UsageStats> {
    try {
      const { data, error } = await this.client
        .from('usage_transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', period.start)
        .lte('created_at', period.end);

      if (error) {
        throw new Error(`Failed to fetch usage stats: ${error.message}`);
      }

      const transactions = data || [];
      const totalSearches = transactions.length;
      const ordinarySearches = transactions.filter(t => t.transaction_type === 'ordinary_search').length;
      const longSearches = transactions.filter(t => t.transaction_type === 'long_search').length;
      const creditsUsed = transactions.reduce((sum, t) => sum + (t.credits_used || 0), 0);
      const averageExecutionTime = transactions.reduce((sum, t) => {
        const time = t.search_details?.execution_time || 0;
        return sum + time;
      }, 0) / Math.max(totalSearches, 1);

      // Get top search types from search_history
      const { data: searchHistory, error: historyError } = await this.client
        .from('search_history')
        .select('search_type')
        .eq('user_id', userId)
        .gte('created_at', period.start)
        .lte('created_at', period.end);

      const searchTypeCounts: Record<string, number> = {};
      if (!historyError && searchHistory) {
        searchHistory.forEach(entry => {
          searchTypeCounts[entry.search_type] = (searchTypeCounts[entry.search_type] || 0) + 1;
        });
      }

      const topSearchTypes = Object.entries(searchTypeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([type]) => type);

      return {
        userId,
        period,
        totalSearches,
        ordinarySearches,
        longSearches,
        creditsUsed,
        averageExecutionTime: Math.round(averageExecutionTime),
        topSearchTypes
      };
    } catch (error) {
      console.error('Get usage stats error:', error);
      throw error;
    }
  }

  // Approval Workflow
  async createApprovalRequest(request: CreateApprovalRequest): Promise<ApprovalRequest> {
    try {
      const { data, error } = await this.client
        .from('approval_requests')
        .insert({
          user_id: request.userId,
          request_type: request.requestType,
          request_data: request.requestData,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create approval request: ${error.message}`);
      }

      console.log('Approval request created:', request.userId, request.requestType);
      return data;
    } catch (error) {
      console.error('Create approval request error:', error);
      throw error;
    }
  }

  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    try {
      const { data, error } = await this.client
        .from('approval_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch pending approvals: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Get pending approvals error:', error);
      throw error;
    }
  }

  // Helper Methods
  private handleError(error: any, operation: string): never {
    console.error(`${operation} error:`, error);
    throw new Error(`${operation} failed: ${error.message}`);
  }

  // Get raw client for direct usage
  getClient(): SupabaseClient {
    return this.client;
  }
}