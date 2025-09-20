export interface BrightDataSerpRequest {
  zone: string;
  url: string;
  format?: 'raw' | 'json' | 'markdown';
  method?: 'GET' | 'POST';
  country?: string;
  data_format?: 'markdown' | 'screenshot';
}

export interface BrightDataSerpResponse {
  engine: string;
  query: string;
  results: BrightDataResult[];
  total_results?: number;
  time_taken?: number;
  related_searches?: string[];
  knowledge_graph?: any;
  ads?: BrightDataResult[];
}

export interface BrightDataResult {
  type: 'organic' | 'ad' | 'knowledge_graph' | 'featured_snippet';
  position: number;
  title: string;
  url: string;
  snippet?: string;
  displayed_url?: string;
  date?: string;
  thumbnail?: string;
  rich_snippet?: any;
}

export interface SearchEngineConfig {
  name: SerpEngine;
  base_url: string;
  default_params: Record<string, string>;
  supported_languages: string[];
  geographic_focus: string[];
  strengths: string[];
}

export type SerpEngine = 'google' | 'yandex' | 'baidu' | 'yahoo' | 'naver';

export interface MultiEngineSearchRequest {
  query?: string;  // Single query (backward compatibility)
  queries?: string[];  // Multiple queries (new feature)
  engines?: SerpEngine[];
  location?: string;
  language?: string;
  country?: string;
  country_code?: string;  // Add country_code support
  max_results_per_query?: number;  // Rename for clarity
  results_per_engine?: number;  // Keep for backward compatibility
  time_filter?: string;
  safe_search?: 'strict' | 'moderate' | 'off';
}

export interface MultiEngineSearchResponse {
  query?: string;  // Single query (backward compatibility)
  queries?: string[];  // Multiple queries (new feature)
  engines_used: SerpEngine[];
  results_by_engine: Record<string, BrightDataSerpResponse>;
  results: AggregatedResult[];  // Simplified name
  aggregated_results: AggregatedResult[];  // Keep for backward compatibility
  metadata: {
    total_results: number;
    total_time: number;
    engines_succeeded: number;
    engines_failed: number;
    timestamp: string;
  };
}

export interface AggregatedResult {
  title: string;
  url: string;
  snippet: string;
  sources: SerpEngine[];
  confidence_score: number;
  position_avg: number;
  date?: string;
}

export interface EngineSelectionStrategy {
  selectEngines(
    location: string,
    riskCategory: string,
    languages: string[]
  ): { engines: SerpEngine[]; reasoning: string };
}