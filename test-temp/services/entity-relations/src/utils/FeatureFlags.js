"use strict";
/**
 * Feature Flag Management for Enhanced Grounding
 *
 * This utility provides centralized control over the enhanced grounding functionality,
 * enabling gradual rollout and instant rollback capabilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlags = void 0;
class FeatureFlags {
    /**
     * Set current request context for consistent rollout decisions
     */
    static setCurrentRequest(request) {
        this.currentRequest = request;
    }
    /**
     * Check if enhanced grounding should be used for current request
     */
    static shouldUseEnhancedGrounding() {
        const config = this.config;
        // Feature flag completely disabled
        if (!config.enabled) {
            return false;
        }
        // 100% rollout - enabled for all requests
        if (config.rolloutPercentage >= 100) {
            return true;
        }
        // 0% rollout - disabled for all requests
        if (config.rolloutPercentage <= 0) {
            return false;
        }
        // Percentage-based rollout using request hash
        const hash = this.hashRequest(this.currentRequest);
        return (hash % 100) < config.rolloutPercentage;
    }
    /**
     * Get current grounding configuration
     */
    static getGroundingConfig() {
        return { ...this.config };
    }
    /**
     * Update grounding configuration (for runtime changes)
     */
    static updateGroundingConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.logFeatureFlagChange('Configuration updated', updates);
    }
    /**
     * Check if logging is enabled for the given level
     */
    static shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.config.logLevel);
        const checkLevelIndex = levels.indexOf(level);
        return checkLevelIndex >= currentLevelIndex;
    }
    /**
     * Log grounding-related messages with level checking
     */
    static log(message, level = 'info', data) {
        if (this.shouldLog(level)) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [Enhanced Grounding] [${level.toUpperCase()}]`;
            if (data) {
                console.log(`${prefix} ${message}`, data);
            }
            else {
                console.log(`${prefix} ${message}`);
            }
        }
    }
    /**
     * Calculate grounding quality metrics
     */
    static calculateGroundingMetrics(groundingChunks, groundingSupports, executionTimeMs) {
        const groundingChunksCount = groundingChunks.length;
        const groundingSupportsCount = groundingSupports.length;
        // Calculate evidence coverage percentage
        const totalPossibleSupports = Math.min(groundingChunksCount * 3, this.config.maxChunks * 3);
        const evidenceCoveragePercentage = totalPossibleSupports > 0
            ? Math.min((groundingSupportsCount / totalPossibleSupports) * 100, 100)
            : 0;
        // Calculate source quality score (based on domain authority)
        const sourceQualityScore = this.calculateSourceQualityScore(groundingChunks);
        // Calculate average confidence score
        const confidenceScores = groundingSupports
            .map(support => support.confidenceScore || 0)
            .filter(score => score > 0);
        const averageConfidenceScore = confidenceScores.length > 0
            ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
            : 0;
        return {
            groundingChunksCount,
            groundingSupportsCount,
            evidenceCoveragePercentage,
            sourceQualityScore,
            averageConfidenceScore,
            executionTimeMs
        };
    }
    /**
     * Log grounding metrics for monitoring
     */
    static logGroundingMetrics(metrics, requestContext) {
        this.log('Grounding metrics calculated', 'info', {
            metrics,
            request: {
                institution: requestContext.Target_institution,
                riskEntity: requestContext.Risk_Entity,
                location: requestContext.Location
            }
        });
    }
    /**
     * Check if grounding metrics meet quality thresholds
     */
    static meetsQualityThresholds(metrics) {
        return (metrics.groundingChunksCount >= 5 && // At least 5 grounding chunks
            metrics.evidenceCoveragePercentage >= 50 && // At least 50% coverage
            metrics.sourceQualityScore >= this.config.confidenceThreshold && // Meet confidence threshold
            metrics.executionTimeMs <= 60000 // Under 60 seconds
        );
    }
    /**
     * Generate hash from request for consistent rollout decisions
     */
    static hashRequest(request) {
        if (!request)
            return 0;
        const str = JSON.stringify({
            institution: request.Target_institution,
            riskEntity: request.Risk_Entity,
            location: request.Location,
            timestamp: new Date().toDateString() // Consistent within a day
        });
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    /**
     * Calculate source quality score based on domain authority
     */
    static calculateSourceQualityScore(groundingChunks) {
        if (groundingChunks.length === 0)
            return 0;
        const domainScores = groundingChunks.map(chunk => {
            const uri = chunk.web?.uri || '';
            if (uri.includes('.edu'))
                return 1.0; // Academic: highest quality
            if (uri.includes('.gov'))
                return 0.95; // Government: very high quality
            if (uri.includes('.org'))
                return 0.8; // Organizations: high quality
            if (uri.includes('news.') || uri.includes('.news'))
                return 0.75; // News: good quality
            if (uri.includes('.com'))
                return 0.6; // Commercial: medium quality
            return 0.4; // Other: lower quality
        });
        const totalScore = domainScores.reduce((sum, score) => sum + score, 0);
        return totalScore / domainScores.length;
    }
    /**
     * Log feature flag changes for audit trail
     */
    static logFeatureFlagChange(action, details) {
        this.log(`Feature flag change: ${action}`, 'info', {
            action,
            details,
            timestamp: new Date().toISOString(),
            config: this.config
        });
    }
    /**
     * Get feature flag status for health checks
     */
    static getFeatureFlagStatus() {
        return {
            enhanced_grounding: {
                enabled: this.config.enabled,
                rollout_percentage: this.config.rolloutPercentage,
                confidence_threshold: this.config.confidenceThreshold,
                max_chunks: this.config.maxChunks,
                max_sources: this.config.maxSources,
                log_level: this.config.logLevel
            }
        };
    }
    /**
     * Emergency disable function for instant rollback
     */
    static emergencyDisable() {
        this.updateGroundingConfig({ enabled: false, rolloutPercentage: 0 });
        this.log('EMERGENCY: Enhanced grounding disabled', 'warn');
    }
    /**
     * Enable enhanced grounding for testing
     */
    static enableForTesting() {
        this.updateGroundingConfig({
            enabled: true,
            rolloutPercentage: 100,
            logLevel: 'debug'
        });
        this.log('Enhanced grounding enabled for testing', 'info');
    }
}
exports.FeatureFlags = FeatureFlags;
FeatureFlags.config = {
    enabled: process.env.ENHANCED_GROUNDING_ENABLED === 'true',
    confidenceThreshold: parseFloat(process.env.GROUNDING_CONFIDENCE_THRESHOLD || '0.7'),
    maxChunks: parseInt(process.env.GROUNDING_MAX_CHUNKS || '50'),
    maxSources: parseInt(process.env.GROUNDING_MAX_SOURCES || '20'),
    rolloutPercentage: parseInt(process.env.GROUNDING_ROLLOUT_PERCENTAGE || '0'),
    logLevel: process.env.GROUNDING_LOG_LEVEL || 'info'
};
