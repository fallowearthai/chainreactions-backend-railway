import { Request, Response, NextFunction } from 'express';
import { EnhancedEntitySearchService } from '../services/EnhancedEntitySearchService';
import { EnhancedEntitySearchWithDatasetService } from '../services/EnhancedEntitySearchWithDatasetService';
import {
  EnhancedEntitySearchRequest,
  EnhancedEntitySearchResponse,
  EnhancedEntitySearchWithDatasetRequest,
  EnhancedEntitySearchWithDatasetResponse
} from '../types/enhanced-types';

export class EntitySearchController {
  private enhancedSearchService: EnhancedEntitySearchService;
  private enhancedSearchWithDatasetService: EnhancedEntitySearchWithDatasetService;

  constructor() {
    this.enhancedSearchService = new EnhancedEntitySearchService();
    this.enhancedSearchWithDatasetService = new EnhancedEntitySearchWithDatasetService();
  }

  /**
   * POST /api/entity-search
   * Enhanced entity search using Google Search via Gemini API
   * Includes automatic risk keyword analysis
   */
  async handleEntitySearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        company_name,
        location,
        include_risk_analysis = true,
        custom_risk_keywords
      }: EnhancedEntitySearchRequest = req.body;

      // Validate required fields
      if (!company_name) {
        res.status(400).json({
          success: false,
          company: '',
          error: 'company_name is required',
          metadata: {
            search_duration_ms: 0,
            total_sources: 0,
            search_queries_executed: 0,
            api_calls_made: 0
          }
        } as EnhancedEntitySearchResponse);
        return;
      }

      console.log('📥 Enhanced entity search request:', {
        company: company_name,
        location: location || 'not specified',
        include_risk_analysis,
        custom_keywords: custom_risk_keywords?.length || 0
      });

      // Check if Enhanced service is configured
      if (!this.enhancedSearchService.isConfigured()) {
        res.status(503).json({
          success: false,
          company: company_name,
          location,
          error: 'Service not configured',
          metadata: {
            search_duration_ms: 0,
            total_sources: 0,
            search_queries_executed: 0,
            api_calls_made: 0
          }
        } as EnhancedEntitySearchResponse);
        return;
      }

      // Call Enhanced Search Service
      const searchRequest: EnhancedEntitySearchRequest = {
        company_name,
        location,
        include_risk_analysis,
        custom_risk_keywords
      };

      const searchResponse = await this.enhancedSearchService.searchEntity(searchRequest);

      // Log response details before sending
      const responseSize = JSON.stringify(searchResponse).length;
      const responseTime = new Date().toISOString();

      console.log('📤 Entity Search response ready:', {
        company: company_name,
        response_size_bytes: responseSize,
        response_size_kb: Math.round(responseSize / 1024 * 100) / 100,
        success: searchResponse.success,
        timestamp: responseTime,
        search_duration_ms: searchResponse.metadata?.search_duration_ms || 0
      });

      // Set proper headers for debugging
      res.setHeader('X-Response-Size', responseSize.toString());
      res.setHeader('X-Response-Timestamp', responseTime);
      res.setHeader('X-Service-Name', 'entity-search');

      console.log('🚀 Entity Search sending response - START');

      // Return response directly (service already formats correctly)
      res.json(searchResponse);

      console.log('✅ Entity Search response sent - COMPLETE');

    } catch (error: any) {
      console.error('❌ Error in enhanced entity search controller:', error);
      res.status(500).json({
        success: false,
        company: req.body.company_name || '',
        location: req.body.location,
        error: error.message,
        metadata: {
          search_duration_ms: 0,
          total_sources: 0,
          search_queries_executed: 0,
          api_calls_made: 0
        }
      } as EnhancedEntitySearchResponse);
    }
  }

  /**
   * GET /api/health
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    const isConfigured = this.enhancedSearchService.isConfigured();

    res.json({
      status: isConfigured ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'Enhanced Entity Search Service',
      version: '2.0.0',
      configuration: {
        gemini_api_configured: isConfigured,
        features: [
          'Basic company information search',
          '8 risk keyword analysis (military, defense, civil-military fusion, etc.)',
          'Multi-language search support',
          'Automatic severity assessment'
        ]
      },
      note: 'Configuration check only - no API calls made'
    });
  }

  /**
   * GET /api/info
   * Service information endpoint
   */
  async getInfo(req: Request, res: Response): Promise<void> {
    res.json({
      service: 'Enhanced Entity Search Service',
      version: '2.0.0',
      description: 'Google Search via Gemini API for comprehensive entity intelligence with automatic risk analysis',
      port: process.env.PORT || 3003,
      features: {
        basic_search: 'Company name, headquarters, sectors, description',
        risk_analysis: '8 automatic risk keyword checks',
        keywords: [
          'military',
          'defense',
          'civil-military fusion',
          'human rights violations',
          'sanctions',
          'police technology',
          'weapons',
          'terrorist connections'
        ],
        multi_language: 'Automatic language detection based on location',
        severity_levels: ['high', 'medium', 'low', 'none']
      },
      endpoints: [
        'POST /api/entity-search - Enhanced entity search with risk analysis',
        'GET /api/health - Health check',
        'GET /api/info - Service information'
      ],
      status: 'operational'
    });
  }

  /**
   * POST /api/entity-search-enhanced
   * Enhanced entity search with real-time dataset matching for affiliated companies
   */
  async handleEnhancedEntitySearchWithDatasetMatching(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        company_name,
        location,
        include_risk_analysis = true,
        custom_risk_keywords,
        include_dataset_matching = true,
        dataset_matching_options
      }: EnhancedEntitySearchWithDatasetRequest = req.body;

      // Validate required fields
      if (!company_name) {
        res.status(400).json({
          success: false,
          company: '',
          error: 'company_name is required',
          metadata: {
            search_duration_ms: 0,
            total_sources: 0,
            search_queries_executed: 0,
            api_calls_made: 0
          }
        } as EnhancedEntitySearchWithDatasetResponse);
        return;
      }

      console.log('📥 Enhanced entity search with dataset matching request:', {
        company: company_name,
        location: location || 'not specified',
        include_risk_analysis,
        custom_keywords: custom_risk_keywords?.length || 0,
        include_dataset_matching,
        dataset_boost: dataset_matching_options?.affiliated_boost || 1.15
      });

      // Check if Enhanced service is configured
      if (!this.enhancedSearchWithDatasetService.isConfigured()) {
        res.status(503).json({
          success: false,
          company: company_name,
          location,
          error: 'Enhanced Entity Search service is not properly configured. Please check GEMINI_API_KEY.',
          metadata: {
            search_duration_ms: 0,
            total_sources: 0,
            search_queries_executed: 0,
            api_calls_made: 0
          }
        } as EnhancedEntitySearchWithDatasetResponse);
        return;
      }

      // Perform enhanced search with dataset matching
      const response = await this.enhancedSearchWithDatasetService.searchEntityWithDatasetMatching({
        company_name,
        location,
        include_risk_analysis,
        custom_risk_keywords,
        include_dataset_matching,
        dataset_matching_options
      });

      if (response.success) {
        console.log(`✅ Enhanced search with dataset matching completed for ${company_name}:`, {
          duration: response.metadata.search_duration_ms,
          sources: response.metadata.total_sources,
          queries: response.metadata.search_queries_executed,
          api_calls: response.metadata.api_calls_made,
          risk_keywords_found: response.risk_analysis?.length || 0,
          dataset_matching_enabled: !!response.dataset_matching,
          direct_matches: response.dataset_matching?.direct_matches.length || 0,
          affiliated_matches: response.dataset_matching?.match_summary.total_affiliated_matches || 0
        });

        res.status(200).json(response);
      } else {
        console.error(`❌ Enhanced search with dataset matching failed for ${company_name}:`, response.error);
        res.status(500).json(response);
      }

    } catch (error: any) {
      console.error('❌ Unhandled error in enhanced entity search with dataset matching:', error);

      res.status(500).json({
        success: false,
        company: req.body.company_name || 'unknown',
        location: req.body.location,
        error: 'Internal server error during enhanced entity search with dataset matching',
        metadata: {
          search_duration_ms: 0,
          total_sources: 0,
          search_queries_executed: 0,
          api_calls_made: 0
        }
      } as EnhancedEntitySearchWithDatasetResponse);
    }
  }

  /**
   * GET /api/enhanced-info
   * Enhanced service information including dataset matching capabilities
   */
  async getEnhancedInfo(req: Request, res: Response): Promise<void> {
    try {
      const serviceInfo = this.enhancedSearchWithDatasetService.getServiceInfo();

      res.status(200).json({
        service: 'Enhanced Entity Search Service with Dataset Matching',
        version: '2.1.0',
        status: 'operational',
        description: 'Google Search via Gemini API for comprehensive entity intelligence with automatic risk analysis and real-time dataset matching for affiliated companies',
        features: {
          basic_search: 'Company name, headquarters, sectors, description',
          risk_analysis: '8 automatic risk keyword checks',
          dataset_matching: 'Real-time matching for affiliated companies discovered during risk analysis',
          affiliated_boost: 'Confidence boost for affiliated company matches (default: 1.15x)',
          comprehensive_coverage: 'Entity + affiliated companies comprehensive dataset coverage',
          risk_keywords: [
            'military',
            'defense',
            'civil-military fusion',
            'human rights violations',
            'sanctions',
            'police technology',
            'weapons',
            'terrorist connections'
          ],
          multi_language: 'Automatic language detection based on location',
          severity_levels: ['high', 'medium', 'low', 'none'],
          integration: 'Real-time Dataset Matching Service integration (port 3004)'
        },
        endpoints: [
          'POST /api/entity-search - Standard enhanced entity search',
          'POST /api/entity-search-enhanced - Enhanced search with dataset matching',
          'GET /api/health - Health check',
          'GET /api/info - Standard service information',
          'GET /api/enhanced-info - Enhanced service information with dataset matching'
        ],
        configuration: serviceInfo,
        performance: {
          estimated_response_time: '< 2 seconds (without dataset matching)',
          estimated_response_time_with_dataset: '< 5 seconds (with dataset matching)',
          max_affiliated_companies: 50,
          default_affiliated_boost: '1.15x',
          dataset_matching_timeout: '30 seconds'
        },
        dependencies: [
          'Gemini API (Google AI)',
          'Dataset Matching Service (port 3004)',
          'Google Search API via Gemini'
        ]
      });
    } catch (error: any) {
      console.error('Error getting enhanced service info:', error);
      res.status(500).json({
        error: 'Failed to get enhanced service information',
        message: error.message
      });
    }
  }
}
