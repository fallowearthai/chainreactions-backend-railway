/**
 * Linkup API Monitor
 * Tracks API calls to prevent unexpected credit consumption
 */
declare class LinkupAPIMonitor {
    private calls;
    private hourlyLimit;
    private dailyLimit;
    private warningThreshold;
    constructor(hourlyLimit?: number, dailyLimit?: number);
    /**
     * Remove records older than 24 hours
     */
    private cleanup;
    /**
     * Record an API call
     */
    recordCall(endpoint: string, source: string, success?: boolean): void;
    /**
     * Check if approaching or exceeding limits
     */
    private checkLimits;
    /**
     * Get call statistics
     */
    getStats(): {
        hourly: {
            count: number;
            limit: number;
            percentage: number;
        };
        daily: {
            count: number;
            limit: number;
            percentage: number;
        };
        recentCalls: {
            endpoint: string;
            source: string;
            time: string;
        }[];
        bySource: Record<string, number>;
        byEndpoint: Record<string, number>;
    };
    /**
     * Check if can make another call (soft check)
     */
    canMakeCall(): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Get formatted summary for logging
     */
    getSummary(): string;
}
export declare const linkupAPIMonitor: LinkupAPIMonitor;
export {};
//# sourceMappingURL=LinkupAPIMonitor.d.ts.map