import { Request, Response } from 'express';
import { SupabaseAuthService } from '@/services/SupabaseAuthService';
import { SupabaseService } from '@/services/SupabaseService';
import { AuthMiddleware } from '@/middleware/auth';
import {
  SignUpRequest,
  SignInRequest,
  PasswordResetRequest,
  UpdatePasswordRequest,
  EmailVerificationRequest,
  AuthResponse,
  APIResponse,
  ErrorResponse
} from '@/types/AuthTypes';

export class AuthController {
  private authService: SupabaseAuthService;
  private supabaseService: SupabaseService;

  constructor() {
    this.authService = SupabaseAuthService.getInstance();
    this.supabaseService = SupabaseService.getInstance();
  }

  // User Registration
  async signUp(req: Request, res: Response): Promise<void> {
    try {
      const signUpRequest: SignUpRequest = req.body;

      // Attempt to sign up the user
      const authResult = await this.authService.signUp(signUpRequest);

      if (authResult.error || !authResult.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: authResult.error || 'Registration failed',
          details: authResult.message,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // If signup successful, create user profile
      if (authResult.user) {
        try {
          await this.supabaseService.createUserProfile(authResult.user.id, {
            email: signUpRequest.email,
            displayName: signUpRequest.displayName,
            department: signUpRequest.department
          });

          // Create default credits for the user
          await this.supabaseService.createDefaultCredits(authResult.user.id, 'free_trial');

          console.log('User profile and credits created for:', authResult.user.id);
        } catch (profileError) {
          console.error('Error creating user profile:', profileError);
          // Note: User is created in auth system, so we should still return success
          // but log the error for manual follow-up
        }
      }

      const response: APIResponse = {
        success: true,
        data: {
          user: authResult.user,
          session: authResult.session
        },
        message: authResult.message || 'Registration successful. Please check your email for verification.',
        timestamp: new Date().toISOString()
      };

      // Don't include full session data in registration response for security
      if (response.data?.session) {
        response.data.session = {
          access_token: response.data.session.access_token,
          refresh_token: response.data.session.refresh_token,
          expires_in: response.data.session.expires_in,
          user: {
            id: response.data.session.user.id,
            email: response.data.session.user.email,
            email_confirmed_at: response.data.session.user.email_confirmed_at
          }
        };
      }

      res.status(201).json(response);
    } catch (error) {
      console.error('Sign up error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Registration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // User Sign In
  async signIn(req: Request, res: Response): Promise<void> {
    try {
      const signInRequest: SignInRequest = req.body;

      const authResult = await this.authService.signIn(signInRequest);

      if (authResult.error || !authResult.user || !authResult.session) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: authResult.error || 'Sign in failed',
          details: authResult.message,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      // 🚀 优化：使用批量查询获取完整用户信息（从 ~800ms 降至 ~600ms）
      const userData = await this.supabaseService.getUserFullProfile(authResult.user.id);

      if (!userData) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Profile not found',
          details: 'User profile could not be found. Please contact support.',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      const { profile, credits, role } = userData;

      const response: APIResponse = {
        success: true,
        data: {
          user: authResult.user,
          session: authResult.session,
          profile,
          credits,
          role
        },
        message: authResult.message || 'Sign in successful',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Sign in error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Sign in failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // User Sign Out
  async signOut(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.authService.signOut();

      if (!result.success) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: result.error || 'Sign out failed',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: 'Signed out successfully',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Sign out error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Sign out failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Verify Email
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      const authResult = await this.authService.verifyEmail(token);

      if (authResult.error || !authResult.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: authResult.error || 'Email verification failed',
          details: authResult.message,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Create approval request for newly verified user
      try {
        await this.supabaseService.createApprovalRequest({
          userId: authResult.user.id,
          requestType: 'user_creation',
          requestData: {
            email: authResult.user.email,
            verifiedAt: new Date().toISOString()
          },
          notes: 'User completed email verification and awaiting approval'
        });
      } catch (approvalError) {
        console.error('Error creating approval request:', approvalError);
        // Continue with success response even if approval request fails
      }

      const response: APIResponse = {
        success: true,
        data: {
          user: authResult.user,
          session: authResult.session
        },
        message: authResult.message || 'Email verified successfully. Your account is now pending approval.',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Email verification error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Email verification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Request Password Reset
  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const request: PasswordResetRequest = req.body;

      const result = await this.authService.requestPasswordReset(request);

      if (!result.success) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: result.error || 'Password reset request failed',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: 'Password reset instructions sent to your email',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Password reset request error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Password reset request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Update Password
  async updatePassword(req: Request, res: Response): Promise<void> {
    try {
      const request: UpdatePasswordRequest = req.body;

      const result = await this.authService.updatePassword(request);

      if (!result.success) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: result.error || 'Password update failed',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const response: APIResponse = {
        success: true,
        message: 'Password updated successfully',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Update password error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Password update failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Get Current User
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Authentication required',
          details: 'Please provide a valid authorization token',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      const token = authHeader.substring(7);
      const user = await this.authService.getCurrentUser(token);

      if (!user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Invalid token',
          details: 'User not found or token expired',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      const response: APIResponse = {
        success: true,
        data: { user },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Get current user error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to get current user',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Refresh Token
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Refresh token required',
          details: 'Please provide a valid refresh token',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const authResult = await this.authService.refreshToken(refresh_token);

      if (authResult.error || !authResult.session) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: authResult.error || 'Token refresh failed',
          details: authResult.message,
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      const response: APIResponse = {
        success: true,
        data: {
          session: authResult.session
        },
        message: authResult.message || 'Token refreshed successfully',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Refresh token error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Token refresh failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Service Authentication (for inter-service communication)
  async authenticateService(req: Request, res: Response): Promise<void> {
    try {
      // This endpoint is used by other services to authenticate users
      const { token } = req.body;

      if (!token) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Token required',
          details: 'Please provide a valid authentication token',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(400).json(errorResponse);
        return;
      }

      const validation = await this.authService.validateJWT(token);

      if (!validation.valid || !validation.user) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Invalid token',
          details: validation.error || 'Token validation failed',
          timestamp: new Date().toISOString(),
          path: req.path
        };
        res.status(401).json(errorResponse);
        return;
      }

      // Get additional user data
      const profile = await this.supabaseService.getUserProfile(validation.user.id);
      const credits = await this.supabaseService.getUserCredits(validation.user.id);
      const role = await this.supabaseService.getUserRole(validation.user.id);

      const response: APIResponse = {
        success: true,
        data: {
          user: validation.user,
          profile,
          credits,
          role,
          permissions: await this.getUserPermissions(role?.role || 'user')
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      console.error('Service authentication error:', error);
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Service authentication failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        path: req.path
      };
      res.status(500).json(errorResponse);
    }
  }

  // Helper method to get user permissions
  private async getUserPermissions(role: string): Promise<string[]> {
    switch (role) {
      case 'admin':
        return ['admin', 'user_management', 'approve_users', 'manage_credits', 'view_analytics'];
      case 'manager':
        return ['manager', 'team_management', 'view_team_analytics'];
      case 'user':
      default:
        return ['user', 'search', 'view_own_data'];
    }
  }
}