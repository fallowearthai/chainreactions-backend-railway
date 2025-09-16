// Meta Prompting Strategy Types
export interface EntityAnalysis {
  institution_type: 'university' | 'government' | 'corporation' | 'ngo' | 'military' | 'unknown';
  risk_category: 'government' | 'military' | 'technology' | 'organization' | 'academic' | 'financial' | 'unknown';
  geographic_focus: string; // primary country/region
  relationship_likelihood: 'high' | 'medium' | 'low';
}

export interface SearchStrategy {
  primary_keywords: string[];
  secondary_keywords: string[];
  languages: string[];
  source_priorities: string[]; // e.g., ['news', 'academic', 'official', 'corporate']
  search_operators: string[]; // e.g., ['site:edu', 'site:gov', 'filetype:pdf']
  time_focus: string; // how to approach time-based searching
}

export interface SearchTerms {
  english: string[];
  local_language: string[];
}

export interface ToolSelection {
  selected_tools: string[];
  tool_priorities: Record<string, number>; // tool_name -> priority_score
  reasoning: string;
}

export interface MetaPromptResponse {
  entity_analysis: EntityAnalysis;
  search_strategy: SearchStrategy;
  search_terms: SearchTerms;
  tool_selection?: ToolSelection;
  fallback_used: boolean;
  raw_content?: string;
  parse_error?: string;
}

// Enhanced Search Result with strategy tracking
export interface EnhancedSearchResult {
  risk_item: string;
  institution_A: string;
  relationship_type: 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found';
  finding_summary: string;
  potential_intermediary_B: string[] | null;
  sources: string[];
  search_strategy_used: {
    keywords_used: string[];
    languages_searched: string[];
    source_types_found: string[];
    tools_used: string[];
  };
  confidence_level?: string;
  search_completeness?: string;
}

// Tool configuration interfaces
export interface ToolConfig {
  name: string;
  enabled: boolean;
  api_key?: string;
  rate_limit?: {
    requests_per_minute: number;
    requests_per_day: number;
  };
  priority_score: number; // 1-10, higher = more important
  geographic_strengths?: string[]; // countries/regions this tool is particularly good for
  category_strengths?: string[]; // risk categories this tool excels at
}

export interface AvailableTools {
  google_search: ToolConfig;
  newsapi?: ToolConfig;
  gdelt?: ToolConfig;
  arxiv?: ToolConfig;
  semantic_scholar?: ToolConfig;
  opencorporates?: ToolConfig;
  wikidata?: ToolConfig;
  github?: ToolConfig;
}