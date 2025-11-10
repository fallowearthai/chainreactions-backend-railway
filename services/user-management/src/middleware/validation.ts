import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError, ErrorResponse } from '@/types/UserTypes';
import { SignUpRequest, SignInRequest } from '@/types/AuthTypes';

export class ValidationMiddleware {
  // Generic validation middleware factory
  static validate(schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') {
    return (req: Request, res: Response, next: NextFunction): void => {
      const data = req[source];
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const validationErrors: ValidationError[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Validation failed',
          details: 'Please check the following fields for errors',
          validationErrors,
          timestamp: new Date().toISOString(),
          path: req.path
        };

        res.status(400).json(errorResponse);
        return;
      }

      // Replace the data with validated and cleaned data
      req[source] = value;
      next();
    };
  }

  // Common validation schemas
  static schemas = {
    // UUID validation
    uuid: Joi.string().uuid().required().messages({
      'string.guid': 'Must be a valid UUID',
      'any.required': 'This field is required'
    }),

    // Email validation
    email: Joi.string().email().required().messages({
      'string.email': 'Must be a valid email address',
      'any.required': 'Email is required'
    }),

    // Password validation
    password: Joi.string()
      .min(6)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.max': 'Password must not exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
        'any.required': 'Password is required'
      }),

    // User display name validation
    displayName: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z0-9\s\-_\.]+$/)
      .optional()
      .messages({
        'string.min': 'Display name must be at least 2 characters long',
        'string.max': 'Display name must not exceed 100 characters',
        'string.pattern.base': 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods'
      }),

    // Company name validation
    company: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z0-9\s\-_\.&]+$/)
      .optional()
      .messages({
        'string.min': 'Company name must be at least 2 characters long',
        'string.max': 'Company name must not exceed 100 characters',
        'string.pattern.base': 'Company name can only contain letters, numbers, spaces, hyphens, underscores, periods, and ampersands'
      }),

    // Department validation
    department: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z0-9\s\-_]+$/)
      .optional()
      .messages({
        'string.min': 'Department must be at least 2 characters long',
        'string.max': 'Department must not exceed 50 characters',
        'string.pattern.base': 'Department can only contain letters, numbers, spaces, hyphens, and underscores'
      }),

    // Phone number validation
    phone: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Must be a valid phone number in international format'
      }),

    // Role validation
    role: Joi.string()
      .valid('admin', 'user', 'manager')
      .default('user')
      .messages({
        'any.only': 'Role must be one of: admin, user, manager'
      }),

    // Account type validation
    accountType: Joi.string()
      .valid('admin', 'premium', 'free_trial')
      .default('free_trial')
      .messages({
        'any.only': 'Account type must be one of: admin, premium, free_trial'
      }),

    // Pagination validation
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
      }),

    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 100'
      }),

    // Date range validation
    startDate: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'Start date must be a valid ISO 8601 date'
      }),

    endDate: Joi.date()
      .iso()
      .optional()
      .min(Joi.ref('startDate'))
      .messages({
        'date.format': 'End date must be a valid ISO 8601 date',
        'date.min': 'End date must be after or equal to start date'
      }),

    // Search query validation
    searchQuery: Joi.string()
      .min(1)
      .max(200)
      .optional()
      .messages({
        'string.min': 'Search query must be at least 1 character long',
        'string.max': 'Search query must not exceed 200 characters'
      }),

    // Credits amount validation
    creditsAmount: Joi.number()
      .integer()
      .min(1)
      .max(10000)
      .required()
      .messages({
        'number.base': 'Amount must be a number',
        'number.integer': 'Amount must be an integer',
        'number.min': 'Amount must be at least 1',
        'number.max': 'Amount must not exceed 10,000',
        'any.required': 'Amount is required'
      }),

    // Reason validation
    reason: Joi.string()
      .min(5)
      .max(500)
      .required()
      .messages({
        'string.min': 'Reason must be at least 5 characters long',
        'string.max': 'Reason must not exceed 500 characters',
        'any.required': 'Reason is required'
      }),

    // Transaction type validation
    transactionType: Joi.string()
      .valid('bonus', 'refund', 'purchase')
      .required()
      .messages({
        'any.only': 'Transaction type must be one of: bonus, refund, purchase',
        'any.required': 'Transaction type is required'
      }),

    // User status validation
    userStatus: Joi.string()
      .valid('active', 'inactive', 'pending', 'approved')
      .optional()
      .messages({
        'any.only': 'User status must be one of: active, inactive, pending, approved'
      })
  };

  // Complete validation schemas for endpoints
  static endpointSchemas = {
    // Auth endpoints
    signUp: Joi.object({
      email: this.schemas.email,
      password: this.schemas.password,
      displayName: this.schemas.displayName,
      company: this.schemas.company,
      department: this.schemas.department
    }),

    signIn: Joi.object({
      email: this.schemas.email,
      password: Joi.string().required().messages({
        'any.required': 'Password is required'
      })
    }),

    passwordReset: Joi.object({
      email: this.schemas.email
    }),

    updatePassword: Joi.object({
      currentPassword: Joi.string().required().messages({
        'any.required': 'Current password is required'
      }),
      newPassword: this.schemas.password
    }),

    // User management endpoints
    createUser: Joi.object({
      email: this.schemas.email,
      displayName: this.schemas.displayName,
      companyId: this.schemas.uuid,
      department: this.schemas.department,
      title: Joi.string().max(100).optional(),
      phone: this.schemas.phone,
      timezone: Joi.string().optional(),
      language: Joi.string().length(2).optional()
    }),

    updateUser: Joi.object({
      displayName: this.schemas.displayName,
      department: this.schemas.department,
      title: Joi.string().max(100).optional(),
      phone: this.schemas.phone,
      timezone: Joi.string().optional(),
      language: Joi.string().length(2).optional(),
      preferences: Joi.object({
        emailNotifications: Joi.boolean().optional(),
        theme: Joi.string().valid('light', 'dark', 'auto').optional(),
        language: Joi.string().length(2).optional(),
        timezone: Joi.string().optional()
      }).optional()
    }),

    // Role management
    assignRole: Joi.object({
      userId: this.schemas.uuid,
      role: this.schemas.role,
      expiresAt: Joi.date().iso().optional()
    }),

    // Credits management
    addCredits: Joi.object({
      userId: this.schemas.uuid,
      amount: this.schemas.creditsAmount,
      reason: this.schemas.reason,
      transactionType: this.schemas.transactionType
    }),

    deductCredits: Joi.object({
      userId: this.schemas.uuid,
      amount: this.schemas.creditsAmount,
      reason: this.schemas.reason
    }),

    // User listing and filtering
    getUsers: Joi.object({
      page: this.schemas.page,
      limit: this.schemas.limit,
      status: this.schemas.userStatus,
      role: this.schemas.role,
      accountType: this.schemas.accountType,
      company: this.schemas.company,
      search: this.schemas.searchQuery,
      createdAfter: this.schemas.startDate,
      createdBefore: Joi.date().iso().optional()
    }),

    // Usage statistics
    getUsageStats: Joi.object({
      userId: this.schemas.uuid,
      startDate: this.schemas.startDate.required(),
      endDate: this.schemas.endDate.required()
    }),

    // Bulk operations
    bulkOperation: Joi.object({
      action: Joi.string()
        .valid('approve', 'deactivate', 'delete', 'addCredits', 'assignRole')
        .required()
        .messages({
          'any.only': 'Action must be one of: approve, deactivate, delete, addCredits, assignRole',
          'any.required': 'Action is required'
        }),
      userIds: Joi.array()
        .items(this.schemas.uuid)
        .min(1)
        .max(100)
        .required()
        .messages({
          'array.min': 'At least one user ID must be provided',
          'array.max': 'Cannot process more than 100 users at once',
          'any.required': 'User IDs are required'
        }),
      data: Joi.object().optional() // Additional data for specific operations
    }),

    // Approval requests
    createApprovalRequest: Joi.object({
      userId: this.schemas.uuid,
      requestType: Joi.string()
        .valid('user_creation', 'user_upgrade', 'credit_increase', 'feature_access')
        .required()
        .messages({
          'any.only': 'Request type must be one of: user_creation, user_upgrade, credit_increase, feature_access',
          'any.required': 'Request type is required'
        }),
      requestData: Joi.object().required().messages({
        'any.required': 'Request data is required'
      }),
      notes: Joi.string().max(1000).optional()
    }),

    // Path parameters
    userId: Joi.object({
      userId: this.schemas.uuid
    }),

    
    // Email verification
    emailVerification: Joi.object({
      email: this.schemas.email,
      token: Joi.string().required().messages({
        'any.required': 'Verification token is required'
      }),
      type: Joi.string()
        .valid('signup', 'change', 'invite')
        .required()
        .messages({
          'any.only': 'Type must be one of: signup, change, invite',
          'any.required': 'Type is required'
        })
    })
  };

  // Convenience methods for common validations
  static validateSignUp = this.validate(this.endpointSchemas.signUp);
  static validateSignIn = this.validate(this.endpointSchemas.signIn);
  static validatePasswordReset = this.validate(this.endpointSchemas.passwordReset);
  static validateUpdatePassword = this.validate(this.endpointSchemas.updatePassword);
  static validateCreateUser = this.validate(this.endpointSchemas.createUser);
  static validateUpdateUser = this.validate(this.endpointSchemas.updateUser);
  static validateAssignRole = this.validate(this.endpointSchemas.assignRole);
  static validateAddCredits = this.validate(this.endpointSchemas.addCredits);
  static validateDeductCredits = this.validate(this.endpointSchemas.deductCredits);
  static validateGetUsers = this.validate(this.endpointSchemas.getUsers, 'query');
  static validateGetUsageStats = this.validate(this.endpointSchemas.getUsageStats, 'query');
  static validateBulkOperation = this.validate(this.endpointSchemas.bulkOperation);
  static validateCreateApprovalRequest = this.validate(this.endpointSchemas.createApprovalRequest);
  static validateUserId = this.validate(this.endpointSchemas.userId, 'params');
  static validateEmailVerification = this.validate(this.endpointSchemas.emailVerification);
}

// Export convenience functions
export const {
  validateSignUp,
  validateSignIn,
  validatePasswordReset,
  validateUpdatePassword,
  validateCreateUser,
  validateUpdateUser,
  validateAssignRole,
  validateAddCredits,
  validateDeductCredits,
  validateGetUsers,
  validateGetUsageStats,
  validateBulkOperation,
  validateCreateApprovalRequest,
  validateUserId,
  validateEmailVerification
} = ValidationMiddleware;