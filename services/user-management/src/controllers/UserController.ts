import { Request, Response } from 'express';
import { SupabaseService } from '@/services/SupabaseService';
import { SupabaseAuthService } from '@/services/SupabaseAuthService';
import { AuthMiddleware } from '@/middleware/auth';
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
} from '@/types/UserTypes';

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
      const securityContext = AuthMiddleware.extractUser(req);
      const userId = securityContext.user.id;

      // 🚀 优化：使用批量查询替代3个顺序查询（从 ~900ms 降至 ~300ms）
      const userData = await this.supabaseService.getUserFullProfile(userId);
      if (!userData) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Profile not found',
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
          permissions: securityContext.permissions
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