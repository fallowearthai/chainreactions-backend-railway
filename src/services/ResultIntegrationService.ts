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
        text: `You are an expert OSINT analyst specializing in mapping institutional relationships and risk exposure. Your assignment is to examine search results and linked urls to determine the nature of relationships between specified target institutions and risk entities.

Instructions:
1. Review all provided search result snippets and use the URL context tool to thoroughly examine linked website and PDF documents for relevant information.
2. Categorize the relationship based on these definitions:
   - Direct: Explicit evidence (e.g., contracts, partnerships, formal collaborations) between the target and risk entity.
   - Indirect: Relationship exists via a clearly identified intermediary organization.
   - Significant Mention: Both entities are referenced together in a context that suggests relevance, but no direct or indirect link is established.
   - No Evidence Found: No meaningful connection identified in the sources.
3. For each finding, include:
   - Numbered inline citations in the finding_summary in [1], [2], etc., matching the search results.
   - Specific details such as dates, transaction amounts, or named individuals when available.
   - Assessment of source credibility (e.g., official site, reputable news, academic publication).
   - Conservative classification: Only assign 'Direct' if there is unambiguous supporting evidence; for 'Indirect', name the intermediary.
4. Structure your output as a JSON object with the following fields:
{
  "relationship_type": "Direct|Indirect|Significant Mention|No Evidence Found",
  "finding_summary": "Concise, evidence-based summary with numbered inline citations.",
  "potential_affiliated_entity": "Name of intermediary if Indirect, else null",
  "sources": ["List of URLs used as evidence"],
  "confidence_score": Numeric value between 0 and 1 reflecting certainty,
  "evidence_quality": "high|medium|low",
  "key_evidence": ["Bullet points of the strongest supporting facts"]
}

Prioritize factual accuracy, source attribution, and clarity in your analysis. Do not speculate or infer beyond the evidence presented.`
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
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingBudget: -1
          }
        }
      );

      if (!response.candidates || !response.candidates[0] || !response.candidates[0].content || !response.candidates[0].content.parts || !response.candidates[0].content.parts[0]) {
        throw new Error('Invalid Gemini API response structure: Missing candidates or content');
      }

      let rawResponse = response.candidates[0].content.parts[0].text;
      if (!rawResponse) {
        throw new Error('Empty response from Gemini API');
      }

      console.log(`📝 Raw Gemini response length: ${rawResponse.length} chars`);
      console.log(`📝 Raw response preview: ${rawResponse.substring(0, 200)}...`);

      let analysis;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          analysis = JSON.parse(rawResponse);
          break; // Success, exit retry loop
        } catch (parseError) {
          retryCount++;
          console.warn(`JSON parse failed (attempt ${retryCount}/${maxRetries + 1}):`, parseError);

          if (retryCount > maxRetries) {
            throw new Error(`Failed to parse JSON after ${maxRetries + 1} attempts: ${parseError}`);
          }

          console.log(`🔄 Retrying with thinking mode (attempt ${retryCount + 1})...`);

          // Retry with same thinking mode configuration
          const retryResponse = await this.geminiService.generateContent(
            [{
              parts: [{ text: analysisPrompt }]
            }],
            systemInstruction,
            [{
              urlContext: {}
            }], // URL context tool for retry
            {
              temperature: 0,
              responseMimeType: "application/json",
              thinkingConfig: {
                thinkingBudget: -1
              }
            }
          );

          if (!retryResponse.candidates || !retryResponse.candidates[0] || !retryResponse.candidates[0].content || !retryResponse.candidates[0].content.parts || !retryResponse.candidates[0].content.parts[0]) {
            throw new Error(`Invalid Gemini API response structure on retry ${retryCount}`);
          }

          rawResponse = retryResponse.candidates[0].content.parts[0].text;
          if (!rawResponse) {
            throw new Error(`Empty response from Gemini API on retry ${retryCount}`);
          }

          console.log(`🔄 Retry ${retryCount} response length: ${rawResponse.length} chars`);
        }
      }

      return {
        risk_item: riskEntity,
        institution_A: request.Target_institution,
        relationship_type: analysis.relationship_type || 'No Evidence Found',
        finding_summary: analysis.finding_summary || 'No significant evidence found.',
        potential_intermediary_B: analysis.potential_intermediary_B,
        sources: analysis.sources || [],
        analysis_metadata: {
          confidence_score: analysis.confidence_score || 0.1,
          sources_analyzed: relevantResults.length,
          search_keywords_used: metaPromptResult.search_strategy.search_keywords,
          engines_used: optimizedResults.executionSummary.enginesUsed,
          analysis_timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.warn(`Optimized analysis failed for ${riskEntity}:`, error);
      return this.createOptimizedFallbackAnalysis(request, riskEntity, relevantResults);
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

  private createOptimizedFallbackAnalysis(
    request: SearchRequest,
    riskEntity: string,
    relevantResults: OptimizedSearchResult[]
  ): OSINTAnalysisResult {

    return {
      risk_item: riskEntity,
      institution_A: request.Target_institution,
      relationship_type: 'No Evidence Found',
      finding_summary: `Analysis could not be completed due to technical issues. ${relevantResults.length} potentially relevant sources were identified but could not be properly analyzed.`,
      sources: relevantResults.slice(0, 5).map(r => r.url).filter(url => url),
      analysis_metadata: {
        confidence_score: 0.1,
        sources_analyzed: relevantResults.length,
        search_keywords_used: [],
        engines_used: [],
        analysis_timestamp: new Date().toISOString()
      }
    };
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
      sources: result.sources
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