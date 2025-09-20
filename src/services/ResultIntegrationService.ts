import { GeminiService } from './GeminiService';
import { SearchRequest, SearchResult, OSINTFinding } from '../types/gemini';
import { AggregatedSerpResults } from './SerpExecutorService';
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

  async integrateAndAnalyze(
    request: SearchRequest,
    metaPromptResult: MetaPromptResult,
    serpResults: AggregatedSerpResults
  ): Promise<SearchResult> {

    try {
      const riskEntities = request.Risk_Entity.split(',').map(entity => entity.trim());
      const analysisResults: OSINTAnalysisResult[] = [];

      // Analyze each risk entity separately
      for (const riskEntity of riskEntities) {
        const entityAnalysis = await this.analyzeEntityRelationship(
          request,
          riskEntity,
          metaPromptResult,
          serpResults
        );
        analysisResults.push(entityAnalysis);
      }

      // Convert to the expected SearchResult format
      return this.formatSearchResult(request, analysisResults, serpResults);

    } catch (error) {
      console.error('Result integration failed:', error);
      throw new Error(`Failed to integrate results: ${error}`);
    }
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
      return this.formatSearchResultOptimized(request, analysisResults, optimizedResults);

    } catch (error) {
      console.error('Optimized result integration failed:', error);
      throw new Error(`Failed to integrate optimized results: ${error}`);
    }
  }

  private async analyzeEntityRelationship(
    request: SearchRequest,
    riskEntity: string,
    metaPromptResult: MetaPromptResult,
    serpResults: AggregatedSerpResults
  ): Promise<OSINTAnalysisResult> {

    // Filter results relevant to this specific risk entity
    const relevantResults = this.filterRelevantResults(
      serpResults.consolidatedResults,
      request.Target_institution,
      riskEntity
    );

    const analysisPrompt = this.buildAnalysisPrompt(
      request,
      riskEntity,
      relevantResults,
      metaPromptResult
    );

    try {
      const response = await this.geminiService.generateContent(
        [{
          parts: [{ text: analysisPrompt }]
        }],
        undefined, // no system instruction
        undefined, // no tools
        {
          temperature: 0.1, // Low temperature for consistent analysis
          maxOutputTokens: 3000,
          responseMimeType: "application/json"
        }
      );

      const analysis = JSON.parse(response.candidates[0].content.parts[0].text || '{}');

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
          engines_used: serpResults.executionSummary.enginesUsed,
          analysis_timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.warn(`Analysis failed for ${riskEntity}:`, error);
      return this.createFallbackAnalysis(request, riskEntity, relevantResults);
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

    // Filter optimized results relevant to this specific risk entity
    const relevantResults = this.filterOptimizedResults(
      optimizedResults.consolidatedResults,
      request.Target_institution,
      riskEntity
    );

    const analysisPrompt = this.buildOptimizedAnalysisPrompt(
      request,
      riskEntity,
      relevantResults,
      metaPromptResult
    );

    try {
      const response = await this.geminiService.generateContent(
        [{
          parts: [{ text: analysisPrompt }]
        }],
        undefined, // no system instruction
        undefined, // no tools
        {
          temperature: 0.1, // Low temperature for consistent analysis
          maxOutputTokens: 3000,
          responseMimeType: "application/json"
        }
      );

      const analysis = JSON.parse(response.candidates[0].content.parts[0].text || '{}');

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

  private filterRelevantResults(
    results: any[],
    institution: string,
    riskEntity: string
  ): any[] {

    const institutionTerms = institution.toLowerCase().split(' ');
    const riskTerms = riskEntity.toLowerCase().split(' ');

    return results.filter(result => {
      const text = `${result.title} ${result.snippet}`.toLowerCase();

      // Must contain at least one term from institution
      const hasInstitution = institutionTerms.some(term => text.includes(term));

      // Must contain at least one term from risk entity
      const hasRiskEntity = riskTerms.some(term => text.includes(term));

      return hasInstitution && hasRiskEntity;
    }).slice(0, 30); // Limit to top 30 most relevant results
  }

  private buildAnalysisPrompt(
    request: SearchRequest,
    riskEntity: string,
    relevantResults: any[],
    metaPromptResult: MetaPromptResult
  ): string {

    const resultsText = relevantResults
      .slice(0, 20) // Limit to prevent token overflow
      .map((result, index) =>
        `[${index + 1}] ${result.title}\n${result.snippet}\nURL: ${result.url}\nEngine: ${result.searchMetadata?.engine}\n`
      ).join('\n');

    const timeConstraint = request.Start_Date && request.End_Date
      ? `Focus on relationships within the timeframe ${request.Start_Date} to ${request.End_Date}.`
      : '';

    return `You are an expert OSINT analyst. Analyze the search results to determine the relationship between the target institution and risk entity.

TARGET INSTITUTION: ${request.Target_institution}
RISK ENTITY: ${riskEntity}
GEOGRAPHIC CONTEXT: ${request.Location}
${timeConstraint}

SEARCH RESULTS TO ANALYZE:
${resultsText}

ANALYSIS CONTEXT:
- Relationship likelihood: ${metaPromptResult.search_strategy.relationship_likelihood}
- Search keywords used: ${metaPromptResult.search_strategy.search_keywords.join(', ')}
- Sources analyzed: ${relevantResults.length}

TASK: Determine the relationship type and provide detailed analysis.

Return JSON with this exact structure:
{
  "relationship_type": "Direct|Indirect|Significant Mention|No Evidence Found",
  "finding_summary": "Detailed summary with numbered citations [1], [2], etc. matching the search results above",
  "potential_intermediary_B": "Name of any intermediary organization if Indirect relationship",
  "sources": ["List of relevant URLs from the search results"],
  "confidence_score": 0.85,
  "evidence_quality": "high|medium|low",
  "key_evidence": ["Bullet points of strongest evidence found"]
}

RELATIONSHIP TYPE DEFINITIONS:
- "Direct": Clear evidence of official partnership, contract, collaboration, or direct relationship
- "Indirect": Relationship exists through intermediary organizations or third parties
- "Significant Mention": Both entities mentioned together in meaningful context but no clear relationship
- "No Evidence Found": No meaningful connection found in the available sources

ANALYSIS REQUIREMENTS:
1. Use numbered citations [1], [2] that correspond to the search results above
2. Include specific dates, amounts, or details when available
3. Assess source credibility (official websites, news outlets, academic papers)
4. Consider the geographic and political context of ${request.Location}
5. Be conservative - only claim "Direct" relationship with strong evidence
6. For "Indirect" relationships, clearly identify the intermediary organization

Focus on factual, verifiable information with proper source attribution.`;
  }

  private createFallbackAnalysis(
    request: SearchRequest,
    riskEntity: string,
    relevantResults: any[]
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

  private formatSearchResult(
    request: SearchRequest,
    analysisResults: OSINTAnalysisResult[],
    serpResults: AggregatedSerpResults
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
        search_execution_summary: serpResults.executionSummary,
        overall_confidence: avgConfidence,
        methodology: 'WebSearch Meta-Prompt + Multi-Engine SERP + AI Analysis'
      },
      sources: allSources
    };
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

  private filterOptimizedResults(
    results: OptimizedSearchResult[],
    institution: string,
    riskEntity: string
  ): OptimizedSearchResult[] {

    const institutionTerms = institution.toLowerCase().split(' ');
    const riskTerms = riskEntity.toLowerCase().split(' ');

    return results.filter(result => {
      const text = `${result.title} ${result.snippet}`.toLowerCase();

      // Must contain at least one term from institution
      const hasInstitution = institutionTerms.some(term => text.includes(term));

      // Must contain at least one term from risk entity
      const hasRiskEntity = riskTerms.some(term => text.includes(term));

      return hasInstitution && hasRiskEntity;
    }).slice(0, 20); // Use top 20 since results are already scored and sorted
  }

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

    return `You are an expert OSINT analyst. Analyze the pre-scored and optimized search results to determine the relationship between the target institution and risk entity.

TARGET INSTITUTION: ${request.Target_institution}
RISK ENTITY: ${riskEntity}
GEOGRAPHIC CONTEXT: ${request.Location}
${timeConstraint}

OPTIMIZED SEARCH RESULTS (Pre-scored by relevance):
${resultsText}

ANALYSIS CONTEXT:
- Relationship likelihood: ${metaPromptResult.search_strategy.relationship_likelihood}
- Search keywords used: ${metaPromptResult.search_strategy.search_keywords.join(', ')}
- Sources analyzed: ${relevantResults.length} (from ${relevantResults.reduce((sum, r) => sum + r.searchKeywords.length, 0)} search queries)
- Results are pre-filtered and scored for relevance

TASK: Determine the relationship type and provide detailed analysis.

Return JSON with this exact structure:
{
  "relationship_type": "Direct|Indirect|Significant Mention|No Evidence Found",
  "finding_summary": "Detailed summary with numbered citations [1], [2], etc. matching the search results above",
  "potential_intermediary_B": "Name of any intermediary organization if Indirect relationship",
  "sources": ["List of relevant URLs from the search results"],
  "confidence_score": 0.85,
  "evidence_quality": "high|medium|low",
  "key_evidence": ["Bullet points of strongest evidence found"]
}

RELATIONSHIP TYPE DEFINITIONS:
- "Direct": Clear evidence of official partnership, contract, collaboration, or direct relationship
- "Indirect": Relationship exists through intermediary organizations or third parties
- "Significant Mention": Both entities mentioned together in meaningful context but no clear relationship
- "No Evidence Found": No meaningful connection found in the available sources

ANALYSIS REQUIREMENTS:
1. Use numbered citations [1], [2] that correspond to the search results above
2. Consider the relevance scores - higher scores indicate more relevant results
3. Include specific dates, amounts, or details when available
4. Assess source credibility (official websites, news outlets, academic papers)
5. Consider the geographic and political context of ${request.Location}
6. Be conservative - only claim "Direct" relationship with strong evidence
7. For "Indirect" relationships, clearly identify the intermediary organization

Focus on factual, verifiable information with proper source attribution.`;
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
    request: SearchRequest,
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