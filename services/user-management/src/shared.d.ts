// Shared infrastructure declarations for user-management service
declare module '../../../shared/base/BaseController' {
  import { Request, Response, NextFunction } from 'express';
  export abstract class BaseController {
    constructor(serviceName: string);
    protected handleError(res: Response, error: unknown, defaultMessage?: string, path?: string): void;
    protected sendSuccess<T>(res: Response, data: T, message?: string, statusCode?: number): void;
    protected sendPaginated<T>(res: Response, items: T[], page: number, limit: number, total: number, message?: string): void;
    protected validateRequiredFields(body: any, requiredFields: string[]): { isValid: boolean; errors: string[] };
    protected validateStringField(value: any, fieldName: string, minLength?: number, maxLength?: number): { isValid: boolean; errors: string[] };
    protected validateEmail(email: string): boolean;
    protected getClientIP(req: Request): string;
    protected logRequest(req: Request, additionalInfo?: string): void;
    protected logError(error: Error, context?: string): void;
    protected asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): (req: Request, res: Response, next: NextFunction) => void;
    protected isMaintenanceMode(): boolean;
    protected sendMaintenanceResponse(res: Response): void;
    protected getServiceHealth(status?: 'healthy' | 'unhealthy' | 'degraded', version?: string, uptime?: number, dependencies?: any): any;
  }
}

declare module '../../../shared/errors/ServiceErrors' {
  export class ServiceError extends Error {
    constructor(statusCode: number, code: string, message: string, details?: any);
  }
  export class ValidationError extends ServiceError {
    constructor(message: string, details?: any);
  }
  export class AuthenticationError extends ServiceError {
    constructor(message?: string, details?: any);
  }
  export class AuthorizationError extends ServiceError {
    constructor(message?: string, details?: any);
  }
  export class NotFoundError extends ServiceError {
    constructor(resource: string, identifier?: string, details?: any);
  }
  export class ConflictError extends ServiceError {
    constructor(message: string, details?: any);
  }
  export class RateLimitError extends ServiceError {
    constructor(retryAfter?: number, details?: any);
  }
  export class ExternalApiError extends ServiceError {
    constructor(service: string, message: string, statusCode?: number, details?: any);
  }
  export class ServiceUnavailableError extends ServiceError {
    constructor(service: string, message?: string, details?: any);
  }
  export class TimeoutError extends ServiceError {
    constructor(operation: string, timeoutMs: number, details?: any);
  }
  export class ConfigurationError extends ServiceError {
    constructor(configKey: string, message?: string, details?: any);
  }
  export class DatabaseError extends ServiceError {
    constructor(operation: string, message?: string, details?: any);
  }
  export class FileProcessingError extends ServiceError {
    constructor(operation: string, message: string, filename?: string, details?: any);
  }
  export class BusinessLogicError extends ServiceError {
    constructor(rule: string, message: string, details?: any);
  }
  export class CacheError extends ServiceError {
    constructor(operation: string, message?: string, details?: any);
  }
  export class QuotaExceededError extends ServiceError {
    constructor(resource: string, limit: number, current: number, details?: any);
  }
  export class MaintenanceModeError extends ServiceError {
    constructor(message?: string, details?: any);
  }
}

declare module '../../../shared/constants/ServiceConstants' {
  export const HTTP_STATUS: {
    OK: number;
    CREATED: number;
    NO_CONTENT: number;
    BAD_REQUEST: number;
    UNAUTHORIZED: number;
    FORBIDDEN: number;
    NOT_FOUND: number;
    METHOD_NOT_ALLOWED: number;
    CONFLICT: number;
    UNPROCESSABLE_ENTITY: number;
    TOO_MANY_REQUESTS: number;
    INTERNAL_SERVER_ERROR: number;
    BAD_GATEWAY: number;
    SERVICE_UNAVAILABLE: number;
    GATEWAY_TIMEOUT: number;
  };

  export const VALIDATION: {
    MIN_NAME_LENGTH: number;
    MAX_NAME_LENGTH: number;
    MIN_DESCRIPTION_LENGTH: number;
    MAX_DESCRIPTION_LENGTH: number;
    MIN_EMAIL_LENGTH: number;
    MAX_EMAIL_LENGTH: number;
    MIN_PASSWORD_LENGTH: number;
    MAX_PASSWORD_LENGTH: number;
    REQUIRE_UPPERCASE: boolean;
    REQUIRE_LOWERCASE: boolean;
    REQUIRE_NUMBERS: boolean;
    REQUIRE_SPECIAL_CHARS: boolean;
    EMAIL_REGEX: RegExp;
    PHONE_REGEX: RegExp;
    URL_REGEX: RegExp;
    MAX_ENTITY_NAME_LENGTH: number;
    MAX_KEYWORD_LENGTH: number;
    MAX_SEARCH_QUERY_LENGTH: number;
  };

  export const TIMEOUTS: {
    DEFAULT: number;
    SHORT: number;
    MEDIUM: number;
    LONG: number;
    GEMINI_API: number;
    LINKUP_API: number;
    BRIGHT_DATA_API: number;
    DATABASE_QUERY: number;
    FILE_PROCESSING: number;
    CACHE_OPERATION: number;
    SSE_CONNECTION: number;
    SSE_HEARTBEAT: number;
    RETRY_DELAY: number;
    RETRY_BACKOFF_MULTIPLIER: number;
    MAX_RETRY_DELAY: number;
  };
}