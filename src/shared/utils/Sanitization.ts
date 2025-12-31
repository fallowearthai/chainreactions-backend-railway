/**
 * Data Sanitization Utility
 * Helps remove or mask sensitive information from data before logging
 */

export interface SanitizationOptions {
  maskUserIds?: boolean;
  maskEmails?: boolean;
  maskPhoneNumbers?: boolean;
  maskIpAddresses?: boolean;
  maskTokens?: boolean;
  removeInternalPaths?: boolean;
}

/**
 * Default sanitization options
 */
const DEFAULT_OPTIONS: SanitizationOptions = {
  maskUserIds: true,
  maskEmails: true,
  maskPhoneNumbers: true,
  maskIpAddresses: true,
  maskTokens: true,
  removeInternalPaths: true
};

/**
 * Sanitization utility class
 */
export class Sanitization {
  private options: SanitizationOptions;

  constructor(options?: Partial<SanitizationOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Sanitize an object by removing or masking sensitive data
   */
  sanitize(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};

      for (const [key, value] of Object.entries(data)) {
        const sanitizedKey = this.sanitizeKey(key);
        const sanitizedValue = this.sanitize(value);

        // Skip if key is sensitive and value should be removed
        if (this.shouldRemoveKey(key)) {
          continue;
        }

        sanitized[sanitizedKey] = sanitizedValue;
      }

      return sanitized;
    }

    return data;
  }

  /**
   * Sanitize a string value
   */
  private sanitizeString(str: string): string {
    let sanitized = str;

    if (this.options.maskEmails) {
      sanitized = this.maskEmail(sanitized);
    }

    if (this.options.maskPhoneNumbers) {
      sanitized = this.maskPhone(sanitized);
    }

    if (this.options.maskIpAddresses) {
      sanitized = this.maskIp(sanitized);
    }

    if (this.options.removeInternalPaths) {
      sanitized = this.removeInternalPaths(sanitized);
    }

    return sanitized;
  }

  /**
   * Sanitize an object key
   */
  private sanitizeKey(key: string): string {
    // Don't modify key names, just return as-is
    return key;
  }

  /**
   * Check if a key should be removed entirely
   */
  private shouldRemoveKey(key: string): boolean {
    const sensitiveKeys = [
      'password',
      'secret',
      'apiKey',
      'api_key',
      'token',
      'authorization',
      'credential',
      'credentials'
    ];

    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
  }

  /**
   * Mask email address
   */
  private maskEmail(email: string): string {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

    return email.replace(emailRegex, (match) => {
      const [localPart, domain] = match.split('@');
      if (localPart.length <= 2) {
        return `***@${domain}`;
      }
      return `${localPart[0]}${localPart[1]}***@${domain}`;
    });
  }

  /**
   * Mask phone number
   */
  private maskPhone(phone: string): string {
    // Match various phone number formats
    const phoneRegex = /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;

    return phone.replace(phoneRegex, (match) => {
      // Keep only first 3 digits
      return match.substring(0, Math.min(3, match.length)) + '***';
    });
  }

  /**
   * Mask IP address
   */
  private maskIp(ip: string): string {
    // Match IPv4 addresses
    const ipv4Regex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

    return ip.replace(ipv4Regex, (match) => {
      const parts = match.split('.');
      return `${parts[0]}.${parts[1]}.***.***`;
    });
  }

  /**
   * Remove internal file paths
   */
  private removeInternalPaths(str: string): string {
    // Match absolute file paths
    const pathRegex = /\/[a-zA-Z0-9_\-\/]+\.[a-z]+/g;

    return str.replace(pathRegex, (match) => {
      // Extract just the filename
      const parts = match.split('/');
      return parts[parts.length - 1];
    });
  }

  /**
   * Mask a user ID (UUID)
   */
  static maskUserId(userId: string): string {
    if (!userId || userId.length < 8) {
      return '***';
    }

    // Show first 4 and last 4 characters
    return `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
  }

  /**
   * Mask a token
   */
  static maskToken(token: string): string {
    if (!token || token.length <= 10) {
      return '***';
    }

    // Show only first 5 characters
    return token.substring(0, 5) + '...';
  }

  /**
   * Sanitize a request path by masking IDs
   */
  static sanitizePath(path: string): string {
    // Replace UUIDs
    let sanitized = path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id'
    );

    // Replace numeric IDs
    sanitized = sanitized.replace(/\/\d+(?=[/?#]|$)/g, '/:id');

    return sanitized;
  }

  /**
   * Sanitize headers for logging
   */
  static sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();

      if (sensitiveHeaders.includes(lowerKey)) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize query parameters
   */
  static sanitizeQuery(query: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveParams = ['token', 'api_key', 'password', 'secret'];

    for (const [key, value] of Object.entries(query)) {
      const lowerKey = key.toLowerCase();

      if (sensitiveParams.some(param => lowerKey.includes(param))) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * Export a default instance for convenience
 */
export const sanitizer = new Sanitization();
