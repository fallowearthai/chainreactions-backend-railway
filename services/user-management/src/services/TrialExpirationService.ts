import { SupabaseService } from './SupabaseService';

export class TrialExpirationService {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Check and expire all trials that have ended
   * This should be called daily (preferably at midnight)
   */
  async checkAndExpireTrials(): Promise<{ expired: number; message: string }> {
    try {
      // Call the database function to expire trials
      const { data, error } = await this.supabaseService.getClient()
        .rpc('check_and_expire_trials');

      if (error) {
        throw new Error(`Failed to check trials: ${error.message}`);
      }

      const expiredCount = data || 0;

      // Log the result
      console.log(`Trial expiration check completed. Expired ${expiredCount} trials.`);

      return {
        expired: expiredCount,
        message: `Successfully expired ${expiredCount} trial(s)`
      };
    } catch (error) {
      console.error('Trial expiration service error:', error);
      return {
        expired: 0,
        message: `Error during trial expiration: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get trials that will expire in the next N days
   * @param days Number of days to look ahead
   */
  async getTrialsExpiringSoon(days: number = 3): Promise<any[]> {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('user_usage_credits')
        .select(`
          user_id,
          account_type,
          trial_start_date,
          trial_end_date,
          ordinary_search_credits,
          long_search_credits
        `)
        .eq('account_type', 'free_trial')
        .eq('is_active', true)
        .gte('trial_end_date', new Date().toISOString())
        .lte('trial_end_date', new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        throw new Error(`Failed to get expiring trials: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error getting expiring trials:', error);
      return [];
    }
  }

  /**
   * Get current trial status for a specific user
   */
  async getUserTrialStatus(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('user_usage_credits')
        .select(`
          account_type,
          trial_start_date,
          trial_end_date,
          is_active,
          ordinary_search_credits,
          long_search_credits,
          CASE
            WHEN trial_end_date IS NOT NULL AND trial_end_date < NOW() THEN 'expired'
            WHEN trial_end_date IS NOT NULL AND trial_end_date >= NOW() THEN 'active'
            ELSE 'no_trial'
          END as trial_status
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        throw new Error(`Failed to get user trial status: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error getting user trial status:', error);
      return null;
    }
  }
}