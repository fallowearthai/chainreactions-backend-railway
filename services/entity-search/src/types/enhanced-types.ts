/**
 * Enhanced Entity Search Types
 *
 * Types for the Enhanced Entity Search service that uses Google Search via Gemini API
 * and performs automatic risk keyword analysis.
 */

export type RelationshipType = 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found';
export type SeverityLevel = 'high' | 'medium' | 'low' | 'none';

export const RISK_KEYWORDS = [
  'military',
  'defense',
  'civil-military fusion',
  'human rights violations',
  'sanctions',
  'police technology',
  'weapons',
  'terrorist connections'
] as const;

export type RiskKeyword = typeof RISK_KEYWORDS[number];

// ==================== Request Types ====================

export interface EnhancedEntitySearchRequest {
  company_name: string;
  location?: string;
  include_risk_analysis?: boolean;  // Default: true
  custom_risk_keywords?: string[];  // Optional: user-defined keywords
}

// ==================== Response Types ====================

export interface BasicCompanyInfo {
  name: string;
  english_name?: string;
  headquarters?: string;
  sectors?: string[];
  description?: string;
  past_names?: string[];
}

export interface RiskAnalysisResult {
  risk_keyword: RiskKeyword | string;
  relationship_type: RelationshipType;
  finding_summary: string;
  potential_intermediary_B: string[];
  key_evidence: Array<{
    text: string;
    source_indices: number[];
  }>;
  sources: Array<{
    title: string;
    url: string;
    type: string;
  }>;
  search_queries: string[];
  severity: SeverityLevel;
  confidence_score?: number;
}

export interface RiskSummary {
  total_risks_found: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  overall_risk_level: SeverityLevel;
  flagged_keywords: string[];
  clean_keywords: string[];
}

export interface SearchMetadata {
  search_duration_ms: number;
  total_sources: number;
  search_queries_executed: number;
  api_calls_made: number;
}

export interface EnhancedEntitySearchResponse {
  success: boolean;
  company: string;
  location?: string;
  basic_info?: BasicCompanyInfo;
  risk_analysis?: RiskAnalysisResult[];
  risk_summary?: RiskSummary;
  metadata: SearchMetadata;
  error?: string;
}

// ==================== Enhanced Entity Search with Dataset Matching Types ====================

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

export interface DatasetMatchSummary {
  total_affiliated_entities: number;
  matched_affiliated_entities: number;
  total_direct_matches: number;
  total_affiliated_matches: number;
  high_confidence_matches: number;
  average_confidence: number;
}

export interface DatasetMatchingMetadata {
  processing_time_ms: number;
  affiliated_boost_applied: number;
  algorithm_version: string;
}

export interface EnhancedEntitySearchWithDatasetRequest {
  company_name: string;
  location?: string;
  include_risk_analysis?: boolean;  // Default: true
  custom_risk_keywords?: string[];  // Optional: user-defined keywords
  include_dataset_matching?: boolean; // Default: true
  dataset_matching_options?: {
    affiliated_boost?: number; // Default: 1.15
    min_confidence?: number; // Default: 0.3
    max_results?: number; // Default: 20
    force_refresh?: boolean; // Default: false
  };
}

export interface EnhancedEntitySearchWithDatasetResponse extends EnhancedEntitySearchResponse {
  dataset_matching?: {
    direct_matches: DatasetMatchResult[];
    affiliated_matches: Record<string, DatasetMatchResult[]>;
    match_summary: DatasetMatchSummary;
  };
  dataset_matching_metadata?: DatasetMatchingMetadata;
}
