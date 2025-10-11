export interface EntitySearchRequest {
    company_name: string;
    location?: string;
    exclude_domains?: string[];
}
export interface EntitySearchResponse {
    success: boolean;
    data?: any[];
    error?: string;
    message?: string;
}
export interface LinkupAPIResponse {
    success: boolean;
    data?: any;
    error?: string;
}
export interface HealthCheckResponse {
    status: string;
    timestamp: string;
    service: string;
    version: string;
}
export interface ServiceInfoResponse {
    service: string;
    version: string;
    description: string;
    endpoints: string[];
    status: string;
}
//# sourceMappingURL=types.d.ts.map