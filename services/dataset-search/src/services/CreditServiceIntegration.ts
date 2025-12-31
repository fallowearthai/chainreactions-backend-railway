/**
 * Credit Service Integration for Dataset Search
 * Handles communication with User Management service for credit operations
 */

export interface CreditCheckRequest {
  user_id: string;
  creditType: 'long_search';
}

export interface CreditCheckResponse {
  success: boolean;
  hasCredits: boolean;
  remainingCredits?: number;
  error?: string;
}

export interface CreditDeductRequest {
  user_id: string;
  creditType: 'long_search';
  amount: number;
  searchDetails: {
    search_type: string;
    query?: string;
    reason?: string;
    timestamp: string;
  };
}

export interface CreditDeductResponse {
  success: boolean;
  remainingCredits?: number;
  error?: string;
}

export class CreditServiceIntegration {
  private userManagementBaseUrl: string;
  private authToken: string;

  constructor(authToken?: string) {
    // User Management service runs on port 3007
    this.userManagementBaseUrl = process.env.USER_MANAGEMENT_URL || 'http://localhost:3007';
    this.authToken = authToken || '';
  }

  /**
   * Set authentication token for service requests
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Check if user has sufficient credits for dataset search
   */
  async checkCredits(userId: string): Promise<CreditCheckResponse> {
    try {
      const headers: { [key: string]: string } = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if token is available
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${this.userManagementBaseUrl}/api/credits/validate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          transactionType: 'long_search',
          amount: 1
        })
      });

      if (!response.ok) {
        throw new Error(`Credit check failed with status ${response.status}`);
      }

      const result = await response.json() as any;
      // The response has format: { success: true, data: { hasCredits, ... } }
      // We need to extract the data field and map it to CreditCheckResponse
      return {
        success: result.success,
        hasCredits: result.data?.hasCredits ?? result.data?.hasEnoughCredits ?? false,
        remainingCredits: result.data?.remainingCredits?.long_search,
        error: result.success ? undefined : result.error
      } as CreditCheckResponse;
    } catch (error) {
      console.error('Error checking credits:', error);
      return {
        success: false,
        hasCredits: false,
        error: error instanceof Error ? error.message : 'Credit check failed'
      };
    }
  }

  /**
   * Deduct credits for dataset search
   */
  async deductCredits(
    userId: string,
    searchType: string = 'dataset_search',
    query?: string,
    reason: string = 'search_completion'
  ): Promise<CreditDeductResponse> {
    try {
      const headers: { [key: string]: string } = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if token is available
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${this.userManagementBaseUrl}/api/credits/deduct`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          creditType: 'long_search',
          amount: 1,
          searchDetails: {
            search_type: searchType,
            query: query,
            reason: reason,
            timestamp: new Date().toISOString()
          }
        } as CreditDeductRequest)
      });

      if (!response.ok) {
        throw new Error(`Credit deduction failed with status ${response.status}`);
      }

      const result = await response.json();
      return result as CreditDeductResponse;
    } catch (error) {
      console.error('Error deducting credits:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Credit deduction failed'
      };
    }
  }

  /**
   * Get current credit status for user
   */
  async getCreditStatus(userId: string): Promise<CreditCheckResponse> {
    try {
      const response = await fetch(`${this.userManagementBaseUrl}/api/credits/status/${userId}`);

      if (!response.ok) {
        throw new Error(`Credit status check failed with status ${response.status}`);
      }

      const result = await response.json() as any;
      return {
        success: true,
        hasCredits: result.hasCredits || result.remainingCredits > 0,
        remainingCredits: result.remainingCredits
      };
    } catch (error) {
      console.error('Error getting credit status:', error);
      return {
        success: false,
        hasCredits: false,
        error: error instanceof Error ? error.message : 'Credit status check failed'
      };
    }
  }
}