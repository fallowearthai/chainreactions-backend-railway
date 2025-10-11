import { LinkupApiResponse, ParsedSearchResult } from '../types/DatasetSearchTypes';
export declare class LinkupResponseParser {
    /**
     * Parse the Linkup API response - prioritize JSON parsing
     */
    static parseResponse(response: LinkupApiResponse, riskEntity: string): ParsedSearchResult;
    /**
     * Parse JSON response from API
     */
    private static parseJSONResponse;
    /**
     * Parse text response (fallback for backward compatibility)
     */
    private static parseTextResponse;
    /**
     * Batch parse multiple responses
     */
    static parseMultipleResponses(responses: LinkupApiResponse[], riskEntities: string[]): ParsedSearchResult[];
}
//# sourceMappingURL=LinkupResponseParser.d.ts.map