import { Request, Response, NextFunction } from 'express';
export interface ValidationError {
    field: string;
    message: string;
}
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateRequired: (value: any, fieldName: string) => void;
export declare const validateString: (value: any, fieldName: string, minLength?: number, maxLength?: number) => void;
export declare const validateArray: (value: any, fieldName: string, minLength?: number, maxLength?: number) => void;
export declare const validateDate: (value: any, fieldName: string) => void;
export declare const validateExecutionId: (value: any, fieldName: string) => void;
export declare const validateFile: (file: Express.Multer.File, allowedExtensions: string[]) => void;
export declare const errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response) => void;
//# sourceMappingURL=ErrorHandler.d.ts.map