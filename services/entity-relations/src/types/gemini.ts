export interface GeminiRequest {
  contents: GeminiContent[];
  system_instruction?: GeminiSystemInstruction;
  tools?: GeminiTool[];
  generationConfig?: GeminiGenerationConfig;
}

export interface GeminiContent {
  parts: GeminiPart[];
  role?: string;
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  functionCall?: {
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, any>;
  };
}

export interface GeminiSystemInstruction {
  parts: GeminiPart[];
  role?: string;
}

export interface GeminiTool {
  codeExecution?: {};
  googleSearch?: {};
  google_search?: {}; // New enhanced format
  urlContext?: {};
}

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: Record<string, any>;
  thinkingConfig?: {
    thinkingBudget?: number;
  };
}

export interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

export interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
  index: number;
  safetyRatings?: GeminiSafetyRating[];
}

export interface GeminiSafetyRating {
  category: string;
  probability: string;
}

export interface SearchRequest {
  Target_institution: string;
  Risk_Entity: string;
  Location: string;
  Start_Date?: string;
  End_Date?: string;
  Custom_Keyword?: string;
}

export interface SearchResult {
  success: boolean;
  data?: OSINTFinding[];
  metadata?: {
    total_risk_entities?: number;
    analysis_timestamp?: string;
    search_execution_summary?: any;
    overall_confidence?: number;
    methodology?: string;
  };
  sources?: string[];
  workflow_metadata?: {
    optimization_applied?: boolean;
    optimization_stats?: any;
    execution_time_ms?: number;
    relationship_likelihood?: string;
    serp_execution_summary?: any;
    search_strategy?: any;
    entity_info?: any;
  };
  error?: string;
}

export interface OSINTFinding {
  risk_item: string;
  institution_A: string;
  relationship_type: 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found';
  finding_summary: string;
  potential_intermediary_B?: string;
  sources: string[];
  key_evidence?: string[];
  evidence_quality?: 'high' | 'medium' | 'low';
}

// Normal Search Types
export interface NormalSearchRequest {
  Target_institution: string;
  Risk_Entity: string;
  Location: string;
  Start_Date?: string;
  End_Date?: string;
}

export interface GeminiRequestBody {
  system_instruction: {
    parts: Array<{
      text: string;
    }>;
  };
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig: {
    thinkingConfig?: {
      thinkingBudget: number;
    };
    temperature: number;
    maxOutputTokens: number;
    topP: number;
    topK: number;
  };
  tools: Array<{
    googleSearch?: {};
    google_search?: {}; // Enhanced format
    codeExecution?: {};
  }>;
}

export interface GeminiResponseCandidate {
  content: {
    parts: Array<{
      text?: string;
      [key: string]: any;
    }>;
  };
  groundingMetadata?: {
    searchEntryPoint?: {
      renderedContent?: string;
    };
    webSearchQueries?: string[];
  };
}

export interface NormalSearchResult {
  risk_item: string;
  institution_A: string;
  relationship_type: 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found';
  finding_summary: string;
  potential_intermediary_B: string[] | null;
  sources: string[];
}

export interface FormattedSearchOutput {
  result: string;
  urls: string;
  raw_data: {
    risk_item: string;
    institution_A: string;
    relationship_type: string;
    finding_summary: string;
    potential_intermediary_B: string;
    urls: string;
    sources_count: number;
    key_evidence?: Array<{
      text: string;
      source_indices: number[];  // 1-based indices matching the numbered urls
    }>;
  };
}

// Enhanced Grounding Types
export interface EnhancedSource {
  title: string;
  url: string;
  chunk_index: number;
}

export interface EvidenceWithSources {
  text: string;
  source_indices: number[];
}

export interface QualityMetrics {
  evidence_count: number;
  source_count: number;
  coverage_percentage: number;
  source_quality_score?: number;
}

export interface GroundingMetadata {
  has_grounding: boolean;
  grounding_chunks: Array<{
    web: { uri: string; title: string };
  }>;
  grounding_supports: Array<{
    segment: { text: string; startIndex: number; endIndex: number };
    groundingChunkIndices: number[];
    confidenceScore?: number;
  }>;
  web_search_queries: string[];
}

export interface EnhancedNormalSearchResult extends Omit<NormalSearchResult, 'sources'> {
  key_evidence: EvidenceWithSources[];
  sources: EnhancedSource[];
  search_queries: string[];
  quality_metrics: QualityMetrics;
  grounding_metadata?: GroundingMetadata;
}

export interface EnhancedSearchResponse {
  results: EnhancedNormalSearchResult[];
  grounding_metadata?: GroundingMetadata;
  grounding_metrics?: {
    groundingChunksCount: number;
    groundingSupportsCount: number;
    evidenceCoveragePercentage: number;
    sourceQualityScore: number;
    averageConfidenceScore: number;
    executionTimeMs: number;
  };
  enhanced_mode: boolean;
}

// New optimized response structure to eliminate data redundancy
export interface SourceInfo {
  id: number;        // 1-based numbering
  url: string;       // Complete URL
  title?: string;     // Optional title from enhanced sources
}

export interface QualityMetrics {
  evidence_count: number;
  source_count: number;
  coverage_percentage: number;
  source_quality_score?: number;
}

// v2.1.0: Optimized response structure with formatted_display removed
// Eliminates ~4KB data redundancy by removing duplicate formatted text
export interface OptimizedSearchResponse {
  version: string;           // Response structure version (v2.1.0)
  success: boolean;          // Operation status
  data: {
    // Core business data (flattened, no redundancy)
    risk_item: string;
    institution_A: string;
    relationship_type: string;
    finding_summary: string;
    potential_intermediary_B: string;

    // Source data information (structured array)
    sources: SourceInfo[];
    sources_count: number;

    // Key evidence with source mapping
    key_evidence: Array<{
      text: string;
      source_indices: number[];
    }>;

    // Quality metrics (required for standardized responses)
    quality_metrics: QualityMetrics;
  };

  // Metadata
  metadata: {
    timestamp: string;
    processing_time_ms?: number;
    enhanced_mode: boolean;
    api_version: string;
  };
}