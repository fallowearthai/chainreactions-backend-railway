import { Request, Response } from 'express';
import { GeminiNormalSearchService } from '../services/GeminiNormalSearchService';
import { NormalSearchRequest, NormalSearchResult, FormattedSearchOutput, OptimizedSearchResponse, SourceInfo, QualityMetrics } from '../types/gemini';
import { FeatureFlags } from '../utils/FeatureFlags';

export class NormalSearchController {
  private geminiService: GeminiNormalSearchService;

  constructor() {
    this.geminiService = new GeminiNormalSearchService();
  }

  /**
   * Optimized response formatter v2.1.0 - eliminates data redundancy
   * Returns flattened structure with no repeated data (formatted_display removed)
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

    // Process sources into structured array
    const sources: SourceInfo[] = [];
    let validSourceCount = 0;

    if (result.sources && result.sources.length > 0) {
      result.sources.forEach((url, index) => {
        // Include all URLs - trust Gemini's quality judgment
        if (url && typeof url === 'string' && url.trim().length > 0) {
          validSourceCount++;
          sources.push({
            id: validSourceCount,
            url: url.trim()
          });
        }
      });
    }

    // Process key_evidence with proper validation and source index mapping
    let processedKeyEvidence: Array<{text: string; source_indices: number[]}> = [];
    if ((result as any).key_evidence && Array.isArray((result as any).key_evidence)) {
      processedKeyEvidence = (result as any).key_evidence
        .filter((evidence: any) => evidence && evidence.text && evidence.source_indices)
        .map((evidence: any) => {
          // Validate and filter source indices to match actual valid sources
          const validSourceIndices = evidence.source_indices
            .filter((idx: number) => idx > 0 && idx <= validSourceCount);

          return {
            text: evidence.text,
            source_indices: validSourceIndices  // Already 1-based from service layer
          };
        })
        .filter((evidence: any) => evidence.source_indices.length > 0); // Only keep evidence with valid sources
    }

    // Create quality metrics (required in v2.1.0)
    const qualityMetrics: QualityMetrics = {
      evidence_count: processedKeyEvidence.length,
      source_count: validSourceCount,
      coverage_percentage: validSourceCount > 0 ? Math.round((processedKeyEvidence.length / validSourceCount) * 100) : 0,
      source_quality_score: (result as any).quality_metrics?.source_quality_score
    };

    // Determine enhanced mode
    const enhancedMode = FeatureFlags.shouldUseEnhancedGrounding();

    return {
      version: '2.1.0',
      success: true,
      data: {
        // Core business data (flattened, no redundancy)
        risk_item: result.risk_item,
        institution_A: result.institution_A,
        relationship_type: result.relationship_type,
        finding_summary: result.finding_summary,
        potential_intermediary_B: intermediaryString,

        // Source data information (structured)
        sources: sources,
        sources_count: validSourceCount,

        // Key evidence with source mapping
        key_evidence: processedKeyEvidence,

        // Quality metrics (required)
        quality_metrics: qualityMetrics
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

  async handleNormalSearch(req: Request, res: Response): Promise<void> {
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

      console.log('📨 Normal Search Request:', searchRequest);

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

      // 🔍 [DEBUG] Log key evidence data
      console.log('🔍 [BACKEND DEBUG] Key Evidence Data:', {
        key_evidence_count: responseResult.data.key_evidence?.length || 0,
        key_evidence_sample: responseResult.data.key_evidence?.slice(0, 2),
        sources_count: responseResult.data.sources_count
      });

      console.log('✅ Normal Search completed - Using Optimized Format v2.1.0');
      res.status(200).json(responseResult);

    } catch (error) {
      console.error('❌ Normal Search Error:', error);
      res.status(500).json({
        error: 'Internal server error during normal search',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'healthy',
      service: 'entity_relations_normal',
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
      service: 'Entity Relations Normal Search',
      description: 'Google Web Search based OSINT analysis using Gemini AI',
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
        search: 'POST /api/normal-search',
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