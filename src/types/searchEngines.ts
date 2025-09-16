// Multi-Search Engine Types
export interface SearchEngineConfig {
  name: SearchEngineName;
  enabled: boolean;
  api_key?: string;
  endpoint?: string;
  rate_limit?: {
    requests_per_second: number;
    requests_per_month: number;
  };
  strengths: string[];
  geographic_focus: string[];
  language_support: string[];
  priority_score: number; // 1-10, higher = more important
}

export type SearchEngineName =
  | 'google'
  | 'bing'
  | 'duckduckgo'
  | 'baidu'
  | 'yandex';

export interface SearchEngineResult {
  engine: SearchEngineName;
  query: string;
  results: SearchResultItem[];
  metadata: {
    total_results?: number;
    search_time?: number;
    language?: string;
    region?: string;
  };
  raw_response?: any;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  displayUrl?: string;
  datePublished?: string;
  language?: string;
  source?: string;
}

export interface MultiEngineSearchRequest {
  query: string;
  location: string;
  languages: string[];
  engines?: SearchEngineName[];
  max_results_per_engine?: number;
  search_type?: 'general' | 'news' | 'academic' | 'images';
}

export interface MultiEngineSearchResponse {
  query: string;
  engines_used: SearchEngineName[];
  results_by_engine: Record<SearchEngineName, SearchEngineResult>;
  aggregated_results: SearchResultItem[];
  metadata: {
    total_results: number;
    total_time: number;
    engines_succeeded: number;
    engines_failed: number;
    timestamp: string;
  };
}

export interface SearchEngineService {
  search(query: string, options?: SearchOptions): Promise<SearchEngineResult>;
  isAvailable(): boolean;
  getConfig(): SearchEngineConfig;
}

export interface SearchOptions {
  count?: number;
  offset?: number;
  language?: string;
  region?: string;
  safe_search?: 'strict' | 'moderate' | 'off';
  time_filter?: 'day' | 'week' | 'month' | 'year';
}

// Engine Selection Strategy
export interface EngineSelectionStrategy {
  selectEngines(
    location: string,
    riskCategory: string,
    languages: string[]
  ): {
    engines: SearchEngineName[];
    reasoning: string;
  };
}

export interface SearchAggregationConfig {
  deduplication_threshold: number; // 0-1, similarity threshold for removing duplicates
  confidence_weights: Record<SearchEngineName, number>; // engine reliability weights
  max_results_per_engine: number;
  min_engines_for_high_confidence: number;
}