import { Request, Response, NextFunction } from 'express';
import { SupabaseAuthService } from '../services/SupabaseAuthService';
import { SupabaseService } from '../services/SupabaseService';
import { AuthMiddleware } from '../middleware/auth';
import {
  SignUpRequest,
  SignInRequest,
  PasswordResetRequest,
  UpdatePasswordRequest,
  EmailVerificationRequest,
  AuthResponse
} from '../types/AuthTypes';
import { BaseController } from '../../../shared/base/BaseController';
import {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ServiceError
} from '../../../shared/errors/ServiceErrors';
import { HTTP_STATUS, VALIDATION } from '../../../shared/constants/ServiceConstants';

/**
 * Authentication Controller for User Management Service
 *
 * This controller handles user authentication, registration, and token management.
 * Extends BaseController to leverage shared error handling and response formatting.
 */
export class AuthController extends BaseController {
  private authService: SupabaseAuthService;
  private supabaseService: SupabaseService;

  constructor() {
    super('user-management');
    this.authService = SupabaseAuthService.getInstance();
    this.supabaseService = SupabaseService.getInstance();
  }

  /**
   * User Registration
   * POST /api/auth/signup
   */
  signUp = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.logRequest(req, 'User registration attempt');

    const validation = this.validateSignUpRequest(req.body);
    if (!validation.isValid) {
      throw new ValidationError('Invalid registration data', validation.errors);
    }

    const signUpRequest: SignUpRequest = req.body;

    // Attempt to sign up the user
    const authResult = await this.authService.signUp(signUpRequest);

    if (authResult.error || !authResult.user) {
      throw new ValidationError(
        authResult.error || 'Registration failed',
        authResult.message
      );
    }

    // Create user profile and credits
    await this.createUserProfileAndCredits(authResult.user, signUpRequest);

    const response = this.formatAuthResponse(authResult, 'Registration successful. Please check your email for verification.');
    this.sendSuccess(res, response.data, response.message, HTTP_STATUS.CREATED);
  });

  /**
   * User Sign In
   * POST /api/auth/signin
   */
  signIn = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.logRequest(req, 'User sign in attempt');

    const validation = this.validateSignInRequest(req.body);
    if (!validation.isValid) {
      throw new ValidationError('Invalid sign in data', validation.errors);
    }

    const signInRequest: SignInRequest = req.body;
    const authResult = await this.authService.signIn(signInRequest);

    if (authResult.error || !authResult.user || !authResult.session) {
      throw new AuthenticationError(
        authResult.error || 'Sign in failed',
        authResult.message
      );
    }

    // Get complete user profile data
    const userData = await this.supabaseService.getUserFullProfile(authResult.user.id);

    if (!userData) {
      throw new NotFoundError('user profile', authResult.user.id, 'User profile could not be found');
    }

    const response = {
      user: authResult.user,
      session: authResult.session,
      ...userData
    };

    this.sendSuccess(res, response, authResult.message || 'Sign in successful');
  });

  /**
   * User Sign Out
   * POST /api/auth/signout
   */
  signOut = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.logRequest(req, 'User sign out attempt');

    const result = await this.authService.signOut();

    if (!result.success) {
      throw new ServiceError(HTTP_STATUS.BAD_REQUEST, 'SIGNOUT_FAILED', result.error || 'Sign out failed');
    }

    this.sendSuccess(res, null, 'Signed out successfully');
  });

  /**
   * Verify Email
   * POST /api/auth/verify
   */
  verifyEmail = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.logRequest(req, 'Email verification attempt');

    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Verification token is required');
    }

    const authResult = await this.authService.verifyEmail(token);

    if (authResult.error || !authResult.user) {
      throw new ValidationError(
        authResult.error || 'Email verification failed',
        authResult.message
      );
    }

    // Create approval request for newly verified user
    await this.createApprovalRequestForUser(authResult.user);

    const response = this.formatAuthResponse(
      authResult,
      'Email verified successfully. Your account is now pending approval.'
    );

    this.sendSuccess(res, response.data, response.message);
  });

  /**
   * Request Password Reset
   * POST /api/auth/reset-password/request
   */
  requestPasswordReset = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.logRequest(req, 'Password reset request');

    const validation = this.validatePasswordResetRequest(req.body);
    if (!validation.isValid) {
      throw new ValidationError('Invalid password reset request', validation.errors);
    }

    const request: PasswordResetRequest = req.body;
    const result = await this.authService.requestPasswordReset(request);

    if (!result.success) {
      throw new ServiceError(HTTP_STATUS.BAD_REQUEST, 'PASSWORD_RESET_FAILED', result.error || 'Password reset request failed');
    }

    this.sendSuccess(res, null, 'Password reset instructions sent to your email');
  });

  /**
   * Update Password
   * POST /api/auth/update-password
   */
  updatePassword = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.logRequest(req, 'Password update attempt');

    const validation = this.validateUpdatePasswordRequest(req.body);
    if (!validation.isValid) {
      throw new ValidationError('Invalid password update request', validation.errors);
    }

    const request: UpdatePasswordRequest = req.body;
    const result = await this.authService.updatePassword(request);

    if (!result.success) {
      throw new ServiceError(HTTP_STATUS.BAD_REQUEST, 'PASSWORD_UPDATE_FAILED', result.error || 'Password update failed');
    }

    this.sendSuccess(res, null, 'Password updated successfully');
  });

  /**
   * Get Current User
   * GET /api/auth/me
   */
  getCurrentUser = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.logRequest(req, 'Get current user attempt');

    const token = this.extractBearerToken(req);
    if (!token) {
      throw new AuthenticationError('Authentication required', 'Please provide a valid authorization token');
    }

    const user = await this.authService.getCurrentUser(token);

    if (!user) {
      throw new AuthenticationError('Invalid token', 'User not found or token expired');
    }

    this.sendSuccess(res, { user }, 'Current user retrieved successfully');
  });

  /**
   * Refresh Token
   * POST /api/auth/refresh
   */
  refreshToken = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.logRequest(req, 'Token refresh attempt');

    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw new ValidationError('Refresh token required', 'Please provide a valid refresh token');
    }

    const authResult = await this.authService.refreshToken(refresh_token);

    if (authResult.error || !authResult.session) {
      throw new AuthenticationError(
        authResult.error || 'Token refresh failed',
        authResult.message
      );
    }

    this.sendSuccess(res,
      { session: authResult.session },
      authResult.message || 'Token refreshed successfully'
    );
  });

  /**
   * Service Authentication (for inter-service communication)
   * POST /api/auth/service-auth
   */
  authenticateService = this.asyncHandler(async (req: Request, res: Response): Promise<void> => {
    this.logRequest(req, 'Service authentication attempt');

    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Token required', 'Please provide a valid authentication token');
    }

    const validation = await this.authService.validateJWT(token);

    if (!validation.valid || !validation.user) {
      throw new AuthenticationError(
        'Invalid token',
        validation.error || 'Token validation failed'
      );
    }

    // Get additional user data
    const [profile, credits, role] = await Promise.all([
      this.supabaseService.getUserProfile(validation.user.id),
      this.supabaseService.getUserCredits(validation.user.id),
      this.supabaseService.getUserRole(validation.user.id)
    ]);

    const permissions = await this.getUserPermissions(role?.role || 'user');

    const response = {
      user: validation.user,
      profile,
      credits,
      role,
      permissions
    };

    this.sendSuccess(res, response, 'Service authentication successful');
  });

  // Private Helper Methods

  /**
   * Validate sign up request
   */
  private validateSignUpRequest(body: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    const requiredValidation = this.validateRequiredFields(body, [
      'email', 'password', 'displayName'
    ]);
    errors.push(...requiredValidation.errors);

    // Email validation
    if (body.email && !this.validateEmail(body.email)) {
      errors.push('Invalid email format');
    }

    // Password validation
    const passwordValidation = this.validateStringField(
      body.password,
      'password',
      VALIDATION.MIN_PASSWORD_LENGTH,
      VALIDATION.MAX_PASSWORD_LENGTH
    );
    errors.push(...passwordValidation.errors);

    // Display name validation
    const nameValidation = this.validateStringField(
      body.displayName,
      'displayName',
      VALIDATION.MIN_NAME_LENGTH,
      VALIDATION.MAX_NAME_LENGTH
    );
    errors.push(...nameValidation.errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate sign in request
   */
  private validateSignInRequest(body: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const requiredValidation = this.validateRequiredFields(body, [
      'email', 'password'
    ]);
    errors.push(...requiredValidation.errors);

    if (body.email && !this.validateEmail(body.email)) {
      errors.push('Invalid email format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate password reset request
   */
  private validatePasswordResetRequest(body: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const requiredValidation = this.validateRequiredFields(body, ['email']);
    errors.push(...requiredValidation.errors);

    if (body.email && !this.validateEmail(body.email)) {
      errors.push('Invalid email format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate update password request
   */
  private validateUpdatePasswordRequest(body: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const requiredValidation = this.validateRequiredFields(body, [
      'token', 'newPassword'
    ]);
    errors.push(...requiredValidation.errors);

    const passwordValidation = this.validateStringField(
      body.newPassword,
      'newPassword',
      VALIDATION.MIN_PASSWORD_LENGTH,
      VALIDATION.MAX_PASSWORD_LENGTH
    );
    errors.push(...passwordValidation.errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract Bearer token from request
   */
  private extractBearerToken(req: Request): string | null {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7);
  }

  /**
   * Create user profile and credits
   */
  private async createUserProfileAndCredits(user: any, signUpRequest: SignUpRequest): Promise<void> {
    try {
      await Promise.all([
        this.supabaseService.createUserProfile(user.id, {
          email: signUpRequest.email,
          displayName: signUpRequest.displayName,
          department: signUpRequest.department
        }),
        this.supabaseService.createDefaultCredits(user.id, 'free_trial')
      ]);

      console.log('User profile and credits created for:', user.id);
    } catch (profileError) {
      this.logError(
        profileError instanceof Error ? profileError : new Error(String(profileError)),
        `Failed to create profile for user ${user.id}`
      );
      // Note: User is created in auth system, so we should still return success
    }
  }

  /**
   * Create approval request for user
   */
  private async createApprovalRequestForUser(user: any): Promise<void> {
    try {
      await this.supabaseService.createApprovalRequest({
        userId: user.id,
        requestType: 'user_creation',
        requestData: {
          email: user.email,
          verifiedAt: new Date().toISOString()
        },
        notes: 'User completed email verification and awaiting approval'
      });
    } catch (approvalError) {
      this.logError(
        approvalError instanceof Error ? approvalError : new Error(String(approvalError)),
        `Failed to create approval request for user ${user.id}`
      );
      // Continue with success response even if approval request fails
    }
  }

  /**
   * Format authentication response
   */
  private formatAuthResponse(authResult: AuthResponse, message: string): { data: any; message: string } {
    const data = {
      user: authResult.user,
      session: authResult.session
    };

    // Don't include full session data in registration response for security
    if (authResult.session) {
      data.session = {
        access_token: authResult.session.access_token,
        refresh_token: authResult.session.refresh_token,
        expires_in: authResult.session.expires_in,
        user: authResult.session.user
      };
    }

    return { data, message: authResult.message || message };
  }

  /**
   * Get user permissions based on role
   */
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