import { Request, Response } from 'express';
import { EnhancedEntitySearchService } from '../services/EnhancedEntitySearchService';
import { RiskKeywordAnalysisService } from '../services/RiskKeywordAnalysisService';
import { RiskKeywordAnalysisRequest, RiskAnalysisResponse, RiskKeywordAnalysisError } from '../types/risk-types';

export interface EntitySearchRequest {
  company_name: string;
  location?: string;
}

export interface EntitySearchResponse {
  success: boolean;
  company: string;
  company_info?: any;
  error?: string;
  metadata: {
    search_duration_ms: number;
    total_sources: number;
    search_queries_executed: number;
    api_calls_made: number;
  };
}

export class EntitySearchController {
  private enhancedEntitySearchService: EnhancedEntitySearchService;
  private riskKeywordAnalysisService: RiskKeywordAnalysisService;

  constructor() {
    this.enhancedEntitySearchService = new EnhancedEntitySearchService();
    this.riskKeywordAnalysisService = new RiskKeywordAnalysisService();
  }

  /**
   * POST /api/entity-search
   * Basic entity search using Enhanced Entity Search Service (Gemini API)
   * Returns company information from simplified 6-field structure
   */
  async handleEntitySearch(req: Request, res: Response): Promise<void> {
    try {
      const {
        company_name,
        location
      }: EntitySearchRequest = req.body;

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
        } as EntitySearchResponse);
        return;
      }

      console.log('📥 Entity search request:', {
        company: company_name,
        location: location || 'not specified'
      });

      // Check if Enhanced Entity Search service is configured
      if (!this.enhancedEntitySearchService.isConfigured()) {
        res.status(503).json({
          success: false,
          company: company_name,
          error: 'Enhanced Entity Search service not configured - please check GEMINI_API_KEY',
          metadata: {
            search_duration_ms: 0,
            total_sources: 0,
            search_queries_executed: 0,
            api_calls_made: 0
          }
        } as EntitySearchResponse);
        return;
      }

      const startTime = Date.now();

      console.log('🔍 [CONTROLLER] Starting entity search request...');
      console.log(`   - Company: ${company_name}`);
      console.log(`   - Location: ${location || 'Not specified'}`);

      // Call Enhanced Entity Search Service for basic company information
      const searchResult = await this.enhancedEntitySearchService.searchEntity({
        company_name,
        location
      });

      const searchDuration = Date.now() - startTime;

      console.log('📊 [CONTROLLER] Search result received:');
      console.log(`   - Success: ${searchResult.success}`);
      console.log(`   - Has basic_info: ${!!searchResult.basic_info}`);
      console.log(`   - API calls made: ${searchResult.metadata?.api_calls_made || 0}`);
      console.log(`   - Error: ${searchResult.error || 'None'}`);

      // Prepare response in compatible format
      const response: EntitySearchResponse = {
        success: searchResult.success,
        company: searchResult.company,
        company_info: this.formatCompanyInfoForCompatibility(searchResult.basic_info),
        metadata: searchResult.metadata,
        error: searchResult.error
      };

      console.log('📤 [CONTROLLER] Formatted response prepared:');
      console.log(`   - Final success: ${response.success}`);
      console.log(`   - Has company_info: ${!!response.company_info}`);
      console.log(`   - Data completeness: ${response.company_info?.data_completeness || 'Unknown'}`);
      console.log(`   - Duration: ${searchDuration}ms`);

      // Log response if search failed
      if (!response.success) {
        console.error(`❌ [CONTROLLER] Search failed for company: ${company_name}`);
        console.error(`   - Error: ${response.error}`);
        console.error(`   - Metadata:`, response.metadata);
      }

      res.json(response);

    } catch (error: any) {
      console.error('❌ Error in entity search controller:', error);
      res.status(500).json({
        success: false,
        company: req.body.company_name || '',
        error: error.message,
        metadata: {
          search_duration_ms: 0,
          total_sources: 0,
          search_queries_executed: 0,
          api_calls_made: 0
        }
      } as EntitySearchResponse);
    }
  }

  /**
   * POST /api/entity-search/analyze-keyword
   * Risk keyword analysis endpoint
   * Analyzes relationships between companies and specific risk keywords
   */
  async analyzeRiskKeyword(req: Request, res: Response): Promise<void> {
    try {
      const {
        company,
        keyword,
        location
      }: RiskKeywordAnalysisRequest = req.body;

      // Validate required fields
      if (!company || !keyword) {
        const errorResponse: RiskKeywordAnalysisError = {
          success: false,
          error: 'Both company and keyword are required fields',
          metadata: {
            analysis_duration_ms: 0,
            api_calls_made: 0
          }
        };
        res.status(400).json(errorResponse);
        return;
      }

      console.log('🔍 [RISK ANALYSIS] Risk keyword analysis request:', {
        company: company,
        keyword: keyword,
        location: location || 'not specified'
      });

      const startTime = Date.now();

      // Call Risk Keyword Analysis Service
      const analysisResult = await this.riskKeywordAnalysisService.analyzeRiskKeyword({
        company,
        keyword,
        location
      });

      const analysisDuration = Date.now() - startTime;

      console.log('📊 [RISK ANALYSIS] Analysis completed:');
      console.log(`   - Company: ${company}`);
      console.log(`   - Keyword: ${keyword}`);
      console.log(`   - Relationship Type: ${analysisResult.data.relationship_type}`);
      console.log(`   - Severity: ${analysisResult.data.severity}`);
      console.log(`   - Confidence: ${analysisResult.data.confidence_score}`);
      console.log(`   - Duration: ${analysisDuration}ms`);

      // Update metadata with actual duration
      analysisResult.metadata.analysis_duration_ms = analysisDuration;

      res.json(analysisResult);

    } catch (error: any) {
      const executionTime = 0; // Duration not available in error case

      console.error('❌ Error in risk keyword analysis controller:', error);

      const errorResponse: RiskKeywordAnalysisError = {
        success: false,
        error: error.message || 'Unknown error occurred during risk analysis',
        metadata: {
          analysis_duration_ms: executionTime,
          api_calls_made: 1
        }
      };

      // Handle specific error types
      if (error.message?.includes('GEMINI_API_KEY')) {
        res.status(503).json({
          ...errorResponse,
          error: 'Risk analysis service not configured - please check GEMINI_API_KEY'
        });
        return;
      }

      if (error.message?.includes('timeout')) {
        res.status(408).json({
          ...errorResponse,
          error: 'Risk analysis request timed out - please try again'
        });
        return;
      }

      res.status(500).json(errorResponse);
    }
  }

  /**
   * GET /api/health
   * Health check endpoint
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    const isConfigured = this.enhancedEntitySearchService.isConfigured();

    res.json({
      status: isConfigured ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'Entity Search Service (Enhanced)',
      version: '4.0.0',
      configuration: {
        gemini_api_configured: isConfigured,
        features: [
          'Basic company information search via Gemini API',
          'Comprehensive business intelligence gathering',
          'Simplified architecture focused on company data'
        ]
      },
      note: 'Configuration check only - no API calls made'
    });
  }

  /**
   * GET /api/info
   * Service information endpoint
   */
  async getInfo(_req: Request, res: Response): Promise<void> {
    res.json({
      service: 'Entity Search Service (Enhanced)',
      version: '4.0.0',
      description: 'Enhanced entity search using Gemini API for comprehensive company information',
      port: process.env.PORT || 3003,
      features: {
        basic_search: 'Comprehensive company information via Gemini AI',
        business_intelligence: 'Professional business intelligence gathering',
        risk_analysis: 'Risk keyword analysis for due diligence and compliance',
        simplified_architecture: 'Focused on high-quality company data only'
      },
      endpoints: [
        'POST /api/entity-search - Enhanced entity search',
        'POST /api/entity-search/analyze-keyword - Risk keyword analysis',
        'GET /api/health - Health check',
        'GET /api/info - Service information',
        'POST /api/test-gemini - Test Gemini API connectivity'
      ],
      status: 'operational'
    });
  }

  /**
   * POST /api/test-gemini
   * Test Gemini API connectivity and diagnostic endpoint
   */
  async testGeminiAPI(testCompany: string = "Test Company"): Promise<{
    success: boolean;
    duration?: number;
    error?: string;
    api_calls_made?: number;
    has_data?: boolean;
  }> {
    const startTime = Date.now();

    try {
      console.log('🧪 [TEST] Starting Gemini API diagnostic test...');
      console.log(`   - Test company: ${testCompany}`);

      // Test the service directly
      const searchResult = await this.enhancedEntitySearchService.searchEntity({
        company_name: testCompany,
        location: undefined
      });

      const duration = Date.now() - startTime;

      console.log('🧪 [TEST] Diagnostic test completed:');
      console.log(`   - Duration: ${duration}ms`);
      console.log(`   - Success: ${searchResult.success}`);
      console.log(`   - API calls made: ${searchResult.metadata?.api_calls_made || 0}`);
      console.log(`   - Has basic_info: ${!!searchResult.basic_info}`);
      console.log(`   - Error: ${searchResult.error || 'None'}`);

      return {
        success: searchResult.success,
        duration,
        api_calls_made: searchResult.metadata?.api_calls_made || 0,
        has_data: !!searchResult.basic_info,
        error: searchResult.error
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ [TEST] Diagnostic test failed: ${error.message}`);

      return {
        success: false,
        duration,
        error: `Diagnostic test failed: ${error.message}`,
        api_calls_made: 0,
        has_data: false
      };
    }
  }

  /**
   * Format BasicCompanyInfo to be compatible with existing frontend structure (6-field optimized)
   */
  private formatCompanyInfoForCompatibility(basicInfo: any): any {
    if (!basicInfo) {
      return {
        summary: 'Company information not available',
        sources: [],
        source_quality: 'minimal',
        data_completeness: 'no_data',
        note: 'Limited information available',
        enhanced_data: null
      };
    }

    return {
      summary: basicInfo.description || 'Company information available',
      sources: basicInfo.sources || [],
      source_quality: 'gemini_structured',
      data_completeness: this.assessDataCompleteness(basicInfo),
      note: 'Using Gemini AI enhanced company data (6-field structure)',
      enhanced_data: {
        // Core 6 fields from simplified structure
        official_name: basicInfo.name || 'Not available',
        english_name: basicInfo.english_name || 'Not available',
        previous_names: basicInfo.past_names || [],
        description: basicInfo.description || 'No description available',
        headquarters_text: basicInfo.headquarters || 'Not available',
        sectors: basicInfo.sectors || [],
        // Additional fields with defaults for compatibility
        website: basicInfo.website || 'Not available',
        founded_date: basicInfo.founded_date || 'Not available',
        company_type: basicInfo.company_type || 'Not available',
        employees: basicInfo.employees || 'Not available',
        // Metadata
        data_source: 'gemini_ai',
        has_comprehensive_info: this.hasComprehensiveInfo(basicInfo),
        missing_fields: this.getMissingFields(basicInfo)
      }
    };
  }

  /**
   * Assess the completeness of company data (6-field structure)
   */
  private assessDataCompleteness(basicInfo: any): string {
    if (!basicInfo) return 'no_data';

    let score = 0;

    // Check for essential 6 fields
    if (basicInfo.name) score++;
    if (basicInfo.english_name) score++;
    if (basicInfo.headquarters && basicInfo.headquarters.length > 10) score++;
    if (basicInfo.sectors && basicInfo.sectors.length > 0) score++;
    if (basicInfo.description && basicInfo.description.length > 50) score++;
    if (basicInfo.past_names && basicInfo.past_names.length > 0) score++;

    if (score >= 5) return 'excellent';
    if (score >= 4) return 'complete';
    if (score >= 3) return 'good';
    if (score >= 2) return 'basic';
    return 'minimal';
  }

  /**
   * Check if company has comprehensive information (6-field structure)
   */
  private hasComprehensiveInfo(basicInfo: any): boolean {
    if (!basicInfo) return false;

    // Check core 6 fields for comprehensive information
    const hasCoreFields = basicInfo.name &&
                         basicInfo.description &&
                         basicInfo.description.length > 50;

    const hasAdditionalInfo = (basicInfo.english_name && basicInfo.english_name !== 'Not available') ||
                             (basicInfo.headquarters && basicInfo.headquarters !== 'Not available') ||
                             (basicInfo.sectors && basicInfo.sectors.length > 0) ||
                             (basicInfo.past_names && basicInfo.past_names.length > 0);

    return hasCoreFields && hasAdditionalInfo;
  }

  /**
   * Get list of missing essential fields for debugging purposes
   */
  private getMissingFields(basicInfo: any): string[] {
    if (!basicInfo) return ['all data'];

    const missingFields: string[] = [];

    // Check the 6 essential fields
    if (!basicInfo.name) missingFields.push('name');
    if (!basicInfo.english_name) missingFields.push('english_name');
    if (!basicInfo.headquarters) missingFields.push('headquarters');
    if (!basicInfo.sectors || basicInfo.sectors.length === 0) missingFields.push('sectors');
    if (!basicInfo.description || basicInfo.description.length < 50) missingFields.push('description');
    if (!basicInfo.past_names || basicInfo.past_names.length === 0) missingFields.push('past_names');

    return missingFields;
  }
}
