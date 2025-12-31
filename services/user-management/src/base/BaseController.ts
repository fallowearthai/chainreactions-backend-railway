import { Response } from 'express';

/**
 * Simple base controller for user-management service
 */
export abstract class BaseController {
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  protected sendSuccessResponse(
    res: Response,
    data?: any,
    message?: string,
    statusCode: number = 200
  ): void {
    res.status(statusCode).json({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    });
  }

  protected sendErrorResponse(
    res: Response,
    message: string,
    statusCode: number = 500,
    error?: any
  ): void {
    console.error(`[${this.serviceName}] Error:`, error || message);

    res.status(statusCode).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { details: error }),
      timestamp: new Date().toISOString()
    });
  }

  protected asyncHandler(fn: Function) {
    return (req: any, res: Response, next: any) => {
      Promise.resolve(fn(req, res, next)).catch((error) => {
        console.error(`[${this.serviceName}] Async error:`, error);
        this.sendErrorResponse(res, 'Internal server error', 500, error);
      });
    };
  }
}