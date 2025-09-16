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
  groundnMetadata?: GeminiGroundingMetadata;
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
  risk_item: string;
  institution_A: string;
  relationship_type: 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found';
  finding_summary: string;
  potential_intermediary_B: string[] | null;
  sources: string[];
  search_completeness?: string;
  confidence_level?: string;
}

export interface FormattedSearchResult {
  result: string;
  urls: string;
  raw_data: {
    risk_item: string;
    institution_A: string;
    relationship_type: string;
    finding_summary: string;
    potential_intermediary_B: string[];
    urls: string;
    sources_count: number;
    renderedContent?: string;
    webSearchQueries?: string[];
  };
}