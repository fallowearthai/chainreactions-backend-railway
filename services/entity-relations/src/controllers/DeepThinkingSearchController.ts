import { Request, Response } from 'express';
import { GeminiDeepThinkingService } from '../services/GeminiDeepThinkingService';
import { NormalSearchRequest, NormalSearchResult, FormattedSearchOutput, OptimizedSearchResponse, SourceInfo, QualityMetrics } from '../types/gemini';
import { FeatureFlags } from '../utils/FeatureFlags';

export class DeepThinkingSearchController {
  private geminiService: GeminiDeepThinkingService;

  constructor() {
    this.geminiService = new GeminiDeepThinkingService();
  }

  /**
   * Enhanced response formatter v2.1.0 - optimized for frontend with full data support
   * Properly processes sources and key_evidence for complete frontend functionality
   */
  private formatOptimizedSearchResults(
    result: NormalSearchResult,
    processingTime?: number
  ): OptimizedSearchResponse {
    // Handle intermediary_B array conversion to string
    let intermediaryString = 'None';
    if (Array.isArray(result.potential_intermediary_B) && result.potential_intermediary_B.length > 0) {
      intermediaryString = result.potential_intermediary_B.join(', ');
    } else if (typeof result.potential_intermediary_B === 'string' && result.potential_intermediary_B) {
      intermediaryString = result.potential_intermediary_B;
    }

    // Process sources from raw result data and grounding metadata
    const sources: SourceInfo[] = [];
    const processedKeyEvidence: Array<{text: string; source_indices: number[]}> = [];

    // First try to get sources from result.sources (for Standard Search)
    if (result.sources && Array.isArray(result.sources)) {
      result.sources.forEach((sourceUrl, index) => {
        sources.push({
          id: index + 1,
          url: sourceUrl,
          title: `Source ${index + 1}`
        });
      });
    }
    // For DeepThinking Search, extract sources from grounding_chunks
    else if ((result as any).grounding_metadata?.grounding_chunks) {
      const groundingChunks = (result as any).grounding_metadata.grounding_chunks;
      console.log('🔧 [DEBUG] Processing grounding_chunks:', groundingChunks.length);
      groundingChunks.forEach((chunk: any, index: number) => {
        console.log(`🔧 [DEBUG] Processing chunk ${index}:`, {
          hasWeb: !!chunk.web,
          hasUri: !!chunk.web?.uri,
          uri: chunk.web?.uri,
          title: chunk.web?.title
        });
        if (chunk.web?.uri) {
          sources.push({
            id: index + 1,
            url: chunk.web.uri,
            title: chunk.web.title || `Source ${index + 1}`
          });
          console.log(`✅ [DEBUG] Added source ${index + 1}:`, chunk.web.uri);
        }
      });
      console.log('🔧 [DEBUG] Final sources array:', sources);
    }

    // Process key evidence from grounding metadata
    if ((result as any).grounding_metadata?.grounding_supports) {
      const groundingSupports = (result as any).grounding_metadata.grounding_supports;
      groundingSupports.forEach((support: any) => {
        if (support.segment && support.groundingChunkIndices) {
          processedKeyEvidence.push({
            text: support.segment.text || support.segment,
            source_indices: support.groundingChunkIndices
          });
        }
      });
    }

    // Calculate real quality metrics
    const sourceCount = sources.length;
    const evidenceCount = processedKeyEvidence.length;
    const coveragePercentage = sourceCount > 0 ? Math.min(100, (evidenceCount / sourceCount) * 100) : 0;

    const qualityMetrics: QualityMetrics = {
      evidence_count: evidenceCount,
      source_count: sourceCount,
      coverage_percentage: Math.round(coveragePercentage),
      source_quality_score: (result as any).quality_metrics?.source_quality_score || 0.6
    };

    // Determine enhanced mode
    const enhancedMode = FeatureFlags.shouldUseEnhancedGrounding();

    return {
      version: '2.1.0',
      success: true,
      data: {
        // Core business data
        risk_item: result.risk_item,
        institution_A: result.institution_A,
        relationship_type: result.relationship_type,
        finding_summary: result.finding_summary,
        potential_intermediary_B: intermediaryString,

        // Source data information (processed from raw result)
        sources: sources,
        sources_count: sourceCount,

        // Key evidence (processed from grounding metadata)
        key_evidence: processedKeyEvidence,

        // Quality metrics (calculated from real data)
        quality_metrics: qualityMetrics,

        // Grounding metadata (critical for inline citations)
        grounding_metadata: (result as any).grounding_metadata
      },

      // Metadata
      metadata: {
        timestamp: new Date().toISOString(),
        processing_time_ms: processingTime,
        enhanced_mode: enhancedMode,
        api_version: '1.0.0'
      }
    };
  }

  // Legacy formatSearchResults() function removed - now only using Optimized Format v2.1.0

  async handleDeepThinkingSearch(req: Request, res: Response): Promise<void> {
    try {
      const searchRequest: NormalSearchRequest = {
        Target_institution: req.body.Target_institution,
        Risk_Entity: req.body.Risk_Entity,
        Location: req.body.Location,
        Start_Date: req.body.Start_Date,
        End_Date: req.body.End_Date
      };

      // Validate required fields
      if (!searchRequest.Target_institution || !searchRequest.Risk_Entity) {
        res.status(400).json({
          error: 'Missing required fields: Target_institution, Risk_Entity'
        });
        return;
      }

      console.log('📨 DeepThinking Search Request:', searchRequest);

      // Execute search with feature flag support
      const startTime = Date.now();
      const { results } = await this.geminiService.executeSearch(searchRequest);

      // Handle no results case - Always use Optimized Format v2.1.0
      if (!results || results.length === 0) {
        res.status(200).json({
          version: '2.1.0',
          success: true,
          data: {
            risk_item: searchRequest.Risk_Entity,
            institution_A: searchRequest.Target_institution,
            relationship_type: 'No Evidence Found',
            finding_summary: 'After thorough search, no evidence of connection was found.',
            potential_intermediary_B: 'None',
            sources: [],
            sources_count: 0,
            key_evidence: [],
            quality_metrics: {
              evidence_count: 0,
              source_count: 0,
              coverage_percentage: 0
            }
          },
          metadata: {
            timestamp: new Date().toISOString(),
            enhanced_mode: false,
            api_version: '1.0.0'
          }
        });
        console.log('✅ Returned Optimized Format v2.1.0 (no results)');
        return;
      }

      // Always use Optimized Format v2.1.0
      const processingTime = Date.now() - startTime;
      const enhancedResult = results[0];
      const responseResult = this.formatOptimizedSearchResults(enhancedResult, processingTime);

      // Include grounding_supports data if available
      if (enhancedResult.grounding_metadata && enhancedResult.grounding_metadata.grounding_supports) {
        responseResult.data.grounding_metadata = enhancedResult.grounding_metadata;
      }

      // 🔍 [DEBUG] Log key evidence data
      console.log('🔍 [BACKEND DEBUG] Key Evidence Data:', {
        key_evidence_count: responseResult.data.key_evidence?.length || 0,
        key_evidence_sample: responseResult.data.key_evidence?.slice(0, 2),
        sources_count: responseResult.data.sources_count
      });

      console.log('✅ DeepThinking Search completed - Using Optimized Format v2.1.0');
      res.status(200).json(responseResult);

    } catch (error) {
      console.error('❌ DeepThinking Search Error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error during deepthinking search',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'healthy',
      service: 'entity_relations_deepthinking',
      version: '1.0.0',
      port: process.env.PORT || 4002,
      features: [
        'Google Web Search via Gemini API',
        'Multi-language OSINT analysis',
        'Time-range filtering',
        'Relationship type classification'
      ]
    });
  }

  async getInfo(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      service: 'Entity Relations DeepThinking Search',
      description: 'Google Web Search based OSINT analysis using Gemini AI - DeepThinking Mode',
      search_method: 'Google Web Search (via Gemini googleSearch tool)',
      capabilities: {
        multi_language: true,
        time_range_filtering: true,
        relationship_types: [
          'Direct',
          'Indirect',
          'Significant Mention',
          'Unknown',
          'No Evidence Found'
        ],
        intermediary_detection: true
      },
      api_endpoints: {
        search: 'POST /api/deepthinking-search',
        health: 'GET /api/health',
        info: 'GET /api/info'
      },
      request_format: {
        Target_institution: 'string (required)',
        Risk_Entity: 'string (required)',
        Location: 'string (required)',
        Start_Date: 'string (optional, YYYY-MM-DD)',
        End_Date: 'string (optional, YYYY-MM-DD)'
      },
      response_format: {
        result: 'Formatted text output',
        urls: 'Numbered source URLs',
        raw_data: {
          risk_item: 'string',
          institution_A: 'string',
          relationship_type: 'string',
          finding_summary: 'string',
          potential_intermediary_B: 'array',
          urls: 'string',
          sources_count: 'number'
        }
      }
    });
  }

  /**
   * Validate if a URL is from a high-quality source
   */
  private isValidSourceUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    const urlLower = url.toLowerCase();

    // Exclude social media and low-quality sources
    const excludedPatterns = [
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'linkedin.com',
      'youtube.com',
      'tiktok.com',
      'reddit.com',
      'pinterest.com',
      'tumblr.com',
      'bit.ly',
      'tinyurl.com',
      'goo.gl',
      'ow.ly',
      'bit.do',
      't.co',
      'fb.me'
    ];

    for (const pattern of excludedPatterns) {
      if (urlLower.includes(pattern)) {
        return false;
      }
    }

    // Check for valid URL format
    try {
      new URL(url);
    } catch {
      return false;
    }

    return true;
  }
}