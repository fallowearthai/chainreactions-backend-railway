"use strict";
/**
 * Smart Logger Utility
 * Provides environment-aware logging with configurable levels
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["VERBOSE"] = 4] = "VERBOSE"; // Very detailed logs (development only)
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        // Set log level based on environment
        this.isProduction = process.env.NODE_ENV === 'production';
        const configuredLevel = process.env.LOG_LEVEL?.toUpperCase();
        if (this.isProduction) {
            // Production: Only ERROR, WARN, and INFO by default
            this.currentLevel = configuredLevel === 'DEBUG' ? LogLevel.DEBUG : LogLevel.INFO;
        }
        else {
            // Development: All logs
            this.currentLevel = LogLevel.VERBOSE;
        }
        if (configuredLevel) {
            switch (configuredLevel) {
                case 'ERROR':
                    this.currentLevel = LogLevel.ERROR;
                    break;
                case 'WARN':
                    this.currentLevel = LogLevel.WARN;
                    break;
                case 'INFO':
                    this.currentLevel = LogLevel.INFO;
                    break;
                case 'DEBUG':
                    this.currentLevel = LogLevel.DEBUG;
                    break;
                case 'VERBOSE':
                    this.currentLevel = LogLevel.VERBOSE;
                    break;
            }
        }
    }
    shouldLog(level) {
        return level <= this.currentLevel;
    }
    formatMessage(level, message, meta) {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
    }
    /**
     * Log error - always logged
     */
    error(message, error) {
        if (this.shouldLog(LogLevel.ERROR)) {
            if (error) {
                console.error(`❌ ${message}`, error);
            }
            else {
                console.error(`❌ ${message}`);
            }
        }
    }
    /**
     * Log warning - important issues
     */
    warn(message, meta) {
        if (this.shouldLog(LogLevel.WARN)) {
            if (meta) {
                console.warn(`⚠️ ${message}`, meta);
            }
            else {
                console.warn(`⚠️ ${message}`);
            }
        }
    }
    /**
     * Log info - general information (limited in production)
     */
    info(message, meta) {
        if (this.shouldLog(LogLevel.INFO)) {
            if (meta) {
                console.log(`ℹ️ ${message}`, meta);
            }
            else {
                console.log(`ℹ️ ${message}`);
            }
        }
    }
    /**
     * Log debug - detailed debugging (disabled in production by default)
     */
    debug(message, meta) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            if (meta) {
                console.log(`🔍 ${message}`, meta);
            }
            else {
                console.log(`🔍 ${message}`);
            }
        }
    }
    /**
     * Log verbose - very detailed (development only)
     */
    verbose(message, meta) {
        if (this.shouldLog(LogLevel.VERBOSE)) {
            if (meta) {
                console.log(`🔬 ${message}`, meta);
            }
            else {
                console.log(`🔬 ${message}`);
            }
        }
    }
    /**
     * Log API call - special format for API tracking
     */
    api(method, path, status, duration) {
        if (this.shouldLog(LogLevel.INFO)) {
            const statusEmoji = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : '⚠️';
            console.log(`${statusEmoji} ${method} ${path} - ${status} (${duration}ms)`);
        }
    }
    /**
     * Log API call with minimal info (production-friendly)
     */
    apiMinimal(method, path, status) {
        if (this.shouldLog(LogLevel.INFO) && status >= 400) {
            // Only log errors in production
            console.log(`❌ ${method} ${path} - ${status}`);
        }
    }
    /**
     * Log success with emoji
     */
    success(message, meta) {
        if (this.shouldLog(LogLevel.INFO)) {
            if (meta) {
                console.log(`✅ ${message}`, meta);
            }
            else {
                console.log(`✅ ${message}`);
            }
        }
    }
    /**
     * Check if production mode
     */
    isProductionMode() {
        return this.isProduction;
    }
    /**
     * Get current log level name
     */
    getCurrentLevelName() {
        return LogLevel[this.currentLevel];
    }
}
// Export singleton instance
exports.logger = new Logger();
// Log startup configuration
if (!exports.logger.isProductionMode()) {
    console.log(`🔧 Logger initialized: ${exports.logger.getCurrentLevelName()} level`);
}
//# sourceMappingURL=Logger.js.map