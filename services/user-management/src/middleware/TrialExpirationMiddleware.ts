import { Request, Response, NextFunction } from 'express';
import { SupabaseService } from '../services/SupabaseService';

export class TrialExpirationMiddleware {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  // Check and auto-expire trials on user requests
  checkTrialExpiration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return next();
      }

      // Get user's trial info
      const { data: userCredits, error } = await this.supabaseService.getClient()
        .from('user_usage_credits')
        .select('account_type, trial_end_date, is_active, ordinary_search_credits, long_search_credits')
        .eq('user_id', userId)
        .single();

      if (error || !userCredits) {
        return next();
      }

      // Check if user has expired trial and is still active
      if (
        userCredits.account_type === 'free_trial' &&
        userCredits.trial_end_date &&
        new Date(userCredits.trial_end_date) < new Date() &&
        userCredits.is_active
      ) {
        // Auto-expire the trial
        await this.expireTrial(userId);

        // Update request data to reflect expired status
        req.headers['x-trial-expired'] = 'true';
      }

      next();
    } catch (error) {
      console.error('Trial expiration check failed:', error);
      next();
    }
  };

  private async expireTrial(userId: string): Promise<void> {
    try {
      await this.supabaseService.getClient()
        .from('user_usage_credits')
        .update({
          ordinary_search_credits: 0,
          long_search_credits: 0,
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      console.log(`Auto-expired trial for user: ${userId}`);
    } catch (error) {
      console.error(`Failed to expire trial for user ${userId}:`, error);
    }
  }

  // Middleware to block expired trial users from accessing paid features
  blockExpiredTrials = (req: Request, res: Response, next: NextFunction) => {
    const isTrialExpired = req.headers['x-trial-expired'] === 'true';

    if (isTrialExpired) {
      return res.status(403).json({
        success: false,
        error: 'Your free trial has expired. Please upgrade your account to continue using our services.',
        code: 'TRIAL_EXPIRED'
      });
    }

    next();
  };
}