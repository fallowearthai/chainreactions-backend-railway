export interface ParsedResponse {
    success: boolean;
    data: {
        company_info: any | null;
        sources: any[];
        metadata: {
            search_query: string;
            timestamp: string;
            parsing_success: boolean;
        };
    };
    raw_answer: string;
}
export declare class ResponseParser {
    /**
     * Parse company data from Linkup API response using multiple parsing strategies
     * Based on N8N workflow: "Parse Company Response" node
     */
    static parseCompanyData(answer: string): any | null;
    /**
     * Process Linkup API response and format it according to N8N output structure
     */
    static processLinkupResponse(linkupResponse: any): ParsedResponse;
    /**
     * Validate parsed company data structure
     */
    static validateCompanyData(companyData: any): boolean;
    /**
     * Extract clean company data for frontend compatibility
     */
    static extractCleanData(parsedResponse: ParsedResponse): any[];
}
//# sourceMappingURL=responseParser.d.ts.map