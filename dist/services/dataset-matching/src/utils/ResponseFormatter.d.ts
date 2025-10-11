import { Response } from 'express';
import { DatasetMatch, ServiceError } from '../types/DatasetMatchTypes';
export declare class ResponseFormatter {
    static success<T>(res: Response, data: T, metadata?: any, statusCode?: number): Response;
    static error(res: Response, error: ServiceError | string, statusCode?: number): Response;
    static matchResponse(res: Response, matches: DatasetMatch[], searchEntity: string, processingTimeMs: number, cacheHit?: boolean, statusCode?: number): Response;
    static batchMatchResponse(res: Response, matchResults: Record<string, DatasetMatch[]>, processingTimeMs: number, cacheHits?: number, failedEntities?: string[], statusCode?: number): Response;
    static healthCheck(res: Response, additionalData?: any): Response;
    static serviceInfo(res: Response): Response;
    static validationError(res: Response, message: string, field?: string): Response;
    static notFound(res: Response, resource?: string): Response;
    static serviceUnavailable(res: Response, service: string): Response;
    static tooManyRequests(res: Response, retryAfter?: number): Response;
    static formatProcessingTime(startTime: [number, number]): number;
    static sanitizeMatches(matches: DatasetMatch[]): DatasetMatch[];
}
//# sourceMappingURL=ResponseFormatter.d.ts.map