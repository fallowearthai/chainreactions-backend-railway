import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Extend Request interface to include user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        user_metadata?: any;
        app_metadata?: any;
      };
    }
  }
}

export class AuthMiddleware {
  private static supabase: SupabaseClient;

  private static getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required for authentication');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
    return this.supabase;
  }

  /**
   * JWT Authentication Middleware for Dataset Search Service
   * Validates JWT token and extracts user information
   */
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

      // Validate the JWT token using Supabase
      const { data: { user }, error } = await AuthMiddleware.getSupabaseClient().auth.getUser(token);

      if (error || !user) {
        console.error('JWT validation error:', error);
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          message: 'Please authenticate again',
          timestamp: new Date().toISOString(),
          path: req.path
        });
        return;
      }

      // Attach user context to request
      req.user = {
        id: user.id,
        email: user.email || '',
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata
      };

      console.log(`✅ User authenticated: ${user.email} (${user.id})`);
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

  /**
   * Extract user ID from authenticated request
   */
  static extractUserId(req: Request): string {
    if (!req.user) {
      throw new Error('User not authenticated');
    }
    return req.user.id;
  }

  /**
   * Extract user email from authenticated request
   */
  static extractUserEmail(req: Request): string {
    if (!req.user) {
      throw new Error('User not authenticated');
    }
    return req.user.email;
  }

  /**
   * Check if user has admin role
   */
  static isAdmin(req: Request): boolean {
    if (!req.user) return false;
    return req.user.app_metadata?.role === 'admin' ||
           req.user.user_metadata?.isAdmin === true ||
           req.user.email?.includes('admin');
  }

  /**
   * Admin-only middleware
   */
  static async requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // First authenticate
      await AuthMiddleware.authenticate(req, res, () => {});

      // Check if user is authenticated
      if (!req.user) {
        return; // authenticate already sent response
      }

      // Check if user has admin role
      if (!AuthMiddleware.isAdmin(req)) {
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
}

// Export commonly used middleware functions
export const authenticate = AuthMiddleware.authenticate;
export const requireAdmin = AuthMiddleware.requireAdmin;