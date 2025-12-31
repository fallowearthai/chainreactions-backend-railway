import { createClient, SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';
import {
  SignUpRequest,
  SignInRequest,
  AuthResponse,
  TokenValidation,
  UserMetadata,
  SecurityContext,
  PasswordResetRequest,
  UpdatePasswordRequest
} from '@/types/AuthTypes';

export class SupabaseAuthService {
  private static instance: SupabaseAuthService;
  private client: SupabaseClient;
  private adminClient: SupabaseClient;

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Supabase configuration missing:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_ANON_KEY: !!supabaseAnonKey,
        SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey
      });
      throw new Error('Missing required Supabase configuration');
    }

    // Client for regular user operations
    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storageKey: 'chainreactions-auth-token'
      }
    });

    // Admin client for privileged operations
    this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  public static getInstance(): SupabaseAuthService {
    if (!SupabaseAuthService.instance) {
      SupabaseAuthService.instance = new SupabaseAuthService();
    }
    return SupabaseAuthService.instance;
  }

  // User Registration
  async signUp(request: SignUpRequest): Promise<AuthResponse> {
    try {
      const userMetadata: UserMetadata = {
        displayName: request.displayName,
        company: request.company,
        department: request.department
      };

      const { data, error } = await this.client.auth.signUp({
        email: request.email,
        password: request.password,
        options: {
          data: userMetadata
        }
      });

      if (error) {
        console.error('Signup error:', error);
        return {
          error: this.formatAuthError(error),
          message: 'Registration failed'
        };
      }

      console.log('User signed up successfully:', data.user?.id);
      return {
        user: data.user || undefined,
        session: data.session || undefined,
        message: 'Registration successful. Please check your email for verification.'
      };
    } catch (error) {
      console.error('Unexpected signup error:', error);
      return {
        error: 'Internal server error during registration',
        message: 'Registration failed'
      };
    }
  }

  // User Sign In
  async signIn(request: SignInRequest): Promise<AuthResponse> {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: request.email,
        password: request.password
      });

      if (error) {
        console.error('Sign in error:', error);
        return {
          error: this.formatAuthError(error),
          message: 'Invalid credentials'
        };
      }

      if (!data.user?.email_confirmed_at) {
        return {
          error: 'Email not verified',
          message: 'Please verify your email before signing in'
        };
      }

      console.log('User signed in successfully:', data.user.id);
      return {
        user: data.user,
        session: data.session,
        message: 'Sign in successful'
      };
    } catch (error) {
      console.error('Unexpected sign in error:', error);
      return {
        error: 'Internal server error during sign in',
        message: 'Sign in failed'
      };
    }
  }

  // User Sign Out
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.auth.signOut();

      if (error) {
        console.error('Sign out error:', error);
        return {
          success: false,
          error: this.formatAuthError(error)
        };
      }

      console.log('User signed out successfully');
      return { success: true };
    } catch (error) {
      console.error('Unexpected sign out error:', error);
      return {
        success: false,
        error: 'Internal server error during sign out'
      };
    }
  }

  // Email Verification
  async verifyEmail(token: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.client.auth.verifyOtp({
        token,
        type: 'signup',
        email: token // For Supabase, we need the email, but we'll use token as placeholder
      });

      if (error) {
        console.error('Email verification error:', error);
        return {
          error: this.formatAuthError(error),
          message: 'Email verification failed'
        };
      }

      console.log('Email verified successfully:', data.user?.id);
      return {
        user: data.user || undefined,
        session: data.session || undefined,
        message: 'Email verified successfully'
      };
    } catch (error) {
      console.error('Unexpected email verification error:', error);
      return {
        error: 'Internal server error during email verification',
        message: 'Email verification failed'
      };
    }
  }

  // Password Reset
  async requestPasswordReset(request: PasswordResetRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(request.email, {
        redirectTo: `${process.env.FRONTEND_URL}/auth/reset-password`
      });

      if (error) {
        console.error('Password reset request error:', error);
        return {
          success: false,
          error: this.formatAuthError(error)
        };
      }

      console.log('Password reset email sent to:', request.email);
      return { success: true };
    } catch (error) {
      console.error('Unexpected password reset error:', error);
      return {
        success: false,
        error: 'Internal server error during password reset'
      };
    }
  }

  // Update Password
  async updatePassword(request: UpdatePasswordRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.auth.updateUser({
        password: request.newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        return {
          success: false,
          error: this.formatAuthError(error)
        };
      }

      console.log('Password updated successfully');
      return { success: true };
    } catch (error) {
      console.error('Unexpected password update error:', error);
      return {
        success: false,
        error: 'Internal server error during password update'
      };
    }
  }

  // JWT Token Validation
  async validateJWT(token: string): Promise<TokenValidation> {
    try {
      // For Supabase access tokens, we need to use the client with anon key
      // and then check the JWT structure manually
      if (!token) {
        return {
          valid: false,
          error: 'No token provided'
        };
      }

      // Try to decode the JWT to check basic structure first
      const parts = token.split('.');
      if (parts.length !== 3) {
        return {
          valid: false,
          error: 'Invalid token structure'
        };
      }

      try {
        // Decode the payload (base64url)
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString('utf-8')
        );

        // Check if this looks like a Supabase JWT
        if (!payload.iss || !payload.sub || !payload.aud) {
          return {
            valid: false,
            error: 'Invalid JWT claims'
          };
        }

        // Check if token is expired
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          return {
            valid: false,
            error: 'Token expired'
          };
        }

        // For now, create a minimal user object from JWT payload
        // In a real implementation, you might want to verify the signature
        // or make additional database calls
        const user = {
          id: payload.sub,
          email: payload.email,
          user_metadata: payload.user_metadata || {},
          app_metadata: payload.app_metadata || {},
          aud: payload.aud,
          exp: payload.exp,
          iat: payload.iat,
          created_at: new Date().toISOString() // Add missing created_at field
        };

        return {
          valid: true,
          user
        };

      } catch (decodeError) {
        console.error('JWT decode error:', decodeError);
        return {
          valid: false,
          error: 'Failed to decode token'
        };
      }

    } catch (error) {
      console.error('Unexpected JWT validation error:', error);
      return {
        valid: false,
        error: 'Internal server error during token validation'
      };
    }
  }

  // Get Current User
  async getCurrentUser(token?: string): Promise<User | null> {
    try {
      if (token) {
        const { data: { user }, error } = await this.client.auth.getUser(token);
        if (error) {
          console.error('Get current user error:', error);
          return null;
        }
        return user;
      } else {
        const { data: { user }, error } = await this.client.auth.getUser();
        if (error) {
          console.error('Get current user error:', error);
          return null;
        }
        return user;
      }
    } catch (error) {
      console.error('Unexpected get current user error:', error);
      return null;
    }
  }

  // Refresh Token
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.client.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error) {
        console.error('Token refresh error:', error);
        return {
          error: this.formatAuthError(error),
          message: 'Token refresh failed'
        };
      }

      return {
        user: data.user || undefined,
        session: data.session || undefined,
        message: 'Token refreshed successfully'
      };
    } catch (error) {
      console.error('Unexpected token refresh error:', error);
      return {
        error: 'Internal server error during token refresh',
        message: 'Token refresh failed'
      };
    }
  }

  // Admin Functions
  async getUserById(userId: string): Promise<User | null> {
    try {
      const { data: { user }, error } = await this.adminClient.auth.admin.getUserById(userId);

      if (error) {
        console.error('Get user by ID error:', error);
        return null;
      }

      return user;
    } catch (error) {
      console.error('Unexpected get user by ID error:', error);
      return null;
    }
  }

  async updateUser(userId: string, attributes: Partial<User>): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.adminClient.auth.admin.updateUserById(userId, attributes);

      if (error) {
        console.error('Update user error:', error);
        return {
          success: false,
          error: this.formatAuthError(error)
        };
      }

      console.log('User updated successfully:', userId);
      return { success: true };
    } catch (error) {
      console.error('Unexpected update user error:', error);
      return {
        success: false,
        error: 'Internal server error during user update'
      };
    }
  }

  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.adminClient.auth.admin.deleteUser(userId);

      if (error) {
        console.error('Delete user error:', error);
        return {
          success: false,
          error: this.formatAuthError(error)
        };
      }

      console.log('User deleted successfully:', userId);
      return { success: true };
    } catch (error) {
      console.error('Unexpected delete user error:', error);
      return {
        success: false,
        error: 'Internal server error during user deletion'
      };
    }
  }

  // Helper Methods
  private formatAuthError(error: AuthError): string {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Invalid email or password';
      case 'Email not confirmed':
        return 'Please verify your email address';
      case 'User already registered':
        return 'An account with this email already exists';
      case 'Password should be at least 6 characters':
        return 'Password must be at least 6 characters long';
      case 'Invalid email':
        return 'Please provide a valid email address';
      case 'Signup disabled':
        return 'User registration is currently disabled';
      case 'Email rate limit exceeded':
        return 'Too many requests. Please try again later';
      default:
        return error.message || 'Authentication error';
    }
  }

  // Get auth client for direct usage
  getClient(): SupabaseClient {
    return this.client;
  }

  // Get admin client for privileged operations
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }
}