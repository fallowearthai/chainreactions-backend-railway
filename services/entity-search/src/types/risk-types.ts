/**
 * Risk Keywords Analysis Types
 * Defines interfaces for risk keyword analysis functionality
 */

export interface RiskKeywordAnalysisRequest {
  company: string;
  keyword: string;
  location?: string;
}

export interface RiskAnalysisResult {
  risk_keyword: string;
  relationship_type: 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found';
  finding_summary: string;
  finding_summary_with_citations?: string;
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
  citations?: any[];
  search_queries: string[];
  severity: 'high' | 'medium' | 'low' | 'none';
  confidence_score?: number;
}

export interface RiskAnalysisResponse {
  success: boolean;
  data: RiskAnalysisResult;
  metadata: {
    analysis_duration_ms: number;
    api_calls_made: number;
    sources_considered: number;
    search_queries_used: string[];
  };
}

export interface RiskKeywordAnalysisError {
  success: false;
  error: string;
  metadata: {
    analysis_duration_ms: number;
    api_calls_made: number;
  };
}

// Predefined risk keywords as expected by frontend
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

// Severity assessment based on relationship type and evidence quality
export interface SeverityAssessment {
  severity: 'high' | 'medium' | 'low' | 'none';
  confidence: number;
  factors: string[];
}

// Evidence quality metrics
export interface EvidenceQuality {
  source_count: number;
  evidence_count: number;
  authoritative_sources: number; // .gov, .edu, established news
  recent_sources: number; // Sources from last 2 years
  geographic_relevance: number; // Sources from relevant geographic region
}