// Core Dataset Match Types
export interface DatasetMatch {
  dataset_name: string;
  organization_name: string;
  match_type: 'exact' | 'alias' | 'alias_partial' | 'fuzzy' | 'partial' | 'core_match' | 'core_acronym' | 'word_match';
  category?: string | null;
  confidence_score?: number;
  last_updated?: string;
  quality_metrics?: QualityMetrics;
}

export interface QualityMetrics {
  specificity_score: number;
  length_ratio: number;
  word_count_ratio: number;
  match_coverage: number;
  context_relevance?: number;
}

// API Request/Response Types
export interface SingleMatchRequest {
  entity: string;
  context?: string;
  location?: string;
  matchTypes?: string[];
  minConfidence?: number;
  forceRefresh?: boolean;
  searchRadius?: 'local' | 'regional' | 'global';
  prioritizeLocal?: boolean;
  maxResults?: number;
}

export interface BatchMatchRequest {
  entities: string[];
  options?: {
    matchTypes?: string[];
    minConfidence?: number;
    forceRefresh?: boolean;
    context?: string;
    location?: string;
    searchRadius?: 'local' | 'regional' | 'global';
    prioritizeLocal?: boolean;
    maxResults?: number;
  };
}

export interface MatchResponse {
  success: boolean;
  data?: DatasetMatch[];
  error?: string;
  metadata?: {
    total_matches: number;
    processing_time_ms: number;
    cache_hit: boolean;
    search_entity: string;
  };
}

export interface BatchMatchResponse {
  success: boolean;
  data?: Record<string, DatasetMatch[]>;
  error?: string;
  metadata?: {
    total_entities: number;
    total_matches: number;
    processing_time_ms: number;
    cache_hits: number;
    failed_entities: string[];
  };
}

// Database Types (from Supabase)
export interface DatasetEntry {
  id: string;
  dataset_id: string;
  organization_name: string;
  aliases?: string[];
  category?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Internal Processing Types
export interface NormalizedEntity {
  original: string;
  normalized: string;
  variations: string[];
  specificity_score: number;
}

export interface MatchCandidate {
  dataset_entry: DatasetEntry;
  dataset: Dataset;
  match_type: DatasetMatch['match_type'];
  confidence_score: number;
  quality_metrics: QualityMetrics;
}

// Caching Types
export interface CacheEntry {
  matches: DatasetMatch[];
  timestamp: number;
  version: string;
  entity_hash: string;
}

export interface CacheConfig {
  expiration_ms: number;
  max_entries: number;
  enable_distributed: boolean;
}

// Algorithm Configuration
export interface MatchingConfig {
  quality_thresholds: Record<string, number>;
  generic_terms: Set<string>;
  stop_words: Set<string>;
  algorithm_weights: {
    specificity: number;
    length_ratio: number;
    word_coverage: number;
    context_relevance: number;
  };
  fuzzy_matching: {
    levenshtein_threshold: number;
    jaro_winkler_threshold: number;
    ngram_size: number;
  };
}

// Error Types
export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface DatabaseError extends ServiceError {
  query?: string;
  parameters?: any;
}

export interface CacheError extends ServiceError {
  cache_key?: string;
  operation?: 'get' | 'set' | 'delete' | 'clear';
}

// Service Response Types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  metadata?: {
    processing_time_ms: number;
    cache_used: boolean;
    algorithm_version: string;
    matches_found?: number;
    geographic_boost_applied?: boolean;
    early_termination_applied?: boolean;
    [key: string]: any;
  };
}