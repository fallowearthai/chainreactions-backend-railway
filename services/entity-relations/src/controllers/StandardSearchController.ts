import { Request, Response } from 'express';
import { GeminiService } from '../services/GeminiService';
import { NormalSearchRequest, NormalSearchResult, FormattedSearchOutput, OptimizedSearchResponse, SourceInfo, QualityMetrics } from '../types/gemini';
import { FeatureFlags } from '../utils/FeatureFlags';

export class StandardSearchController {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  /**
   * Standard Search response formatter - simplified for Standard Search only
   * Only includes essential information, no complex DeepThinking features
   */
  private formatStandardSearchResults(
    result: any,
    processingTime?: number
  ): any {
    // Handle intermediary_B array conversion to string
    let intermediaryString = 'None';
    if (Array.isArray(result.potential_intermediary_B) && result.potential_intermediary_B.length > 0) {
      intermediaryString = result.potential_intermediary_B.join(', ');
    } else if (typeof result.potential_intermediary_B === 'string' && result.potential_intermediary_B) {
      intermediaryString = result.potential_intermediary_B;
    }

    // Process sources from Standard Search result - keep it simple
    const sources: SourceInfo[] = [];
    if (result.sources && Array.isArray(result.sources)) {
      result.sources.forEach((sourceUrl: string, index: number) => {
        if (typeof sourceUrl === 'string' && sourceUrl.trim()) {
          sources.push({
            id: index + 1,
            url: sourceUrl.trim(),
            title: `Source ${index + 1}`
          });
        }
      });
    }

    return {
      version: '2.1.0',
      success: true,
      data: {
        // Only core business data - no unnecessary complexity
        risk_item: result.risk_item || 'Unknown Risk Item',
        institution_A: result.institution_A || 'Unknown Institution',
        relationship_type: result.relationship_type || 'Unknown',
        finding_summary: result.finding_summary || 'No clear findings established.',
        potential_intermediary_B: intermediaryString,

        // Simple source data
        sources: sources,
        sources_count: sources.length,

        // Simple evidence quality - no complex metrics
        quality_metrics: {
          source_quality_score: 0.6
        }
      },

      metadata: {
        timestamp: new Date().toISOString(),
        processing_time_ms: processingTime,
        search_mode: 'standard'
      }
    };
  }

  // Legacy formatSearchResults() function removed - now only using Optimized Format v2.1.0

  async handleStandardSearch(req: Request, res: Response): Promise<void> {
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

      console.log('📨 Standard Search Request:', searchRequest);

      // Execute search using GeminiService's verifyCompanyEntity method
      const startTime = Date.now();
      const result = await this.geminiService.verifyCompanyEntity(
        searchRequest.Risk_Entity,
        searchRequest.Location,
        searchRequest.Target_institution,
        {
          start: searchRequest.Start_Date,
          end: searchRequest.End_Date
        }
      );

      // 🔍 [DEBUG] Log the raw result from GeminiService
      console.log('🔍 [STANDARD DEBUG] Raw GeminiService result:', {
        result_type: typeof result,
        result_value: result,
        is_null: result === null,
        is_undefined: result === undefined,
        is_empty_object: result && Object.keys(result).length === 0,
        keys: result ? Object.keys(result) : 'no keys'
      });

      // Handle no result case - simplified Standard Search format
      if (!result) {
        console.log('❌ [STANDARD DEBUG] Triggering fallback response - result is falsy');
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
            quality_metrics: {
              source_quality_score: 0.3
            }
          },
          metadata: {
            timestamp: new Date().toISOString(),
            search_mode: 'standard'
          }
        });
        console.log('✅ Returned simplified Standard Search format (no results)');
        return;
      }

      // ✅ [DEBUG] We have a valid result - process it normally
      console.log('✅ [STANDARD DEBUG] Valid result received, processing normally...');

      // 🔧 [FIX] Extract actual data from array result
      const actualResult = Array.isArray(result) && result.length > 0 ? result[0] : result;

      console.log('🔍 [STANDARD DEBUG] Extracted actual result:', {
        is_array: Array.isArray(result),
        array_length: Array.isArray(result) ? result.length : 0,
        relationship_type: actualResult.relationship_type,
        finding_summary: actualResult.finding_summary?.substring(0, 100) + '...',
        sources_length: actualResult.sources?.length || 0,
        keys: Object.keys(actualResult)
      });

      // Always use Optimized Format v2.1.0
      const processingTime = Date.now() - startTime;

      // Use simplified Standard Search formatting
      const responseResult = this.formatStandardSearchResults(actualResult, processingTime);

      // 🔍 [DEBUG] Log simplified data
      console.log('🔍 [BACKEND DEBUG] Standard Search Data:', {
        sources_count: responseResult.data.sources_count,
        relationship_type: responseResult.data.relationship_type,
        search_mode: responseResult.metadata.search_mode
      });

      console.log('✅ Standard Search completed - Using simplified Standard Search format');
      res.status(200).json(responseResult);

    } catch (error) {
      console.error('❌ Standard Search Error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error during standard search',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'healthy',
      service: 'entity_relations_standard',
      version: '1.0.0',
      port: process.env.PORT || 3002,
      features: [
        'Google Web Search via Gemini API',
        'Multi-language OSINT analysis',
        'Time-range filtering',
        'Relationship type classification',
        'Standard Search mode (gemini-2.5-flash)'
      ]
    });
  }

  async getInfo(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      service: 'Entity Relations Standard Search',
      description: 'Google Web Search based OSINT analysis using Gemini AI - Standard Mode',
      search_method: 'Google Web Search (via Gemini gemini-2.5-flash)',
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
        intermediary_detection: true,
        fast_response: true
      },
      api_endpoints: {
        search: 'POST /api/standard-search',
        health: 'GET /api/standard/health',
        info: 'GET /api/standard/info'
      },
      request_format: {
        Target_institution: 'string (required)',
        Risk_Entity: 'string (required)',
        Location: 'string (required)',
        Start_Date: 'string (optional, YYYY-MM-DD)',
        End_Date: 'string (optional, YYYY-MM-DD)'
      },
      response_format: {
        result: 'Optimized Format v2.1.0',
        sources: 'Array of source objects',
        raw_data: {
          risk_item: 'string',
          institution_A: 'string',
          relationship_type: 'string',
          finding_summary: 'string',
          potential_intermediary_B: 'string',
          sources: 'array',
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