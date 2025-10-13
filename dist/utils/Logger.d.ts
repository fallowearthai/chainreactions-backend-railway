/**
 * Smart Logger Utility
 * Provides environment-aware logging with configurable levels
 */
export declare enum LogLevel {
    ERROR = 0,// Always log errors
    WARN = 1,// Important warnings
    INFO = 2,// General information
    DEBUG = 3,// Detailed debugging (development only)
    VERBOSE = 4
}
declare class Logger {
    private currentLevel;
    private isProduction;
    constructor();
    private shouldLog;
    private formatMessage;
    /**
     * Log error - always logged
     */
    error(message: string, error?: any): void;
    /**
     * Log warning - important issues
     */
    warn(message: string, meta?: any): void;
    /**
     * Log info - general information (limited in production)
     */
    info(message: string, meta?: any): void;
    /**
     * Log debug - detailed debugging (disabled in production by default)
     */
    debug(message: string, meta?: any): void;
    /**
     * Log verbose - very detailed (development only)
     */
    verbose(message: string, meta?: any): void;
    /**
     * Log API call - special format for API tracking
     */
    api(method: string, path: string, status: number, duration: number): void;
    /**
     * Log API call with minimal info (production-friendly)
     */
    apiMinimal(method: string, path: string, status: number): void;
    /**
     * Log success with emoji
     */
    success(message: string, meta?: any): void;
    /**
     * Check if production mode
     */
    isProductionMode(): boolean;
    /**
     * Get current log level name
     */
    getCurrentLevelName(): string;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=Logger.d.ts.map