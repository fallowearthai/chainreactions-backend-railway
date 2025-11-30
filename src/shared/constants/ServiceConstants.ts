/**
 * Centralized constants for all ChainReactions microservices.
 *
 * This file eliminates magic numbers and strings scattered throughout
 * the codebase, providing a single source of truth for configuration values.
 *
 * All services should import constants from this file instead of hardcoding values.
 */

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

/**
 * API Timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  // Default timeouts
  DEFAULT: 30000,           // 30 seconds
  SHORT: 5000,              // 5 seconds
  MEDIUM: 15000,            // 15 seconds
  LONG: 60000,              // 1 minute

  // Service-specific timeouts
  GEMINI_API: 180000,       // 3 minutes
  LINKUP_API: 900000,       // 15 minutes
  BRIGHT_DATA_API: 120000,  // 2 minutes
  DATABASE_QUERY: 30000,    // 30 seconds
  FILE_PROCESSING: 300000,  // 5 minutes
  CACHE_OPERATION: 5000,    // 5 seconds

  // SSE streaming timeouts
  SSE_CONNECTION: 300000,   // 5 minutes
  SSE_HEARTBEAT: 30000,     // 30 seconds

  // Retry timeouts
  RETRY_DELAY: 1000,        // 1 second
  RETRY_BACKOFF_MULTIPLIER: 2,
  MAX_RETRY_DELAY: 10000    // 10 seconds
} as const;

/**
 * Concurrency Limits
 */
export const CONCURRENCY = {
  DEFAULT: 2,
  LOW: 1,
  MEDIUM: 4,
  HIGH: 8,
  MAX: 16,

  // Service-specific limits
  DATASET_SEARCH_CONCURRENT: 2,
  ENTITY_RELATIONS_CONCURRENT: 4,
  BATCH_PROCESSING_CONCURRENT: 8
} as const;

/**
 * Confidence Thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.4,
  MINIMUM: 0.1
} as const;

/**
 * Pagination
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1
} as const;

/**
 * File Upload Limits
 */
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024,  // 50MB
  MAX_CSV_SIZE: 10 * 1024 * 1024,   // 10MB
  MAX_TEXT_SIZE: 1 * 1024 * 1024,   // 1MB
  SUPPORTED_FORMATS: ['.csv', '.xlsx', '.xls', '.txt'],
  MAX_FILENAME_LENGTH: 255
} as const;

/**
 * Rate Limiting
 */
export const RATE_LIMITS = {
  DEFAULT_REQUESTS_PER_WINDOW: 100,
  DEFAULT_WINDOW_MS: 15 * 60 * 1000,  // 15 minutes

  // API-specific limits
  GEMINI_API_PER_MINUTE: 60,
  LINKUP_API_PER_MINUTE: 100,
  BRIGHT_DATA_API_PER_MINUTE: 120,

  // Auth endpoints
  LOGIN_ATTEMPTS_PER_WINDOW: 5,
  LOGIN_WINDOW_MS: 15 * 60 * 1000,   // 15 minutes
  SIGNUP_ATTEMPTS_PER_WINDOW: 3,
  SIGNUP_WINDOW_MS: 60 * 60 * 1000   // 1 hour
} as const;

/**
 * AI/LLM Configuration
 */
export const AI_CONFIG = {
  // Gemini API settings
  GEMINI_MAX_TOKENS: 8192,
  GEMINI_TEMPERATURE: 0.2,
  GEMINI_TOP_P: 0.8,
  GEMINI_TOP_K: 40,

  // Output limits
  MAX_RESPONSE_LENGTH: 10000,
  MAX_PROMPT_LENGTH: 32000,
  TRUNCATION_THRESHOLD: 5000,

  // Memory limits
  MAX_MEMORY_USAGE_MB: 512,
  MEMORY_CLEANUP_THRESHOLD: 400,

  // Feature flags
  GROUNDING_ENABLED: false,
  ADVANCED_ANALYSIS_ENABLED: false,
  ENHANCED_SEARCH_ENABLED: true
} as const;

/**
 * Entity Matching Configuration
 */
export const ENTITY_MATCHING = {
  // Default weights
  DEFAULT_EXACT_WEIGHT: 1.0,
  DEFAULT_CONTAINS_WEIGHT: 0.8,
  DEFAULT_FUZZY_WEIGHT: 0.6,
  DEFAULT_SEMANTIC_WEIGHT: 0.4,
  DEFAULT_PHONETIC_WEIGHT: 0.3,

  // Similarity thresholds
  EXACT_THRESHOLD: 1.0,
  HIGH_SIMILARITY_THRESHOLD: 0.9,
  MEDIUM_SIMILARITY_THRESHOLD: 0.7,
  LOW_SIMILARITY_THRESHOLD: 0.5,

  // Levenshtein distance settings
  MAX_LEVENSHTEIN_DISTANCE: 2,
  LEVENSHTEIN_THRESHOLD: 0.8,

  // Processing limits
  MAX_COMPARISONS_PER_REQUEST: 1000,
  MAX_CANDIDATES_PER_ENTITY: 50
} as const;

/**
 * Database Configuration
 */
export const DATABASE = {
  // Connection pool settings
  MIN_CONNECTIONS: 2,
  MAX_CONNECTIONS: 10,
  IDLE_TIMEOUT_MS: 30000,     // 30 seconds
  CONNECTION_TIMEOUT_MS: 10000, // 10 seconds

  // Query settings
  DEFAULT_QUERY_TIMEOUT_MS: 30000,  // 30 seconds
  MAX_QUERY_TIMEOUT_MS: 300000,     // 5 minutes
  BATCH_SIZE: 1000,

  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000
} as const;

/**
 * Cache Configuration
 */
export const CACHE = {
  // TTL settings (in seconds)
  DEFAULT_TTL: 300,           // 5 minutes
  SHORT_TTL: 60,              // 1 minute
  MEDIUM_TTL: 900,            // 15 minutes
  LONG_TTL: 3600,             // 1 hour
  VERY_LONG_TTL: 86400,       // 24 hours

  // Cache keys
  ENTITY_CACHE_PREFIX: 'entity:',
  SEARCH_CACHE_PREFIX: 'search:',
  CONFIG_CACHE_PREFIX: 'config:',
  USER_CACHE_PREFIX: 'user:',

  // Memory limits
  MAX_MEMORY_CACHE_SIZE: 1000,
  CACHE_CLEANUP_INTERVAL: 300000  // 5 minutes
} as const;

/**
 * Validation Rules
 */
export const VALIDATION = {
  // String lengths
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 100,
  MIN_DESCRIPTION_LENGTH: 1,
  MAX_DESCRIPTION_LENGTH: 1000,
  MIN_EMAIL_LENGTH: 5,
  MAX_EMAIL_LENGTH: 254,

  // Password requirements
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBERS: true,
  REQUIRE_SPECIAL_CHARS: true,

  // Common patterns
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^\+?[\d\s-()]+$/,
  URL_REGEX: /^https?:\/\/.+/,

  // Business validation
  MAX_ENTITY_NAME_LENGTH: 255,
  MAX_KEYWORD_LENGTH: 100,
  MAX_SEARCH_QUERY_LENGTH: 500
} as const;

/**
 * Environment Variables
 */
export const ENV_VARS = {
  // Service configuration
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  HOST: 'HOST',

  // Database
  DATABASE_URL: 'DATABASE_URL',
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY',
  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',

  // External APIs
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  LINKUP_API_KEY: 'LINKUP_API_KEY',
  BRIGHT_DATA_API_KEY: 'BRIGHT_DATA_API_KEY',
  BRIGHT_DATA_SERP_ZONE: 'BRIGHT_DATA_SERP_ZONE',

  // Cache
  REDIS_URL: 'REDIS_URL',
  REDIS_PASSWORD: 'REDIS_PASSWORD',

  // Authentication
  JWT_SECRET: 'JWT_SECRET',
  JWT_EXPIRES_IN: 'JWT_EXPIRES_IN',
  REFRESH_TOKEN_SECRET: 'REFRESH_TOKEN_SECRET',

  // File storage
  UPLOAD_PATH: 'UPLOAD_PATH',
  MAX_FILE_SIZE: 'MAX_FILE_SIZE',

  // Feature flags
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  ENABLE_LOGGING: 'ENABLE_LOGGING',
  ENABLE_METRICS: 'ENABLE_METRICS'
} as const;

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  // Common endpoints
  HEALTH: '/api/health',
  INFO: '/api',
  VERSION: '/api/version',

  // Authentication
  AUTH_SIGNUP: '/api/auth/signup',
  AUTH_SIGNIN: '/api/auth/signin',
  AUTH_SIGNOUT: '/api/auth/signout',
  AUTH_REFRESH: '/api/auth/refresh',
  AUTH_VERIFY: '/api/auth/verify',

  // User management
  USERS: '/api/users',
  USER_PROFILE: '/api/users/profile',
  USER_PREFERENCES: '/api/users/preferences',

  // Entity operations
  ENTITY_SEARCH: '/api/search',
  ENTITY_RELATIONS: '/api/relations',
  ENTITY_ANALYSIS: '/api/analysis',

  // Dataset operations
  DATASET_SEARCH: '/api/datasets/search',
  DATASET_UPLOAD: '/api/datasets/upload',
  DATASET_MATCHING: '/api/datasets/matching'
} as const;

/**
 * Status Values
 */
export const STATUS = {
  // Processing status
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',

  // Health status
  HEALTHY: 'healthy',
  UNHEALTHY: 'unhealthy',
  DEGRADED: 'degraded',

  // User status
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING_VERIFICATION: 'pending_verification',

  // Entity relationship types
  DIRECT: 'Direct',
  INDIRECT: 'Indirect',
  SIGNIFICANT_MENTION: 'Significant Mention',
  UNKNOWN: 'Unknown',
  NO_EVIDENCE_FOUND: 'No Evidence Found'
} as const;

/**
 * Logging Levels
 */
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace'
} as const;

/**
 * Default Headers
 */
export const HEADERS = {
  CONTENT_TYPE_JSON: 'application/json',
  CONTENT_TYPE_FORM: 'application/x-www-form-urlencoded',
  CONTENT_TYPE_MULTIPART: 'multipart/form-data',
  ACCEPT_JSON: 'application/json',
  USER_AGENT: 'ChainReactions-Backend/1.0'
} as const;

/**
 * Error Codes
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  FILE_PROCESSING_ERROR: 'FILE_PROCESSING_ERROR',
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
} as const;