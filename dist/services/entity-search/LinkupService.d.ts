import { LinkupAPIResponse } from '../../types/entity-search/types';
export declare class LinkupService {
    private apiKey;
    private baseURL;
    constructor();
    private getDefaultExcludeDomains;
    private buildSearchQuery;
    searchEntity(companyName: string, location?: string, customExcludeDomains?: string[]): Promise<LinkupAPIResponse>;
    testConnection(): Promise<LinkupAPIResponse>;
    isConfigured(): boolean;
}
//# sourceMappingURL=LinkupService.d.ts.map