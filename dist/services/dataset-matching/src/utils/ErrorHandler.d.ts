import { Request, Response, NextFunction } from 'express';
import { ServiceError, DatabaseError, CacheError } from '../types/DatasetMatchTypes';
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly isOperational: boolean;
    constructor(message: string, statusCode: number, code: string, isOperational?: boolean);
}
export declare class ValidationError extends AppError {
    constructor(message: string, field?: string);
}
export declare class DatabaseConnectionError extends AppError {
    constructor(message?: string);
}
export declare class CacheConnectionError extends AppError {
    constructor(message?: string);
}
export declare class MatchingError extends AppError {
    constructor(message: string, entity?: string);
}
export declare const createServiceError: (code: string, message: string, details?: any) => ServiceError;
export declare const createDatabaseError: (message: string, query?: string, parameters?: any) => DatabaseError;
export declare const createCacheError: (message: string, cache_key?: string, operation?: "get" | "set" | "delete" | "clear") => CacheError;
export declare const globalErrorHandler: (error: Error, req: Request, res: Response, next: NextFunction) => void;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateRequired: (value: any, fieldName: string) => void;
export declare const validateArray: (value: any, fieldName: string, minLength?: number, maxLength?: number) => void;
export declare const validateString: (value: any, fieldName: string, minLength?: number, maxLength?: number) => void;
export declare const validateNumber: (value: any, fieldName: string, min?: number, max?: number) => void;
//# sourceMappingURL=ErrorHandler.d.ts.map