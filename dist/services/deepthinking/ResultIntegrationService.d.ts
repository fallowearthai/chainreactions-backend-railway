import { SearchRequest, SearchResult } from '../../types/gemini';
import { MetaPromptResult } from './WebSearchMetaPromptService';
import { OptimizedSerpResults } from './ResultOptimizationService';
export interface OSINTAnalysisResult {
    risk_item: string;
    institution_A: string;
    relationship_type: 'Direct' | 'Indirect' | 'Significant Mention' | 'No Evidence Found';
    finding_summary: string;
    affiliated_company?: string;
    sources: string[];
    key_evidence: string[];
    evidence_quality: 'high' | 'medium' | 'low';
    analysis_metadata: {
        confidence_score: number;
        sources_analyzed: number;
        search_keywords_used: string[];
        engines_used: string[];
        analysis_timestamp: string;
    };
}
export declare class ResultIntegrationService {
    private geminiService;
    private readonly OSINT_ANALYST_SYSTEM_PROMPT;
    constructor();
    /**
     * Enhanced integration method that works with optimized SERP results
     */
    integrateAndAnalyzeOptimized(request: SearchRequest, metaPromptResult: MetaPromptResult, optimizedResults: OptimizedSerpResults): Promise<SearchResult>;
    /**
     * Clean and repair JSON response from AI
     */
    private cleanAndRepairJsonResponse;
    /**
     * Attempt to repair common JSON formatting issues
     */
    private attemptJsonRepair;
    /**
     * Extract JSON answer from thinking response parts
     * CRITICAL: Fixes the issue where we were incorrectly taking thinking content as the final answer
     */
    private extractJsonAnswerFromParts;
    /**
     * Check if text content appears to be thinking content
     */
    private isThinkingContent;
    /**
     * Parse JSON with simplified fallback strategy
     * Based on test analysis: Gemini returns proper JSON, so complex parsing is unnecessary
     */
    private parseJsonWithFallback;
    /**
     * Optimized version that works with pre-scored and filtered results
     */
    private analyzeEntityRelationshipOptimized;
    getAnalysisSummary(result: SearchResult): string;
    private buildOptimizedAnalysisPrompt;
    private formatSearchResultOptimized;
}
//# sourceMappingURL=ResultIntegrationService.d.ts.map