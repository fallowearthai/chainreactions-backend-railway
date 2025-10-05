import { GeminiService } from './GeminiService';
import { SearchRequest, SearchResult, OSINTFinding } from '../types/gemini';
import { MetaPromptResult } from './WebSearchMetaPromptService';
import { OptimizedSerpResults, OptimizedSearchResult } from './ResultOptimizationService';

export interface OSINTAnalysisResult {
  risk_item: string;
  institution_A: string;
  relationship_type: 'Direct' | 'Indirect' | 'Significant Mention' | 'No Evidence Found';
  finding_summary: string;
  potential_intermediary_B?: string;
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
   - Finding summary: Clear narrative of the relationship (no inline citations required).
   - Key evidence: Each bullet point should end with its source citation [1], [2], etc., matching the sources array indices.
   - Example key_evidence format:
     * "Company A signed partnership agreement with Company B in 2023 [1]"
     * "Deal worth $5M reported by industry news [2]"
   - Specific details such as dates, transaction amounts, or named individuals when available.
   - Assessment of source credibility (e.g., official site, reputable news, academic publication).
   - Conservative classification: Only assign 'Direct' if there is unambiguous supporting evidence; for 'Indirect', name the intermediary.
4. Structure your output as a JSON object with the following fields:
{
  "relationship_type": "Direct|Indirect|Significant Mention|No Evidence Found",
  "finding_summary": "Concise narrative summary without inline citations",
  "Affiliated_entity": "Name of affiliated entity if Indirect, else null",
  "sources": ["List of URLs used as evidence"],
  "confidence_score": Numeric value between 0 and 1 reflecting certainty,
  "evidence_quality": "high|medium|low",
  "key_evidence": ["Evidence point with specific details [1]", "Another evidence point [2]", "..."]
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
      console.log('🧠 Starting AI analysis with optimized results...');
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
   * Enhanced integration method with progress callbacks for SSE
   */
  async integrateAndAnalyzeOptimizedWithProgress(
    request: SearchRequest,
    metaPromptResult: MetaPromptResult,
    optimizedResults: OptimizedSerpResults,
    progressCallback: (progress: string) => void
  ): Promise<SearchResult> {

    try {
      console.log('🧠 Starting AI analysis with optimized results and progress...');
      progressCallback('Preparing AI analysis of search results...');

      const riskEntities = request.Risk_Entity.split(',').map(entity => entity.trim());
      const analysisResults: OSINTAnalysisResult[] = [];

      progressCallback(`Analyzing ${riskEntities.length} risk entities...`);

      // Analyze each risk entity separately using optimized results
      for (let i = 0; i < riskEntities.length; i++) {
        const riskEntity = riskEntities[i];
        progressCallback(`Analyzing entity ${i + 1}/${riskEntities.length}: ${riskEntity}`);

        progressCallback(`AI analyzing relationship for ${riskEntity}...`);
        const entityAnalysis = await this.analyzeEntityRelationshipOptimized(
          request,
          riskEntity,
          metaPromptResult,
          optimizedResults
        );
        progressCallback(`Completed analysis for ${riskEntity}`);
        analysisResults.push(entityAnalysis);

        progressCallback(`Completed analysis of entity ${i + 1}/${riskEntities.length}`);
      }

      progressCallback('Finalizing analysis results...');

      // Convert to the expected SearchResult format using optimized structure
      const finalResult = this.formatSearchResultOptimized(analysisResults, optimizedResults);

      progressCallback('AI analysis complete');

      return finalResult;

    } catch (error) {
      console.error('Optimized result integration failed:', error);
      progressCallback(`Error during AI analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to integrate optimized results: ${error}`);
    }
  }

  /**
   * Analyze entity relationship with progress updates
   */
  private async analyzeEntityRelationshipOptimizedWithProgress(
    request: SearchRequest,
    riskEntity: string,
    metaPromptResult: MetaPromptResult,
    optimizedResults: OptimizedSerpResults,
    progressCallback: (progress: string) => void
  ): Promise<OSINTAnalysisResult> {

    progressCallback(`Processing ${optimizedResults.consolidatedResults.length} search results for ${riskEntity}...`);

    // Use all optimized results - let AI handle entity relevance analysis
    console.log(`🔍 Using all ${optimizedResults.consolidatedResults.length} optimized results for AI analysis of entity: ${riskEntity}`);
    const relevantResults = optimizedResults.consolidatedResults;

    progressCallback(`Building analysis prompt with ${relevantResults.length} results...`);

    const analysisPrompt = this.buildOptimizedAnalysisPrompt(
      request,
      riskEntity,
      relevantResults,
      metaPromptResult
    );

    progressCallback(`Sending analysis request to AI for ${riskEntity}...`);

    const systemInstruction = {
      parts: [{
        text: this.OSINT_ANALYST_SYSTEM_PROMPT
      }]
    };

    progressCallback(`AI processing relationship analysis for ${riskEntity}...`);

    // Retry mechanism for robust analysis
    let attempt = 1;
    const maxAttempts = 3;

    while (attempt <= maxAttempts) {
      try {
        progressCallback(`AI analysis attempt ${attempt}/${maxAttempts} for ${riskEntity}...`);

        const response = await this.geminiService.generateContent(
          [{
            parts: [{ text: analysisPrompt }]
          }],
          systemInstruction,
          [{
            urlContext: {}
          }], // URL context tool enabled (now limited to 20 URLs in Stage 2)
          {
            temperature: 0,
            thinkingConfig: {
              thinkingBudget: -1
            }
          }
        );

        progressCallback(`Processing AI response for ${riskEntity}...`);

        if (!response.candidates || !response.candidates[0] || !response.candidates[0].content || !response.candidates[0].content.parts || !response.candidates[0].content.parts[0]) {
          throw new Error('Invalid Gemini API response structure: Missing candidates or content');
        }

        let rawResponse = response.candidates[0].content.parts[0].text;
        if (!rawResponse) {
          throw new Error('Empty response from Gemini API');
        }

        console.log(`📝 Raw Gemini response length: ${rawResponse.length} chars`);
        console.log(`📝 Raw response preview: ${rawResponse.substring(0, 200)}...`);

        // Use enhanced JSON parsing with fallback strategies
        const analysisJson = this.parseJsonWithFallback(rawResponse, riskEntity);

        progressCallback(`Successfully analyzed ${riskEntity}`);

        return {
          risk_item: riskEntity,
          institution_A: request.Target_institution,
          relationship_type: analysisJson.relationship_type || 'No Evidence Found',
          finding_summary: analysisJson.finding_summary || 'No significant evidence found.',
          potential_intermediary_B: analysisJson.potential_affiliated_entity || analysisJson.Affiliated_entity,
          sources: analysisJson.sources || [],
          key_evidence: analysisJson.key_evidence || [],
          evidence_quality: analysisJson.evidence_quality || 'medium',
          analysis_metadata: {
            confidence_score: analysisJson.confidence_score || 0.1,
            sources_analyzed: relevantResults.length,
            search_keywords_used: metaPromptResult.search_strategy.search_keywords,
            engines_used: optimizedResults.executionSummary.enginesUsed,
            analysis_timestamp: new Date().toISOString()
          }
        };

      } catch (error) {
        console.error(`Analysis attempt ${attempt} failed for ${riskEntity}:`, error);

        if (attempt === maxAttempts) {
          progressCallback(`Failed to analyze ${riskEntity} after ${maxAttempts} attempts`);
          console.error(`Optimized analysis failed for ${riskEntity} after ${maxAttempts} attempts:`, error);
          throw new Error(`AI analysis failed for ${riskEntity} after ${maxAttempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        progressCallback(`Retrying analysis for ${riskEntity} (attempt ${attempt + 1}/${maxAttempts})...`);
        attempt++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // This should never be reached as errors are thrown in the loop
    console.error(`Analysis failed for ${riskEntity} after ${maxAttempts} attempts`);
    throw new Error(`AI analysis failed for ${riskEntity} after ${maxAttempts} attempts`);
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
   * Parse JSON with multiple fallback strategies
   */
  private parseJsonWithFallback(rawResponse: string, entityName: string): any {
    // Strategy 1: Clean and parse
    let cleaned = this.cleanAndRepairJsonResponse(rawResponse);

    try {
      return JSON.parse(cleaned);
    } catch (error1) {
      console.warn(`❌ JSON parse failed for ${entityName} (attempt 1):`, error1);
      console.log(`📝 Cleaned response: ${cleaned.substring(0, 500)}...`);

      // Strategy 2: Attempt repair and parse
      try {
        const repaired = this.attemptJsonRepair(cleaned);
        console.log(`📝 Repaired response (first 500 chars): ${repaired.substring(0, 500)}...`);
        return JSON.parse(repaired);
      } catch (error2) {
        console.warn(`❌ JSON parse failed for ${entityName} (attempt 2):`, error2);

        // Strategy 3: Aggressive string cleaning for JSON
        try {
          const aggressiveCleaned = this.aggressiveJsonCleaning(cleaned);
          console.log(`📝 Aggressively cleaned response (first 500 chars): ${aggressiveCleaned.substring(0, 500)}...`);
          return JSON.parse(aggressiveCleaned);
        } catch (error3) {
          console.warn(`❌ JSON parse failed for ${entityName} (attempt 3):`, error3);

          // Strategy 4: Extract information from text and reconstruct JSON
          try {
            console.log(`🔧 Attempting text extraction strategy for ${entityName}...`);
            const reconstructedJson = this.extractJsonFromText(rawResponse, entityName);
            console.log(`✅ Successfully reconstructed JSON from text for ${entityName}`);
            return reconstructedJson;
          } catch (error4) {
            console.warn(`❌ Text extraction failed for ${entityName} (attempt 4):`, error4);

            // Strategy 5: Log full response and throw detailed error
            console.error(`❌ FULL RAW RESPONSE for ${entityName}:`, rawResponse);
            console.error(`❌ FULL CLEANED RESPONSE for ${entityName}:`, cleaned);

            throw new Error(`JSON parsing failed for ${entityName}. Original error: ${error1 instanceof Error ? error1.message : String(error1)}. Repair attempt error: ${error2 instanceof Error ? error2.message : String(error2)}. Aggressive cleaning error: ${error3 instanceof Error ? error3.message : String(error3)}. Text extraction error: ${error4 instanceof Error ? error4.message : String(error4)}`);
          }
        }
      }
    }
  }

  /**
   * Extract structured information from text response and reconstruct JSON
   * Fallback strategy when Gemini returns text analysis instead of JSON
   */
  private extractJsonFromText(textResponse: string, entityName: string): any {
    console.log(`🔍 Extracting information from text for ${entityName}...`);

    // Extract relationship type
    let relationship_type = 'No Evidence Found';
    const relationshipMatch = textResponse.match(/relationship type should be ["']?(Direct|Indirect|Significant Mention|No Evidence Found)["']?/i) ||
                             textResponse.match(/relationship.*is.*["']?(Direct|Indirect|Significant Mention|No Evidence Found)["']?/i) ||
                             textResponse.match(/\*\*Relationship Type:\*\*\s*["']?(Direct|Indirect|Significant Mention|No Evidence Found)["']?/i);
    if (relationshipMatch) {
      relationship_type = relationshipMatch[1];
    }

    // Extract finding summary
    let finding_summary = '';
    const summaryMatch = textResponse.match(/\*\*Finding Summary:\*\*\s*([\s\S]*?)(?=\*\*|$)/i) ||
                        textResponse.match(/finding[_ ]summary[:\s]+([\s\S]*?)(?=\n\*\*|$)/i);
    if (summaryMatch) {
      finding_summary = summaryMatch[1].trim().replace(/\n+/g, ' ');
    }

    // Extract affiliated entity / intermediary
    let Affiliated_entity = null;
    const affiliatedMatch = textResponse.match(/\*\*Affiliated Entity:\*\*\s*([^\n]+)/i) ||
                           textResponse.match(/affiliated[_ ]entity[:\s]+([^\n]+)/i) ||
                           textResponse.match(/potential[_ ]intermediary[:\s]+([^\n]+)/i);
    if (affiliatedMatch) {
      Affiliated_entity = affiliatedMatch[1].trim();
      // Clean up any markdown or extra formatting
      Affiliated_entity = Affiliated_entity.replace(/\*\*/g, '').replace(/["']/g, '').trim();
      if (Affiliated_entity.toLowerCase() === 'null' || Affiliated_entity.toLowerCase() === 'none') {
        Affiliated_entity = null;
      }
    }

    // Extract sources
    const sources: string[] = [];
    const sourcesMatch = textResponse.match(/\*\*Sources:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/i) ||
                        textResponse.match(/sources?[:\s]+([\s\S]*?)(?=\n\*\*|$)/i);
    if (sourcesMatch) {
      const sourceText = sourcesMatch[1];
      // Extract URLs using regex
      const urlMatches = sourceText.match(/https?:\/\/[^\s\)]+/g);
      if (urlMatches) {
        sources.push(...urlMatches);
      }
    }

    // Extract key evidence
    const key_evidence: string[] = [];
    const evidenceMatch = textResponse.match(/\*\*Key Evidence:\*\*\s*([\s\S]*?)(?=\n\*\*|$)/i) ||
                         textResponse.match(/key[_ ]evidence[:\s]+([\s\S]*?)(?=\n\*\*|$)/i);
    if (evidenceMatch) {
      const evidenceText = evidenceMatch[1];
      // Split by bullet points or line breaks
      const evidenceItems = evidenceText.split(/\n\s*[\*\-•]\s*/);
      key_evidence.push(...evidenceItems.filter(item => item.trim().length > 0).map(item => item.trim()));
    }

    // Extract confidence score
    let confidence_score = 0.5;
    const confidenceMatch = textResponse.match(/\*\*Confidence Score:\*\*\s*([\d.]+)/i) ||
                           textResponse.match(/confidence[_ ]score[:\s]+([\d.]+)/i);
    if (confidenceMatch) {
      confidence_score = parseFloat(confidenceMatch[1]);
    }

    // Extract evidence quality
    let evidence_quality: 'high' | 'medium' | 'low' = 'medium';
    const qualityMatch = textResponse.match(/\*\*Evidence Quality:\*\*\s*(high|medium|low)/i) ||
                        textResponse.match(/evidence[_ ]quality[:\s]+(high|medium|low)/i);
    if (qualityMatch) {
      evidence_quality = qualityMatch[1].toLowerCase() as 'high' | 'medium' | 'low';
    }

    // Construct JSON object
    const reconstructedJson = {
      relationship_type,
      finding_summary: finding_summary || `Analysis for ${entityName} completed.`,
      Affiliated_entity,
      sources,
      confidence_score,
      evidence_quality,
      key_evidence: key_evidence.length > 0 ? key_evidence : ['Analysis based on available search results']
    };

    console.log(`📋 Reconstructed JSON for ${entityName}:`, JSON.stringify(reconstructedJson, null, 2));

    return reconstructedJson;
  }

  /**
   * Aggressive JSON cleaning for problematic responses
   */
  private aggressiveJsonCleaning(jsonString: string): string {
    let cleaned = jsonString;

    // Remove all control characters and non-printable characters
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

    // Fix string values that contain unescaped newlines
    cleaned = cleaned.replace(/("finding_summary"\s*:\s*"[^"]*?)[\r\n]+([^"]*?")/g, '$1 $2');
    cleaned = cleaned.replace(/("potential_affiliated_entity"\s*:\s*"[^"]*?)[\r\n]+([^"]*?")/g, '$1 $2');

    // Remove any remaining newlines within string values
    cleaned = cleaned.replace(/("\s*:\s*"[^"]*)\r?\n([^"]*")/g, '$1 $2');

    // Fix common JSON structure issues
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1'); // trailing commas
    cleaned = cleaned.replace(/([}\]])([{\[])/g, '$1,$2'); // missing commas between objects/arrays

    return cleaned;
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
      const response = await this.geminiService.generateContent(
        [{
          parts: [{ text: analysisPrompt }]
        }],
        systemInstruction,
        [{
          urlContext: {}
        }], // URL context tool for document analysis
        {
          temperature: 0,
          thinkingConfig: {
            thinkingBudget: -1
          }
        }
      );

      // Debug: Log the full Gemini response structure
      console.log('🔍 Stage 3: Full Gemini API Response:', JSON.stringify(response, null, 2));
      console.log('🔍 Stage 3: Response has candidates?', !!response.candidates);
      if (response.candidates) {
        console.log('🔍 Stage 3: Candidates length:', response.candidates.length);
        console.log('🔍 Stage 3: First candidate:', JSON.stringify(response.candidates[0], null, 2));
      }

      if (!response.candidates || !response.candidates[0] || !response.candidates[0].content || !response.candidates[0].content.parts || !response.candidates[0].content.parts[0]) {
        console.error('❌ Invalid Gemini response structure:', JSON.stringify(response, null, 2));
        throw new Error('Invalid Gemini API response structure: Missing candidates or content');
      }

      let rawResponse = response.candidates[0].content.parts[0].text;
      if (!rawResponse) {
        throw new Error('Empty response from Gemini API');
      }

      console.log(`📝 Raw Gemini response length: ${rawResponse.length} chars`);
      console.log(`📝 Raw response preview: ${rawResponse.substring(0, 200)}...`);

      // Use enhanced JSON parsing with fallback strategies
      const analysis = this.parseJsonWithFallback(rawResponse, riskEntity);

      return {
        risk_item: riskEntity,
        institution_A: request.Target_institution,
        relationship_type: analysis.relationship_type || 'No Evidence Found',
        finding_summary: analysis.finding_summary || 'No significant evidence found.',
        potential_intermediary_B: analysis.potential_affiliated_entity || analysis.Affiliated_entity,
        sources: analysis.sources || [],
        key_evidence: analysis.key_evidence || [],
        evidence_quality: analysis.evidence_quality || 'medium',
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
    metaPromptResult: MetaPromptResult
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
      potential_intermediary_B: result.potential_intermediary_B,
      sources: result.sources,
      key_evidence: result.key_evidence,
      evidence_quality: result.evidence_quality
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