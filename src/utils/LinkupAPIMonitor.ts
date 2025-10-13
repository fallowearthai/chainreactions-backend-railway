/**
 * Linkup API Monitor
 * Tracks API calls to prevent unexpected credit consumption
 */

interface APICallRecord {
  timestamp: number;
  endpoint: string;
  source: string;
  success: boolean;
}

class LinkupAPIMonitor {
  private calls: APICallRecord[] = [];
  private hourlyLimit: number;
  private dailyLimit: number;
  private warningThreshold: number = 0.8; // Warn at 80% of limit

  constructor(hourlyLimit: number = 100, dailyLimit: number = 1000) {
    this.hourlyLimit = hourlyLimit;
    this.dailyLimit = dailyLimit;

    // Clean up old records every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Remove records older than 24 hours
   */
  private cleanup(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    this.calls = this.calls.filter(call => call.timestamp > cutoff);
    console.log(`🧹 Cleaned up old API call records. Current count: ${this.calls.length}`);
  }

  /**
   * Record an API call
   */
  recordCall(endpoint: string, source: string, success: boolean = true): void {
    const call: APICallRecord = {
      timestamp: Date.now(),
      endpoint,
      source,
      success
    };

    this.calls.push(call);

    // Log the call
    console.log(`📊 Linkup API Call: ${source} -> ${endpoint} (${success ? 'success' : 'failed'})`);

    // Check if approaching limits
    this.checkLimits();
  }

  /**
   * Check if approaching or exceeding limits
   */
  private checkLimits(): void {
    const stats = this.getStats();

    // Check hourly limit
    if (stats.hourly.count >= this.hourlyLimit) {
      console.error(`🚨 CRITICAL: Hourly Linkup API limit exceeded! ${stats.hourly.count}/${this.hourlyLimit}`);
    } else if (stats.hourly.count >= this.hourlyLimit * this.warningThreshold) {
      console.warn(`⚠️ WARNING: Approaching hourly Linkup API limit. ${stats.hourly.count}/${this.hourlyLimit}`);
    }

    // Check daily limit
    if (stats.daily.count >= this.dailyLimit) {
      console.error(`🚨 CRITICAL: Daily Linkup API limit exceeded! ${stats.daily.count}/${this.dailyLimit}`);
    } else if (stats.daily.count >= this.dailyLimit * this.warningThreshold) {
      console.warn(`⚠️ WARNING: Approaching daily Linkup API limit. ${stats.daily.count}/${this.dailyLimit}`);
    }
  }

  /**
   * Get call statistics
   */
  getStats(): {
    hourly: { count: number; limit: number; percentage: number };
    daily: { count: number; limit: number; percentage: number };
    recentCalls: { endpoint: string; source: string; time: string }[];
    bySource: Record<string, number>;
    byEndpoint: Record<string, number>;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Filter calls
    const hourlyCalls = this.calls.filter(call => call.timestamp > oneHourAgo);
    const dailyCalls = this.calls.filter(call => call.timestamp > oneDayAgo);

    // Count by source
    const bySource: Record<string, number> = {};
    for (const call of dailyCalls) {
      bySource[call.source] = (bySource[call.source] || 0) + 1;
    }

    // Count by endpoint
    const byEndpoint: Record<string, number> = {};
    for (const call of dailyCalls) {
      byEndpoint[call.endpoint] = (byEndpoint[call.endpoint] || 0) + 1;
    }

    // Recent calls (last 10)
    const recentCalls = this.calls
      .slice(-10)
      .reverse()
      .map(call => ({
        endpoint: call.endpoint,
        source: call.source,
        time: new Date(call.timestamp).toISOString()
      }));

    return {
      hourly: {
        count: hourlyCalls.length,
        limit: this.hourlyLimit,
        percentage: Math.round((hourlyCalls.length / this.hourlyLimit) * 100)
      },
      daily: {
        count: dailyCalls.length,
        limit: this.dailyLimit,
        percentage: Math.round((dailyCalls.length / this.dailyLimit) * 100)
      },
      recentCalls,
      bySource,
      byEndpoint
    };
  }

  /**
   * Check if can make another call (soft check)
   */
  canMakeCall(): { allowed: boolean; reason?: string } {
    const stats = this.getStats();

    if (stats.hourly.count >= this.hourlyLimit) {
      return {
        allowed: false,
        reason: `Hourly limit exceeded: ${stats.hourly.count}/${this.hourlyLimit}`
      };
    }

    if (stats.daily.count >= this.dailyLimit) {
      return {
        allowed: false,
        reason: `Daily limit exceeded: ${stats.daily.count}/${this.dailyLimit}`
      };
    }

    return { allowed: true };
  }

  /**
   * Get formatted summary for logging
   */
  getSummary(): string {
    const stats = this.getStats();
    return `Linkup API Usage - Hourly: ${stats.hourly.count}/${stats.hourly.limit} (${stats.hourly.percentage}%) | Daily: ${stats.daily.count}/${stats.daily.limit} (${stats.daily.percentage}%)`;
  }
}

// Create singleton instance
// Configure via environment variables
const hourlyLimit = parseInt(process.env.LINKUP_API_HOURLY_LIMIT || '100', 10);
const dailyLimit = parseInt(process.env.LINKUP_API_DAILY_LIMIT || '1000', 10);

export const linkupAPIMonitor = new LinkupAPIMonitor(hourlyLimit, dailyLimit);

// Log summary every hour
setInterval(() => {
  console.log(`📊 ${linkupAPIMonitor.getSummary()}`);
}, 3600000);
