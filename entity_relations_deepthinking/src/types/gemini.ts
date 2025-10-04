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
  groundingMetadata?: GeminiGroundingMetadata;
  groundnMetadata?: GeminiGroundingMetadata; // Legacy typo - keep for backward compatibility
}

export interface GeminiSafetyRating {
  category: string;
  probability: string;
}

export interface GeminiGroundingMetadata {
  webSearchQueries?: string[];
  searchEntryPoint?: {
    renderedContent: string;
    schema?: Record<string, any>;
  };
  groundingAttributions?: GeminiGroundingAttribution[];
  retrievalMetadata?: GeminiRetrievalMetadata;
}

export interface GeminiGroundingAttribution {
  web?: {
    uri: string;
    title: string;
  };
  segment?: {
    partIndex: number;
    startIndex: number;
    endIndex: number;
    text: string;
  };
}

export interface GeminiRetrievalMetadata {
  googleSearchDynamicRetrievalScore?: number;
}

export interface SearchRequest {
  Target_institution: string;
  Risk_Entity: string;
  Location: string;
  Start_Date?: string;
  End_Date?: string;
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
  Start_Date?: string;  // Format: YYYY-MM-DD
  End_Date?: string;    // Format: YYYY-MM-DD
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
    thinkingConfig: {
      thinkingBudget: number;
    };
    temperature: number;
    maxOutputTokens: number;
    topP: number;
    topK: number;
  };
  tools: Array<{
    googleSearch?: {};
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
    potential_intermediary_B: string; // Changed from array to string for frontend compatibility
    urls: string;
    sources_count: number;
    renderedContent?: string;
    webSearchQueries?: string[];
  };
}

