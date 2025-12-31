import { Request, Response, NextFunction } from 'express';
import { SupabaseAuthService } from '../services/SupabaseAuthService';
import { SupabaseService } from '../services/SupabaseService';
import { SecurityContext } from '../types/AuthTypes';
import { UserProfile, UserRole } from '../types/UserTypes';
import { User } from '@supabase/supabase-js';

// Extend Request interface to include user context
declare global {
  namespace Express {
    interface Request {
      user?: SecurityContext;
      requestStartTime?: number;
    }
  }
}

export class AuthMiddleware {
  private static authService: SupabaseAuthService;
  private static supabaseService: SupabaseService;

  private static getAuthService(): SupabaseAuthService {
    if (!this.authService) {
      this.authService = SupabaseAuthService.getInstance();
    }
    return this.authService;
  }

  private static getSupabaseService(): SupabaseService {
    if (!this.supabaseService) {
      this.supabaseService = SupabaseService.getInstance();
    }
    return this.supabaseService;
  }

  // JWT Authentication Middleware
  static async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please provide a valid authorization token',
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Validate the token
      const tokenValidation = await AuthMiddleware.getAuthService().validateJWT(token);

      if (!tokenValidation.valid || !tokenValidation.user) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          message: 'Please authenticate again',
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }

      // Get user profile
      const profile = await AuthMiddleware.getSupabaseService().getUserProfile(tokenValidation.user.id);

      if (!profile) {
        res.status(401).json({
          success: false,
          error: 'User profile not found',
          message: 'User profile could not be found',
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }

      // Get user role
      const role = await AuthMiddleware.getSupabaseService().getUserRole(tokenValidation.user.id);

      // Get user permissions based on role
      const permissions = await AuthMiddleware.getUserPermissions(role?.role || 'user');

      // Create security context
      const securityContext: SecurityContext = {
        user: tokenValidation.user,
        profile,
        permissions,
        sessionId: AuthMiddleware.extractSessionId(req),
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown'
      };

      // Attach user context to request
      req.user = securityContext;

      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication error',
        message: 'An error occurred during authentication',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }

  // Lightweight JWT-only Authentication (no database calls)
  static async authenticateJWTOnly(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please provide a valid authorization token',
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Validate the token using lightweight JWT decode-only
      const tokenValidation = await AuthMiddleware.getAuthService().validateJWT(token);

      if (!tokenValidation.valid || !tokenValidation.user) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          message: 'Please authenticate again',
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }

      // Create minimal security context without database calls
      const securityContext: SecurityContext = {
        user: tokenValidation.user,
        profile: {
          id: tokenValidation.user.id,
          email: tokenValidation.user.email || '',
          firstName: tokenValidation.user.user_metadata?.firstName || '',
          lastName: tokenValidation.user.user_metadata?.lastName || '',
          avatarUrl: tokenValidation.user.user_metadata?.avatar_url || '',
          company: tokenValidation.user.user_metadata?.company || '',
          department: tokenValidation.user.user_metadata?.department || '',
          role: tokenValidation.user.app_metadata?.role || 'user',
          emailVerified: !!tokenValidation.user.email_confirmed_at,
          createdAt: tokenValidation.user.created_at,
          updatedAt: tokenValidation.user.updated_at || tokenValidation.user.created_at
        } as any,
        permissions: AuthMiddleware.getUserPermissions(tokenValidation.user.app_metadata?.role || 'user'),
        sessionId: AuthMiddleware.extractSessionId(req),
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown'
      };

      // Attach user context to request
      req.user = securityContext;

      next();
    } catch (error) {
      console.error('JWT authentication middleware error:', error);
      res.status(401).json({
        success: false,
        error: 'Authentication error',
        message: 'An error occurred during authentication',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }

  // Optional Authentication (doesn't fail if no token)
  static async optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided, continue without user context
        next();
        return;
      }

      const token = authHeader.substring(7);

      // Validate the token
      const tokenValidation = await AuthMiddleware.getAuthService().validateJWT(token);

      if (!tokenValidation.valid || !tokenValidation.user) {
        // Invalid token, continue without user context
        next();
        return;
      }

      // Get user profile
      const profile = await AuthMiddleware.getSupabaseService().getUserProfile(tokenValidation.user.id);

      if (!profile) {
        // No profile found, continue without user context
        next();
        return;
      }

      // Get user role
      const role = await AuthMiddleware.getSupabaseService().getUserRole(tokenValidation.user.id);

      // Get user permissions
      const permissions = await AuthMiddleware.getUserPermissions(role?.role || 'user');

      // Create security context
      const securityContext: SecurityContext = {
        user: tokenValidation.user,
        profile,
        permissions,
        sessionId: AuthMiddleware.extractSessionId(req),
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown'
      };

      // Attach user context to request
      req.user = securityContext;

      next();
    } catch (error) {
      console.error('Optional authentication middleware error:', error);
      // Continue without user context on error
      next();
    }
  }

  // Admin-only Middleware
  static async requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // First authenticate
      await AuthMiddleware.authenticate(req, res, () => {});

      // Check if user is authenticated
      if (!req.user) {
        return; // authenticate already sent response
      }

      // Check if user has admin role
      const hasAdminPermission = req.user.permissions.includes('admin');

      if (!hasAdminPermission) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: 'Admin access required',
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Admin middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Authorization error',
        message: 'An error occurred during authorization',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }

  // Approved User Only Middleware
  static async requireApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // First authenticate
      await AuthMiddleware.authenticate(req, res, () => {});

      // Check if user is authenticated
      if (!req.user) {
        return; // authenticate already sent response
      }

      
      next();
    } catch (error) {
      console.error('Approval middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Authorization error',
        message: 'An error occurred during authorization',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }

  // Permission-based Middleware
  static requirePermission(permission: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // First authenticate
        await AuthMiddleware.authenticate(req, res, () => {});

        // Check if user is authenticated
        if (!req.user) {
          return; // authenticate already sent response
        }

        // Check if user has the required permission
        if (!req.user.permissions.includes(permission)) {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            message: `Permission '${permission}' required`,
            timestamp: new Date().toISOString(),
            path: req.path
          });
          return;
        }

        next();
      } catch (error) {
        console.error(`Permission middleware error (${permission}):`, error);
        res.status(500).json({
          success: false,
          error: 'Authorization error',
          message: 'An error occurred during authorization',
          timestamp: new Date().toISOString(),
          path: req.path
        });
      }
    };
  }

  // Service-to-Service Authentication Middleware
  static async authenticateService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const serviceToken = req.headers['x-service-token'] as string;

      if (!serviceToken) {
        res.status(401).json({
          success: false,
          error: 'Service authentication required',
          message: 'Please provide a valid service token',
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }

      // For service-to-service communication, we'll implement a simple token validation
      // In production, this should be replaced with proper JWT validation or API keys
      const validServiceTokens = process.env.VALID_SERVICE_TOKENS?.split(',') || [];

      if (!validServiceTokens.includes(serviceToken)) {
        res.status(401).json({
          success: false,
          error: 'Invalid service token',
          message: 'The provided service token is not valid',
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }

      // Add service context to request
      req.user = {
        user: {
          id: 'service',
          email: 'service@chainreactions.ai',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_metadata: { service: true },
          app_metadata: {},
          aud: 'service'
        } as unknown as User,
        profile: {
          id: 'service',
          email: 'service@chainreactions.ai',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as UserProfile,
        permissions: ['service'],
        sessionId: 'service',
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'service'
      };

      next();
    } catch (error) {
      console.error('Service authentication middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Service authentication error',
        message: 'An error occurred during service authentication',
        timestamp: new Date().toISOString(),
        path: req.path
      });
    }
  }

  // Helper Methods
  private static getUserPermissions(role: string): string[] {
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

  private static extractSessionId(req: Request): string {
    // Try to extract session ID from various sources
    return req.get('X-Session-ID') ||
           req.cookies?.session_id ||
           req.query.session_id as string ||
           'unknown';
  }

  // User extraction helper for controllers
  static extractUser(req: Request): SecurityContext {
    if (!req.user) {
      throw new Error('User not authenticated');
    }
    return req.user;
  }

  // Extract user ID helper
  static extractUserId(req: Request): string {
    const user = AuthMiddleware.extractUser(req);
    return user.user.id;
  }

  // Check if user is admin helper
  static isAdmin(req: Request): boolean {
    if (!req.user) return false;
    return req.user.permissions.includes('admin');
  }
}

// Export commonly used middleware functions
export const authenticate = AuthMiddleware.authenticate;
export const optionalAuth = AuthMiddleware.optionalAuth;
export const requireAdmin = AuthMiddleware.requireAdmin;
export const requirePermission = AuthMiddleware.requirePermission;
export const authenticateService = AuthMiddleware.authenticateService;