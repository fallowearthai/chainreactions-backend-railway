import axios from 'axios';
import {
  EnhancedEntitySearchService,
  EnhancedEntitySearchResponse,
  RiskAnalysisResult
} from './EnhancedEntitySearchService';

export interface EnhancedEntitySearchWithDatasetRequest {
  company_name: string;
  location?: string;
  include_risk_analysis?: boolean;
  custom_risk_keywords?: string[];
  include_dataset_matching?: boolean; // Default: true
  dataset_matching_options?: {
    affiliated_boost?: number; // Default: 1.15
    min_confidence?: number; // Default: 0.3
    max_results?: number; // Default: 20
    force_refresh?: boolean; // Default: false
  };
}

export interface DatasetMatchResult {
  dataset_name: string;
  organization_name: string;
  match_type: string;
  category?: string;
  confidence_score?: number;
  relationship_source?: 'direct' | 'affiliated_company';
  source_risk_keyword?: string;
  relationship_strength?: number;
  boost_applied?: number;
}

export interface EnhancedEntitySearchWithDatasetResponse extends EnhancedEntitySearchResponse {
  dataset_matching?: {
    direct_matches: DatasetMatchResult[];
    affiliated_matches: Record<string, DatasetMatchResult[]>;
    match_summary: {
      total_affiliated_entities: number;
      matched_affiliated_entities: number;
      total_direct_matches: number;
      total_affiliated_matches: number;
      high_confidence_matches: number;
      average_confidence: number;
    };
  };
  dataset_matching_metadata?: {
    processing_time_ms: number;
    affiliated_boost_applied: number;
    algorithm_version: string;
  };
}

/**
 * Enhanced Entity Search Service with Dataset Matching Integration
 *
 * This service extends the base Enhanced Entity Search with real-time Dataset Matching
 * for affiliated companies discovered during risk analysis.
 */
export class EnhancedEntitySearchWithDatasetService {
  private baseService: EnhancedEntitySearchService;
  private datasetMatchingUrl: string;

  constructor() {
    // Import base service dynamically to avoid circular dependencies
    const { EnhancedEntitySearchService } = require('./EnhancedEntitySearchService');
    this.baseService = new EnhancedEntitySearchService();

    // Dataset Matching Service URL (port 3004)
    this.datasetMatchingUrl = process.env.DATASET_MATCHING_URL || 'http://localhost:3004';
  }

  /**
   * Enhanced search with affiliated companies dataset matching
   */
  async searchEntityWithDatasetMatching(
    request: EnhancedEntitySearchWithDatasetRequest
  ): Promise<EnhancedEntitySearchWithDatasetResponse> {
    const startTime = Date.now();
    const includeDatasetMatching = request.include_dataset_matching !== false;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 Enhanced Entity Search with Dataset Matching: ${request.company_name}`);
    console.log(`📍 Location: ${request.location || 'Not specified'}`);
    console.log(`⚠️  Risk Analysis: ${request.include_risk_analysis !== false ? 'Enabled' : 'Disabled'}`);
    console.log(`🗃️  Dataset Matching: ${includeDatasetMatching ? 'Enabled' : 'Disabled'}`);
    if (includeDatasetMatching) {
      console.log(`🔗 Affiliated Boost: ${request.dataset_matching_options?.affiliated_boost || 1.15}x`);
    }
    console.log(`${'='.repeat(80)}\n`);

    try {
      // Step 1: Perform base entity search
      console.log('📋 Step 1: Performing base Enhanced Entity Search...');
      const baseSearchResponse = await this.baseService.searchEntity({
        company_name: request.company_name,
        location: request.location,
        include_risk_analysis: request.include_risk_analysis,
        custom_risk_keywords: request.custom_risk_keywords
      });

      if (!baseSearchResponse.success) {
        console.log(`❌ Base search failed: ${baseSearchResponse.error}`);
        return {
          ...baseSearchResponse,
          error: baseSearchResponse.error || 'Base search failed'
        };
      }

      console.log(`✅ Base search completed successfully`);
      console.log(`   - Basic info: ${baseSearchResponse.basic_info ? 'Found' : 'Not found'}`);
      console.log(`   - Risk analysis: ${baseSearchResponse.risk_analysis?.length || 0} keywords analyzed`);

      // Step 2: Perform dataset matching for affiliated companies (if enabled)
      let datasetMatchingResults: EnhancedEntitySearchWithDatasetResponse['dataset_matching'] | undefined;
      let datasetMatchingMetadata: EnhancedEntitySearchWithDatasetResponse['dataset_matching_metadata'] | undefined;

      if (includeDatasetMatching && baseSearchResponse.risk_analysis) {
        console.log(`\n🗃️  Step 2: Dataset Matching for affiliated companies...`);

        const affiliatedCompanies = this.extractAffiliatedCompanies(baseSearchResponse.risk_analysis);

        if (affiliatedCompanies.length > 0) {
          console.log(`   Found ${affiliatedCompanies.length} unique affiliated companies`);

          const datasetMatchingStart = Date.now();
          const datasetResponse = await this.callDatasetMatchingService(
            request.company_name,
            affiliatedCompanies,
            request.location,
            request.dataset_matching_options
          );

          const datasetMatchingDuration = Date.now() - datasetMatchingStart;

          if (datasetResponse.success) {
            datasetMatchingResults = datasetResponse.data;
            datasetMatchingMetadata = {
              processing_time_ms: datasetMatchingDuration,
              affiliated_boost_applied: request.dataset_matching_options?.affiliated_boost || 1.15,
              algorithm_version: datasetResponse.metadata?.algorithm_version || '2.1.0-affiliated-enhanced'
            };

            console.log(`✅ Dataset matching completed:`);
            console.log(`   - Direct matches: ${datasetMatchingResults?.direct_matches.length || 0}`);
            console.log(`   - Affiliated entities matched: ${datasetMatchingResults?.match_summary.matched_affiliated_entities || 0}/${datasetMatchingResults?.match_summary.total_affiliated_entities || 0}`);
            console.log(`   - Total affiliated matches: ${datasetMatchingResults?.match_summary.total_affiliated_matches || 0}`);
            console.log(`   - High confidence matches: ${datasetMatchingResults?.match_summary.high_confidence_matches || 0}`);
            console.log(`   - Average confidence: ${(datasetMatchingResults?.match_summary.average_confidence || 0).toFixed(2)}`);
            console.log(`   - Processing time: ${datasetMatchingDuration}ms`);
          } else {
            console.log(`⚠️  Dataset matching failed: ${datasetResponse.error}`);
          }
        } else {
          console.log(`ℹ️  No affiliated companies found for dataset matching`);
        }
      }

      const totalDuration = Date.now() - startTime;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`🎉 Enhanced Search with Dataset Matching Completed in ${totalDuration}ms`);
      console.log(`${'='.repeat(80)}\n`);

      // Combine results
      const combinedResponse: EnhancedEntitySearchWithDatasetResponse = {
        ...baseSearchResponse,
        dataset_matching: datasetMatchingResults,
        dataset_matching_metadata: datasetMatchingMetadata,
        metadata: {
          ...baseSearchResponse.metadata,
          search_duration_ms: totalDuration // Update total duration
        }
      };

      return combinedResponse;

    } catch (error: any) {
      console.error(`❌ Enhanced search with dataset matching failed:`, error);

      const duration = Date.now() - startTime;
      return {
        success: false,
        company: request.company_name,
        location: request.location,
        error: error.message,
        metadata: {
          search_duration_ms: duration,
          total_sources: 0,
          search_queries_executed: 0,
          api_calls_made: 0
        }
      };
    }
  }

  /**
   * Extract unique affiliated companies from risk analysis results
   */
  private extractAffiliatedCompanies(riskAnalysis: RiskAnalysisResult[]): Array<{
    company_name: string;
    risk_keyword: string;
    relationship_type: string;
    confidence_score?: number;
  }> {
    const affiliatedCompanies: Array<{
      company_name: string;
      risk_keyword: string;
      relationship_type: string;
      confidence_score?: number;
    }> = [];

    const seen = new Set<string>();

    for (const riskResult of riskAnalysis) {
      if (riskResult.potential_intermediary_B && riskResult.potential_intermediary_B.length > 0) {
        for (const company of riskResult.potential_intermediary_B) {
          const normalized = company.toLowerCase().trim();
          if (!seen.has(normalized) && normalized.length > 0) {
            seen.add(normalized);
            affiliatedCompanies.push({
              company_name: company.trim(),
              risk_keyword: riskResult.risk_keyword,
              relationship_type: riskResult.relationship_type,
              confidence_score: riskResult.confidence_score
            });
          }
        }
      }
    }

    return affiliatedCompanies;
  }

  /**
   * Call Dataset Matching Service for affiliated companies
   */
  private async callDatasetMatchingService(
    entity: string,
    affiliatedCompanies: Array<{
      company_name: string;
      risk_keyword: string;
      relationship_type: string;
      confidence_score?: number;
    }>,
    location?: string,
    options?: {
      affiliated_boost?: number;
      min_confidence?: number;
      max_results?: number;
      force_refresh?: boolean;
    }
  ): Promise<{
    success: boolean;
    data?: EnhancedEntitySearchWithDatasetResponse['dataset_matching'];
    error?: string;
    metadata?: {
      processing_time_ms: number;
      algorithm_version: string;
    };
  }> {
    try {
      const requestData = {
        entity,
        affiliated_companies: affiliatedCompanies,
        location,
        context: `Risk analysis affiliated companies matching for ${entity}`,
        options: {
          affiliatedBoost: options?.affiliated_boost || 1.15,
          minConfidence: options?.min_confidence || 0.3,
          maxResults: options?.max_results || 20,
          forceRefresh: options?.force_refresh || false,
          searchRadius: 'global' as const,
          prioritizeLocal: false
        }
      };

      console.log(`   📡 Calling Dataset Matching Service at ${this.datasetMatchingUrl}`);

      const response = await axios.post(
        `${this.datasetMatchingUrl}/api/dataset-matching/affiliated-match`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000 // 30 second timeout
        }
      );

      if (response.data && response.data.success) {
        // Transform the response to match our expected format
        const transformedData: EnhancedEntitySearchWithDatasetResponse['dataset_matching'] = {
          direct_matches: response.data.direct_matches || [],
          affiliated_matches: response.data.affiliated_matches || {},
          match_summary: response.data.match_summary || {
            total_affiliated_entities: 0,
            matched_affiliated_entities: 0,
            total_direct_matches: 0,
            total_affiliated_matches: 0,
            high_confidence_matches: 0,
            average_confidence: 0
          }
        };

        return {
          success: true,
          data: transformedData,
          metadata: {
            processing_time_ms: response.data.metadata?.processing_time_ms || 0,
            algorithm_version: response.data.metadata?.algorithm_version || '2.1.0-affiliated-enhanced'
          }
        };
      } else {
        return {
          success: false,
          error: response.data?.error || 'Dataset matching service returned unsuccessful response'
        };
      }

    } catch (error: any) {
      console.error(`   ❌ Dataset Matching Service error:`, error.message);

      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Dataset Matching service is unavailable. Please ensure it is running on port 3004.'
        };
      }

      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Dataset Matching service request timed out after 30 seconds.'
        };
      }

      return {
        success: false,
        error: `Dataset Matching service error: ${error.message}`
      };
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    // Check if base service is configured
    const { EnhancedEntitySearchService } = require('./EnhancedEntitySearchService');
    const baseService = new EnhancedEntitySearchService();

    return baseService.isConfigured();
  }

  /**
   * Get service information including dataset matching capability
   */
  getServiceInfo(): {
    base_service_configured: boolean;
    dataset_matching_enabled: boolean;
    dataset_matching_url: string;
  } {
    return {
      base_service_configured: this.isConfigured(),
      dataset_matching_enabled: true,
      dataset_matching_url: this.datasetMatchingUrl
    };
  }
}