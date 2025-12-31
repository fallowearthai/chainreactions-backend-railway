import { Request, Response } from 'express';
import { SupabaseService } from '../services/SupabaseService';
import { SupabaseAuthService } from '../services/SupabaseAuthService';
import { AuthMiddleware } from '../middleware/auth';
import {
  UserProfile,
  CreateUserRequest,
  UpdateUserRequest,
  PaginatedUsers,
  UserManagementFilters,
  UsageStats,
  TimePeriod,
  BulkUserOperation,
  BulkOperationResult,
  APIResponse,
  ErrorResponse
} from '../types/UserTypes';

export class UserController {
  private supabaseService: SupabaseService;
  private authService: SupabaseAuthService;

  constructor() {
    this.supabaseService = SupabaseService.getInstance();
    this.authService = SupabaseAuthService.getInstance();
  }

  // Get current user profile
  async getCurrentUserProfile(req: Request, res: Response): Promise<void> {
    try {
      // For lightweight authentication, get basic user data from request context
      if (!req.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Authentication required',
          details: 'User context not found',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      const userId = req.user.user.id;

      // Only query for credits (critical data that's not in JWT)
      // This reduces database load significantly
      const credits = await this.supabaseService.getUserCredits(userId);

      const profile = req.user.profile;
      const role = req.user.permissions.includes('admin') ? 'admin' : 'user';

      const response: APIResponse = {
        success: true,
        data: {
          ...profile,
          credits,
          role,
          permissions: req.user.permissions
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Get current user profile error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch user profile',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Get user by ID (admin only)
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      // 🚀 优化：并行执行批量查询和auth查询（从 ~1.2s 降至 ~500ms）
      const [userData, authUser] = await Promise.all([
        this.supabaseService.getUserFullProfile(userId),
        this.authService.getUserById(userId)
      ]);

      if (!userData) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User not found',
          details: 'User profile could not be found',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(404).json(errorResponse);
        return;
      }

      const { profile, credits, role } = userData;

      const response: APIResponse = {
        success: true,
        data: {
          ...profile,
          credits,
          role,
          authUser: {
            email: authUser?.email,
            emailConfirmed: !!authUser?.email_confirmed_at,
            lastSignInAt: authUser?.last_sign_in_at,
            createdAt: authUser?.created_at
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Get user by ID error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch user',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Get users with filtering and pagination (admin only)
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const filters: UserManagementFilters = {
        status: req.query.status as any,
        role: req.query.role as any,
        accountType: req.query.accountType as any,
        company: req.query.company as string,
        search: req.query.search as string,
        createdAfter: req.query.createdAfter as string,
        createdBefore: req.query.createdBefore as string
      };

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.supabaseService.getUsers(filters, page, limit);

      const response: APIResponse<PaginatedUsers> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Get users error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Update user profile
  async updateUserProfile(req: Request, res: Response): Promise<void> {
    try {
      const securityContext = AuthMiddleware.extractUser(req);
      const userId = req.params.userId || securityContext.user.id;

      // Check if user is updating their own profile or is admin
      if (userId !== securityContext.user.id && !AuthMiddleware.isAdmin(req)) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Access denied',
          details: 'You can only update your own profile',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(403).json(errorResponse);
        return;
      }

      const updateData: UpdateUserRequest = req.body;

      const updatedProfile = await this.supabaseService.updateUserProfile(userId, updateData);

      const response: APIResponse = {
        success: true,
        data: updatedProfile,
        message: 'Profile updated successfully',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Update user profile error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to update profile',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  
  // Deactivate user (admin only)
  async deactivateUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      await this.supabaseService.deactivateUser(userId);

      const response: APIResponse = {
        success: true,
        message: 'User deactivated successfully',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Deactivate user error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to deactivate user',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Get user usage statistics
  async getUserUsageStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const securityContext = AuthMiddleware.extractUser(req);

      // Users can only view their own stats unless they're admin
      if (userId !== securityContext.user.id && !AuthMiddleware.isAdmin(req)) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Access denied',
          details: 'You can only view your own usage statistics',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(403).json(errorResponse);
        return;
      }

      const period: TimePeriod = {
        start: req.query.startDate as string,
        end: req.query.endDate as string
      };

      const usageStats = await this.supabaseService.getUserUsageStats(userId, period);

      const response: APIResponse<UsageStats> = {
        success: true,
        data: usageStats,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Get user usage stats error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to fetch usage statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Add credits to user (admin only)
  async addCredits(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { amount, reason, transactionType } = req.body;

      const transaction = await this.supabaseService.addCredits({
        userId,
        amount,
        reason,
        transactionType
      });

      const response: APIResponse = {
        success: true,
        data: transaction,
        message: 'Credits added successfully',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Add credits error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to add credits',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Perform bulk user operations (admin only)
  async bulkUserOperation(req: Request, res: Response): Promise<void> {
    try {
      const operation: BulkUserOperation = req.body;
      const securityContext = AuthMiddleware.extractUser(req);

      const results: BulkOperationResult = {
        successful: [],
        failed: [],
        totalProcessed: operation.userIds.length,
        successCount: 0,
        failureCount: 0
      };

      // Process each user in the bulk operation
      for (const userId of operation.userIds) {
        try {
          switch (operation.action) {
            case 'deactivate':
              await this.supabaseService.deactivateUser(userId);
              results.successful.push(userId);
              break;

            case 'addCredits':
              if (operation.data?.amount && operation.data?.reason) {
                await this.supabaseService.addCredits({
                  userId,
                  amount: operation.data.amount,
                  reason: operation.data.reason,
                  transactionType: operation.data.transactionType || 'bonus'
                });
                results.successful.push(userId);
              } else {
                results.failed.push({
                  userId,
                  error: 'Missing amount or reason for credit addition'
                });
              }
              break;

            // Add more bulk operations as needed
            default:
              results.failed.push({
                userId,
                error: `Unsupported operation: ${operation.action}`
              });
          }
        } catch (error) {
          results.failed.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      results.successCount = results.successful.length;
      results.failureCount = results.failed.length;

      const response: APIResponse<BulkOperationResult> = {
        success: true,
        data: results,
        message: `Bulk operation completed: ${results.successCount} successful, ${results.failureCount} failed`,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Bulk user operation error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to perform bulk operation',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Validate user credits before performing operations
  async validateCredits(req: Request, res: Response): Promise<void> {
    try {
      const { transactionType, amount } = req.body;
      const securityContext = AuthMiddleware.extractUser(req);
      const userId = securityContext.user.id;

      // Call the database function to validate credits
      const { data, error } = await this.supabaseService.getClient()
        .rpc('get_user_credit_info', {
          p_user_id: userId
        });

      if (error) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to validate credits',
          details: error.message,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(500).json(errorResponse);
        return;
      }

      // get_user_credit_info returns a TABLE (array), so we need to get the first row
      const creditInfoArray = data;
      let hasEnoughCredits = false;

      // Check if we got any results
      if (!creditInfoArray || creditInfoArray.length === 0) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to validate credits',
          details: 'User credit record not found',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Get the first (and should be only) row
      const creditInfo = creditInfoArray[0];
      const accountType = creditInfo?.account_type;

      // Check if account is active
      if (!creditInfo?.is_active) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Account is not active',
          details: 'Please contact support',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(403).json(errorResponse);
        return;
      }

      if (accountType === 'admin') {
        hasEnoughCredits = true; // Admin has unlimited credits (NULL values)
      } else {
        // Determine which credit field to check based on transaction type
        const isLongSearch = transactionType === 'long_search' || transactionType === 'deepthinking_search' || transactionType === 'dataset_search';
        const availableCredits = isLongSearch
          ? creditInfo?.long_search_credits
          : creditInfo?.ordinary_search_credits;

        // Check for expired trial
        if (accountType === 'free_trial') {
          const trialEndDate = new Date(creditInfo?.trial_end_date);
          const isExpired = trialEndDate < new Date();
          if (isExpired) {
            hasEnoughCredits = false;
          } else {
            hasEnoughCredits = (availableCredits || 0) >= (amount || 1);
          }
        } else {
          hasEnoughCredits = (availableCredits || 0) >= (amount || 1);
        }
      }

      const response: APIResponse = {
        success: true,
        data: {
          hasCredits: hasEnoughCredits,
          hasEnoughCredits: hasEnoughCredits, // For backwards compatibility
          remainingCredits: {
            ordinary_search: creditInfo?.ordinary_search_credits,
            long_search: creditInfo?.long_search_credits
          },
          account_type: accountType,
          trial_end_date: creditInfo?.trial_end_date,
          is_active: creditInfo?.is_active
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Validate credits error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to validate credits',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Deduct user credits (called by other microservices)
  async deductCredits(req: Request, res: Response): Promise<void> {
    try {
      const { creditType, amount, searchDetails } = req.body;
      const securityContext = AuthMiddleware.extractUser(req);
      const userId = securityContext.user.id;

      // Call the database function to deduct credits
      const { data, error } = await this.supabaseService.getClient()
        .rpc('deduct_user_credits_v2', {
          p_user_id: userId,
          p_credit_type: creditType,
          p_credits_to_deduct: amount || 1,
          p_search_details: searchDetails || null
        });

      if (error) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to deduct credits',
          details: error.message,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(500).json(errorResponse);
        return;
      }

      // Parse the JSONB result from the new function
      const result = typeof data === 'string' ? JSON.parse(data) : data;

      const response: APIResponse = {
        success: result?.success || false,
        data: {
          deducted: result?.success || false,
          transaction_id: result?.transaction_id,
          credits_deducted: result?.credits_deducted,
          new_credits: result?.new_credits,
          unlimited: result?.unlimited || false
        },
        message: result?.success ? 'Credits deducted successfully' : result?.error || 'Credit deduction failed',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Deduct credits error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to deduct credits',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Reset user credits (admin only)
  async resetUserCredits(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { resetType } = req.body;

      // Call the database function to reset credits
      const { data, error } = await this.supabaseService.getClient()
        .rpc('reset_user_credits', {
          user_uuid: userId,
          reset_type: resetType || 'monthly'
        });

      if (error) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to reset credits',
          details: error.message,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(500).json(errorResponse);
        return;
      }

      const response: APIResponse = {
        success: data === true,
        data: { reset: data === true },
        message: data === true ? 'Credits reset successfully' : 'Credit reset failed',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Reset credits error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to reset credits',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  
  // Monthly credit reset for all subscribed users (admin only)
  async monthlyCreditReset(req: Request, res: Response): Promise<void> {
    try {
      // Call the database function to reset all credits
      const { data, error } = await this.supabaseService.getClient()
        .rpc('monthly_credit_reset');

      if (error) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to perform monthly credit reset',
          details: error.message,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(500).json(errorResponse);
        return;
      }

      const response: APIResponse = {
        success: true,
        data: {
          resetCount: data,
          lastResetDate: new Date().toISOString()
        },
        message: `Monthly credit reset completed for ${data} users`,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Monthly credit reset error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to perform monthly credit reset',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Check and expire trials (admin only)
  async checkAndExpireTrials(req: Request, res: Response): Promise<void> {
    try {
      // Call the database function to check and expire trials
      const { data, error } = await this.supabaseService.getClient()
        .rpc('check_and_expire_trials');

      if (error) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to check and expire trials',
          details: error.message,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(500).json(errorResponse);
        return;
      }

      const response: APIResponse = {
        success: true,
        data: {
          expiredCount: data,
          checkDate: new Date().toISOString()
        },
        message: `${data} trials expired and deactivated`,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Check and expire trials error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to check and expire trials',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Update user account type (admin only)
  async updateUserAccountType(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { accountType, reason } = req.body;
      const securityContext = AuthMiddleware.extractUser(req);
      const adminId = securityContext.user.id;

      // Validate account type
      if (!['free_trial', 'premium', 'admin'].includes(accountType)) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Invalid account type',
          details: 'Account type must be one of: free_trial, premium, admin',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Get current user data to track changes
      const { data: currentData, error: fetchError } = await this.supabaseService.getClient()
        .from('user_usage_credits')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'User not found',
          details: 'User credits record not found',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(404).json(errorResponse);
        return;
      }

      const oldAccountType = currentData.account_type;

      // Prepare update data based on new account type
      let updateData: any = {
        account_type: accountType,
        updated_at: new Date().toISOString()
      };

      // Handle different account type transitions
      if (accountType === 'premium') {
        // Upgrading to premium - reset credits and set subscription start
        updateData = {
          ...updateData,
          ordinary_search_credits: 250,
          long_search_credits: 100,
          trial_start_date: null,
          trial_end_date: null,
          subscription_start_date: new Date().toISOString(),
          last_credit_reset: new Date().toISOString()
        };
      } else if (accountType === 'admin') {
        // Upgrading to admin - unlimited credits (null values)
        updateData = {
          ...updateData,
          ordinary_search_credits: null,
          long_search_credits: null,
          trial_start_date: null,
          trial_end_date: null,
          subscription_start_date: new Date().toISOString()
        };
      } else if (accountType === 'free_trial') {
        // Downgrading to trial - set trial period and limited credits
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        updateData = {
          ...updateData,
          ordinary_search_credits: 50,
          long_search_credits: 5,
          trial_start_date: new Date().toISOString(),
          trial_end_date: trialEndDate.toISOString(),
          subscription_start_date: null
        };
      }

      // Update the user's account type and credits
      const { data: updatedData, error: updateError } = await this.supabaseService.getClient()
        .from('user_usage_credits')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to update account type',
          details: updateError.message,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(500).json(errorResponse);
        return;
      }

      // Log the account type change for audit purposes
      const { error: logError } = await this.supabaseService.getClient()
        .from('account_type_changes')
        .insert({
          user_id: userId,
          old_account_type: oldAccountType,
          new_account_type: accountType,
          changed_by: adminId,
          change_reason: reason || 'Administrative action',
          change_date: new Date().toISOString()
        });

      if (logError) {
        console.warn('Failed to log account type change:', logError);
        // Don't fail the operation if logging fails
      }

      const response: APIResponse = {
        success: true,
        data: {
          userId,
          oldAccountType,
          newAccountType: accountType,
          updatedCredits: {
            ordinary_search_credits: updatedData.ordinary_search_credits,
            long_search_credits: updatedData.long_search_credits
          },
          changedBy: adminId,
          changeDate: new Date().toISOString()
        },
        message: `User account type successfully changed from ${oldAccountType} to ${accountType}`,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Update user account type error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to update account type',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Health check for user management operations
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Test database connection
      const profileCount = await this.supabaseService.getClient()
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const response: APIResponse = {
        success: true,
        data: {
          status: 'healthy',
          service: 'User Management Service',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          database: {
            connected: true,
            profileCount: profileCount.count
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Health check error:', error);
      const response: APIResponse = {
        success: false,
        data: {
          status: 'unhealthy',
          service: 'User Management Service',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      res.status(503).json(response);
    }
  }
}