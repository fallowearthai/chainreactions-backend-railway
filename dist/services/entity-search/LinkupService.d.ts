import { LinkupAPIResponse } from '../../types/entity-search/types';
export declare class LinkupService {
    private apiKey;
    private baseURL;
    constructor();
    private getDefaultExcludeDomains;
    private buildSearchQuery;
    searchEntity(companyName: string, location?: string, customExcludeDomains?: string[]): Promise<LinkupAPIResponse>;
    testConnection(): Promise<LinkupAPIResponse>;
    /**
     * Lightweight configuration check - does NOT call any API
     * Use this for health checks to avoid consuming credits
     */
    checkConfiguration(): {
        configured: boolean;
        baseURL: string;
        hasApiKey: boolean;
    };
    isConfigured(): boolean;
}
//# sourceMappingURL=LinkupService.d.ts.map