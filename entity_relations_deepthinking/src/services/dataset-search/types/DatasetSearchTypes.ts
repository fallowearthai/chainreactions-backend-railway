// Dataset Search Request/Response Types

export interface DatasetSearchRequest {
  target_institution: string;
  keywords?: string[];
  start_date?: string; // YYYY-MM-DD format
  end_date?: string;   // YYYY-MM-DD format
  excel_file?: Express.Multer.File;
  excel_file_name?: string;
}

export interface DatasetSearchResponse {
  success: boolean;
  execution_id: string;
  message: string;
  data?: LongTextResult[];
  error?: string;
  metadata?: {
    total_results?: number;
    processing_time?: number;
    keywords_used?: string[];
    date_range?: {
      start_date?: string;
      end_date?: string;
    };
  };
}

export interface LongTextResult {
  id: string;
  title: string;
  content: string;
  url?: string;
  source?: string;
  relevance_score?: number;
  date?: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface ExecutionStatusResponse {
  success: boolean;
  execution_id: string;
  status: ExecutionStatus;
  progress?: number;
  results_count?: number;
  error?: string;
  completed_at?: string;
  created_at: string;
}

export type ExecutionStatus =
  | 'pending'     // 等待开始
  | 'processing'  // 正在处理
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'cancelled';  // 已取消


// Search History Types
export interface LongTextSearchHistoryItem {
  id: string;
  user_id: string;
  target_institution: string;
  keywords?: string[];
  start_date?: string;
  end_date?: string;
  excel_file_name?: string;
  search_results?: LongTextResult[];
  execution_status: ExecutionStatus;
  execution_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SearchHistoryRequest {
  user_id?: string;
  limit?: number;
  offset?: number;
  status_filter?: ExecutionStatus;
  date_from?: string;
  date_to?: string;
}

export interface SearchHistoryResponse {
  success: boolean;
  data: LongTextSearchHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

// Error Types
export interface ServiceError {
  code: string;
  message: string;
  details?: any;
}

export class DatasetSearchError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string = 'DATASET_SEARCH_ERROR', statusCode: number = 500) {
    super(message);
    this.name = 'DatasetSearchError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// 新增：Canadian NRO组织接口
export interface NROOrganization {
  id: string;
  organization_name: string;
  countries: string[];
  aliases?: string[];
  category?: string;
  metadata?: any;
  dataset_source: string;
}

// 新增：Linkup API响应接口
export interface LinkupApiResponse {
  answer: string;
  sources: LinkupSource[];
}

export interface LinkupSource {
  name: string;
  url: string;
  snippet: string;
}

// 新增：解析后的搜索结果接口
export interface ParsedSearchResult {
  risk_item: string;
  relationship_type: 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found' | 'Timed Out';
  finding_summary?: string;
  intermediary_organizations?: string[];
  source_urls: string[];
  processing_time_ms?: number;
  completed_at: string;
  raw_response?: LinkupApiResponse; // 添加原始API响应
}

// 新增：SSE进度事件接口
export interface SSEProgressEvent {
  stage: 'connection' | 'progress' | 'new_result' | 'completed' | 'error';
  status: 'connected' | 'running' | 'success' | 'failed';
  message: string;
  current?: number;
  total?: number;
  data?: any; // Allow flexible data types
  error?: string;
}

// 新增：执行状态接口
export interface DatasetExecutionState {
  executionId: string;
  status: ExecutionStatus;
  userId: string;
  institutionName: string;
  totalEntities: number;
  processedEntities: number;
  foundRelationships: number;
  startTime: Date;
  endTime?: Date;
  cancelled: boolean;
  abortController: AbortController;
  results: ParsedSearchResult[];
}