import { GeminiService } from './GeminiService';
import { SearchRequest, SearchResult, OSINTFinding, GeminiTool } from '../types/gemini';
import { MetaPromptResult } from './WebSearchMetaPromptService';
import { OptimizedSerpResults, OptimizedSearchResult } from './ResultOptimizationService';
import { CitationFormatter } from '../utils/CitationFormatter';

export interface OSINTAnalysisResult {
  risk_item: string;
  institution_A: string;
  relationship_type: 'Direct' | 'Indirect' | 'Significant Mention' | 'No Evidence Found';
  finding_summary: string;
  finding_summary_with_citations?: string; // New field with embedded citations
  affiliated_company?: string;
  sources: string[];
  key_evidence: string[];
  evidence_quality: 'high' | 'medium' | 'low';
  citations?: any[]; // Structured citation data
  analysis_metadata: {
    confidence_score: number;
    sources_analyzed: number;
    search_keywords_used: string[];
    engines_used: string[];
    analysis_timestamp: string;
  };
}

export class ResultIntegrationService {
  private geminiService: GeminiService;

  // 统一的OSINT分析师System Prompt常量
  private readonly OSINT_ANALYST_SYSTEM_PROMPT = `You are an expert OSINT analyst specializing in mapping institutional relationships and risk exposure. Your assignment is to examine search results and linked urls to determine the nature of relationships between specified target institutions and risk entities.
CRITICAL: You must return a single JSON object with the exact structure specified below. No additional text, commentary, or multiple JSON objects.

Instructions:
1. Review all provided search result snippets and use the URL context tool to thoroughly examine linked website and PDF documents for relevant information.
2. Categorize the relationship based on these definitions:
   - Direct: Explicit evidence (e.g., contracts, partnerships, formal collaborations) between the target and risk entity.
   - Indirect: Relationship exists via a clearly identified affiliated organization.
   - Significant Mention: Both entities are referenced together in a context that suggests relevance, but no direct or indirect link is established.
   - No Evidence Found: No meaningful connection identified in the sources.
3. For each finding, include:
   - Specific details such as dates, transaction amounts, or named individuals when available.
   - Assessment of source credibility (e.g., official site, reputable news, academic publication).
   - Conservative classification: Only assign 'Direct' if there is unambiguous supporting evidence; for 'Indirect', name the intermediary.
4. Structure your output as a JSON object with the following fields:
{
  "relationship_type": "Direct|Indirect|Significant Mention|No Evidence Found",
  "finding_summary": "Concise, evidence-based summary",
  "affiliated_company": "Name of affiliated company if Direct, else null",
  "sources": ["List of URLs used as evidence"],
  "confidence_score": Numeric value between 0 and 1 reflecting certainty,
  "evidence_quality": "high|medium|low",
  "key_evidence": ["Bullet points of the strongest supporting facts"]
}
Prioritize factual accuracy, source attribution, and clarity in your analysis. Do not speculate or infer beyond the evidence presented.`;

  constructor() {
    this.geminiService = new GeminiService();
  }


  /**
   * Enhanced integration method that works with optimized SERP results
   */
  async integrateAndAnalyzeOptimized(
    request: SearchRequest,
    metaPromptResult: MetaPromptResult,
    optimizedResults: OptimizedSerpResults
  ): Promise<SearchResult> {

    try {
      // Starting AI analysis with optimized results
      const riskEntities = request.Risk_Entity.split(',').map(entity => entity.trim());
      const analysisResults: OSINTAnalysisResult[] = [];

      // Analyze each risk entity separately using optimized results
      for (const riskEntity of riskEntities) {
        const entityAnalysis = await this.analyzeEntityRelationshipOptimized(
          request,
          riskEntity,
          metaPromptResult,
          optimizedResults
        );
        analysisResults.push(entityAnalysis);
      }

      // Convert to the expected SearchResult format using optimized structure
      return this.formatSearchResultOptimized(analysisResults, optimizedResults);

    } catch (error) {
      console.error('Optimized result integration failed:', error);
      throw new Error(`Failed to integrate optimized results: ${error}`);
    }
  }

  

  /**
   * Clean and repair JSON response from AI
   */
  private cleanAndRepairJsonResponse(rawResponse: string): string {
    let cleaned = rawResponse.trim();

    // Remove common markdown code block markers
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }

    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }

    // Remove thinking tags if present
    cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');

    // Remove any leading/trailing whitespace again
    cleaned = cleaned.trim();

    // Try to find JSON content if wrapped in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    return cleaned;
  }

  /**
   * Attempt to repair common JSON formatting issues
   */
  private attemptJsonRepair(jsonString: string): string {
    let repaired = jsonString;

    // Remove or escape control characters that break JSON
    repaired = repaired.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

    // Fix line breaks in string values
    repaired = repaired.replace(/("\s*:\s*"[^"]*)\n([^"]*")/g, '$1\\n$2');

    // Fix common trailing comma issues
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // Fix missing quotes around property names
    repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // Fix single quotes to double quotes
    repaired = repaired.replace(/'/g, '"');

    // Fix unescaped quotes in strings (more robust pattern)
    repaired = repaired.replace(/"([^"\\]*)\\?'([^"\\]*)":/g, '"$1\'$2":');

    // Fix unescaped backslashes in strings
    repaired = repaired.replace(/\\(?!["\\/bfnrt])/g, '\\\\');

    return repaired;
  }

  /**
   * Extract JSON answer from thinking response parts
   * CRITICAL: Fixes the issue where we were incorrectly taking thinking content as the final answer
   */
  private extractJsonAnswerFromParts(parts: any[]): string | null {
    // Strategy 1: Look for explicit thought flags (new API format)
    const nonThinkingParts = parts.filter(part => part.thought === false);
    if (nonThinkingParts.length > 0) {
      return nonThinkingParts[nonThinkingParts.length - 1].text; // Take the last non-thinking part
    }

    // Strategy 2: Look for JSON content in parts (current API format)
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (!part.text) continue;

      const text = part.text.trim();
      if (text.startsWith('```json') || text.startsWith('{') || text.includes('"relationship_type"')) {
        return text;
      }
    }

    // Strategy 3: Look for non-thinking content by text analysis
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (!part.text) continue;

      const text = part.text.trim();
      if (this.isThinkingContent(text)) {
        continue; // Skip thinking content
      }

      // If not thinking content, assume it's the answer
      return text;
    }

    // Strategy 4: Fallback to last part (historical behavior)
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.text) {
        return lastPart.text;
      }
    }

    return null;
  }

  /**
   * Check if text content appears to be thinking content
   */
  private isThinkingContent(text: string): boolean {
    const thinkingIndicators = [
      'let me analyze',
      'let me consider',
      'let me think',
      'i need to analyze',
      'i should consider',
      'first, i will',
      'next, i will',
      'then, i will',
      'finally, i will',
      'step by step',
      'to analyze this',
      'to perform this analysis',
      'thinking about',
      'considering the',
      'based on the analysis',
      'after reviewing',
      'let me check'
    ];

    const lowerText = text.toLowerCase();

    // Check for thinking indicators
    for (const indicator of thinkingIndicators) {
      if (lowerText.includes(indicator)) {
        return true;
      }
    }

    // Check for narrative thinking style
    if (lowerText.length > 200 &&
        (lowerText.includes('i ') || lowerText.includes('let me') || lowerText.includes('i need to'))) {
      // Long narrative text with first-person perspective is likely thinking
      return true;
    }

    return false;
  }

  /**
   * Parse JSON with simplified fallback strategy
   * Based on test analysis: Gemini returns proper JSON, so complex parsing is unnecessary
   */
  private parseJsonWithFallback(rawResponse: string, entityName: string): any {
    // Strategy 1: Extract JSON from response and parse
    let cleaned = this.cleanAndRepairJsonResponse(rawResponse);

    try {
      return JSON.parse(cleaned);
    } catch (error1) {
      console.warn(`❌ JSON parse failed for ${entityName}:`, error1);
      console.log(`📝 Cleaned response (first 500 chars): ${cleaned.substring(0, 500)}...`);

      // Strategy 2: Basic JSON repair for common formatting issues
      try {
        const repaired = this.attemptJsonRepair(cleaned);
        console.log(`📝 Repaired response (first 500 chars): ${repaired.substring(0, 500)}...`);
        return JSON.parse(repaired);
      } catch (error2) {
        console.warn(`❌ JSON repair failed for ${entityName}:`, error2);
        console.error(`❌ FULL RAW RESPONSE for ${entityName}:`, rawResponse);

        // Strategy 3: Return structured error response instead of throwing
        console.log(`🔧 Returning error response for ${entityName} to maintain workflow stability`);
        return {
          relationship_type: "No Evidence Found",
          finding_summary: `Analysis failed for ${entityName} due to response parsing error. Original error: ${error1 instanceof Error ? error1.message : String(error1)}`,
          affiliated_company: null,
          sources: [],
          confidence_score: 0.0,
          evidence_quality: "low",
          key_evidence: [`JSON parsing failed: ${error1 instanceof Error ? error1.message : String(error1)}`]
        };
      }
    }
  }

  
  /**
   * Optimized version that works with pre-scored and filtered results
   */
  private async analyzeEntityRelationshipOptimized(
    request: SearchRequest,
    riskEntity: string,
    metaPromptResult: MetaPromptResult,
    optimizedResults: OptimizedSerpResults
  ): Promise<OSINTAnalysisResult> {

    // Use all optimized results - let AI handle entity relevance analysis
    console.log(`🔍 Using all ${optimizedResults.consolidatedResults.length} optimized results for AI analysis of entity: ${riskEntity}`);
    const relevantResults = optimizedResults.consolidatedResults;

    const analysisPrompt = this.buildOptimizedAnalysisPrompt(
      request,
      riskEntity,
      relevantResults,
      metaPromptResult
    );

    const systemInstruction = {
      parts: [{
        text: this.OSINT_ANALYST_SYSTEM_PROMPT
      }]
    };

    try {
      const apiStartTime = Date.now();
      console.log(`📡 Calling Gemini API for ${riskEntity} (${relevantResults.length} sources)...`);

      // Build tools for analysis
      // ✅ ENABLED: urlContext tool re-enabled with correct API specification
      // Reference: https://ai.google.dev/gemini-api/docs/url-context
      // Format: { urlContext: {} } allows AI to analyze full webpage/PDF content from URLs
      const tools: GeminiTool[] = [
        { urlContext: {} }  // Enables comprehensive document analysis
      ];

      console.log(`📡 Calling Gemini API for ${riskEntity} (${relevantResults.length} sources) with URL Context enabled...`);

      const response = await this.geminiService.generateContent(
        [{
          parts: [{ text: analysisPrompt }]
        }],
        systemInstruction,
        tools, // ✅ ENABLED: urlContext now active with correct specification
        {
          temperature: 0,
          thinkingConfig: {
            thinkingBudget: 16384  // Optimized for urlContext stability - validated configuration
          }
          // Note: responseSchema and responseMimeType removed due to tool incompatibility
          // Error: "Tool use with a response mime type: 'application/json' is unsupported"
        }
      );

      const apiEndTime = Date.now();
      console.log(`📡 Gemini API completed for ${riskEntity} (${apiEndTime - apiStartTime}ms)`);

      // Enhanced response structure validation with detailed diagnostics
      if (!response) {
        console.error(`❌ No response received from Gemini API for ${riskEntity}`);
        throw new Error('No response received from Gemini API');
      }

      if (!response.candidates || response.candidates.length === 0) {
        console.error(`❌ No candidates in Gemini API response for ${riskEntity}`);
        console.error(`   Response structure:`, JSON.stringify(response, null, 2));
        throw new Error('No candidates in Gemini API response');
      }

      const candidate = response.candidates[0];
      if (!candidate.content) {
        console.error(`❌ No content in candidate for ${riskEntity}`);
        console.error(`   Candidate structure:`, JSON.stringify(candidate, null, 2));
        throw new Error('No content in Gemini API candidate');
      }

      if (!candidate.content.parts || candidate.content.parts.length === 0) {
        console.error(`❌ No parts in content for ${riskEntity} - AI "silence" detected`);
        console.error(`   Content structure:`, JSON.stringify(candidate.content, null, 2));
        console.error(`   Usage metadata:`, JSON.stringify(response.usageMetadata || {}, null, 2));
        console.error(`   This indicates thinking completed but no actual response was generated`);
        throw new Error('AI silence detected - thinking completed but no response generated');
      }

      if (!candidate.content.parts[0] || !candidate.content.parts[0].text) {
        console.error(`❌ Empty parts or missing text for ${riskEntity}`);
        console.error(`   Parts structure:`, JSON.stringify(candidate.content.parts, null, 2));
        throw new Error('Empty or invalid parts in Gemini API response');
      }

      // 🔧 CRITICAL FIX: Properly extract JSON answer from thinking responses
      // The response may contain multiple parts: thinking content + JSON answer
      // We need to identify which part contains the actual JSON answer
      let rawResponse = this.extractJsonAnswerFromParts(response.candidates[0].content.parts);

      if (!rawResponse) {
        throw new Error('No JSON answer found in Gemini API response');
      }

      console.log(`📝 Extracted JSON answer (${rawResponse.length} chars) from ${response.candidates[0].content.parts.length} parts`);

      // Use enhanced JSON parsing with fallback strategies
      const analysis = this.parseJsonWithFallback(rawResponse, riskEntity);

      // Create structured sources array from analysis.sources
      const structuredSources = (analysis.sources || []).map((url: string, index: number) => ({
        title: `Source ${index + 1}`,
        url: url,
        index: index
      }));

      // Create key evidence objects with source indices
      const keyEvidenceWithSources = (analysis.key_evidence || []).map((evidence: string, index: number) => ({
        evidence: evidence,
        source_index: Math.min(index, structuredSources.length - 1),
        confidence: analysis.confidence_score || 0.5
      }));

      // Generate finding summary with embedded citations
      let findingSummaryWithCitations = analysis.finding_summary || 'No significant evidence found.';
      let citations: any[] = [];

      try {
        const citationResult = CitationFormatter.formatFindingWithCitations(
          analysis.finding_summary || 'No significant evidence found.',
          keyEvidenceWithSources,
          structuredSources
        );

        findingSummaryWithCitations = citationResult.annotatedText;
        citations = citationResult.citations;

        console.log(`✅ Generated citations for ${riskEntity}: ${citations.length} sources embedded`);
      } catch (citationError) {
        console.warn(`⚠️ Citation generation failed for ${riskEntity}:`, citationError);
        // Fall back to original finding summary without citations
        findingSummaryWithCitations = analysis.finding_summary || 'No significant evidence found.';
      }

      return {
        risk_item: riskEntity,
        institution_A: request.Target_institution,
        relationship_type: analysis.relationship_type || 'No Evidence Found',
        finding_summary: analysis.finding_summary || 'No significant evidence found.',
        finding_summary_with_citations: findingSummaryWithCitations,
        affiliated_company: analysis.affiliated_company || analysis.potential_affiliated_entity || analysis.Affiliated_entity,
        sources: analysis.sources || [],
        key_evidence: analysis.key_evidence || [],
        evidence_quality: analysis.evidence_quality || 'medium',
        citations: citations,
        analysis_metadata: {
          confidence_score: analysis.confidence_score || 0.1,
          sources_analyzed: relevantResults.length,
          search_keywords_used: metaPromptResult.search_strategy.search_keywords,
          engines_used: optimizedResults.executionSummary.enginesUsed,
          analysis_timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`Optimized analysis failed for ${riskEntity}:`, error);
      throw new Error(`AI analysis failed for ${riskEntity}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }





  // Helper method to get analysis summary
  getAnalysisSummary(result: SearchResult): string {
    const findings = result.data || [];
    const relationships = findings.map(f => f.relationship_type);

    const summary = {
      total: findings.length,
      direct: relationships.filter(r => r === 'Direct').length,
      indirect: relationships.filter(r => r === 'Indirect').length,
      mention: relationships.filter(r => r === 'Significant Mention').length,
      noEvidence: relationships.filter(r => r === 'No Evidence Found').length
    };

    return `
Analysis Summary:
- Total entities analyzed: ${summary.total}
- Direct relationships: ${summary.direct}
- Indirect relationships: ${summary.indirect}
- Significant mentions: ${summary.mention}
- No evidence found: ${summary.noEvidence}
- Overall confidence: ${((result.metadata?.overall_confidence || 0) * 100).toFixed(1)}%
- Total sources: ${result.sources?.length || 0}
    `.trim();
  }

  // Helper methods for optimized workflow


  private buildOptimizedAnalysisPrompt(
    request: SearchRequest,
    riskEntity: string,
    relevantResults: OptimizedSearchResult[],
    _metaPromptResult: MetaPromptResult
  ): string {

    const resultsText = relevantResults
      .map((result, index) =>
        `[${index + 1}] [Score: ${result.relevanceScore}] ${result.title}\n${result.snippet}\nURL: ${result.url}\nEngine: ${result.engine}\nKeywords: ${result.searchKeywords.join(', ')}\n`
      ).join('\n');

    const timeConstraint = request.Start_Date && request.End_Date
      ? `Focus on relationships within the timeframe ${request.Start_Date} to ${request.End_Date}.`
      : '';

    return `TARGET INSTITUTION: ${request.Target_institution}
RISK ENTITY: ${riskEntity}
GEOGRAPHIC CONTEXT: ${request.Location}
${timeConstraint}

OPTIMIZED SEARCH RESULTS (Pre-scored by relevance):
${resultsText}

TASK: Analyze the search results above and determine the relationship between the target institution and risk entity. Return your analysis as JSON following the structure defined in the system instruction.`;
  }

  
  private formatSearchResultOptimized(
    analysisResults: OSINTAnalysisResult[],
    optimizedResults: OptimizedSerpResults
  ): SearchResult {

    // Combine all findings into the expected format
    const combinedFindings: OSINTFinding[] = analysisResults.map(result => ({
      risk_item: result.risk_item,
      institution_A: result.institution_A,
      relationship_type: result.relationship_type,
      finding_summary: result.finding_summary,
      finding_summary_with_citations: result.finding_summary_with_citations,
      potential_intermediary_B: result.affiliated_company, // 映射新字段名到前端兼容字段名
      sources: result.sources,
      key_evidence: result.key_evidence,
      evidence_quality: result.evidence_quality,
      citations: result.citations
    }));

    // Collect all unique sources
    const allSources = [...new Set(
      analysisResults.flatMap(result => result.sources)
    )].filter(source => source);

    // Calculate overall confidence
    const avgConfidence = analysisResults.length > 0
      ? analysisResults.reduce((sum, r) => sum + r.analysis_metadata.confidence_score, 0) / analysisResults.length
      : 0.1;

    return {
      success: true,
      data: combinedFindings,
      metadata: {
        total_risk_entities: analysisResults.length,
        analysis_timestamp: new Date().toISOString(),
        search_execution_summary: optimizedResults.executionSummary,
        overall_confidence: avgConfidence,
        methodology: 'WebSearch Meta-Prompt + Optimized Multi-Engine SERP + AI Analysis'
      },
      sources: allSources,
      workflow_metadata: {
        optimization_applied: true,
        optimization_stats: optimizedResults.optimizationMetadata,
        execution_time_ms: optimizedResults.optimizationMetadata.processingTime,
        relationship_likelihood: "high",
        serp_execution_summary: optimizedResults.executionSummary
      }
    };
  }
}