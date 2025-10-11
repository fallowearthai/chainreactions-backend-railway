import { NormalSearchRequest, NormalSearchResult } from '../types/gemini';
export declare class GeminiNormalSearchService {
    private apiKey;
    private apiUrl;
    constructor();
    /**
     * Build system instruction prompt for OSINT research
     */
    private buildSystemInstruction;
    /**
     * Build user prompt with search parameters
     */
    private buildUserPrompt;
    /**
     * Build Gemini API request body
     */
    private buildRequestBody;
    /**
     * Extract text content from Gemini response
     */
    private extractTextFromResponse;
    /**
     * Extract JSON from markdown or raw text
     */
    private extractJsonFromText;
    /**
     * Clean JSON string from control characters and formatting issues
     */
    private cleanJsonString;
    /**
     * Parse JSON response with error handling
     */
    private parseJsonResponse;
    /**
     * Execute normal search using Gemini API with Google Search tools
     */
    executeNormalSearch(request: NormalSearchRequest): Promise<{
        results: NormalSearchResult[];
    }>;
}
//# sourceMappingURL=GeminiNormalSearchService.d.ts.map