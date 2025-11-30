// Shared Infrastructure - ChainReactions Backend
//
// This directory contains common utilities, base classes, and types
// that are shared across all microservices to eliminate code duplication
// and ensure consistent patterns throughout the application.
//
// Directory Structure:
// ├── utils/        - Utility functions and helpers
// ├── errors/       - Standardized error types
// ├── constants/    - Application constants and configuration
// ├── types/        - Shared TypeScript interfaces
// ├── base/         - Base classes for controllers and services
// ├── cache/        - Redis caching and performance optimization
// ├── database/     - Database query optimization
// ├── monitoring/   - Application Performance Monitoring (APM)
// └── testing/      - Performance testing framework

// Core Infrastructure (Phase 1)
export * from './utils/ResponseFormatter';
export * from './errors/ServiceErrors';
export * from './constants/ServiceConstants';
export * from './types/CommonTypes';
export * from './utils/CommonUtilities';
export * from './base/BaseController';

// Performance Optimization (Phase 3)
export * from './cache/CacheService';
export * from './cache/CachedAPIService';
export * from './cache/CacheLogger';
export * from './database/DatabaseOptimizer';
export * from './monitoring/APMService';
export * from './testing/PerformanceTestSuite';