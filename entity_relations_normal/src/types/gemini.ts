/**
 * Gemini API Types for Normal Search Service
 */

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

export interface GeminiResponse {
  candidates: GeminiResponseCandidate[];
  [key: string]: any;
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
    potential_intermediary_B: string[];
    urls: string;
    sources_count: number;
    renderedContent?: string;
    webSearchQueries?: string[];
  };
}
