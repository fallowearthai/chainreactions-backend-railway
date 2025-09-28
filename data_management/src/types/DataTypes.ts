// File Upload Types
export interface UploadFileInfo {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

export interface FileUploadResult {
  success: boolean;
  message: string;
  file_info?: UploadFileInfo;
  processing_result?: ImportResult;
  error?: string;
}

// CSV Import Types
export interface CsvRow {
  id: string;
  schema: string;
  name: string;
  aliases: string;
  birth_date: string;
  countries: string;
  addresses: string;
  identifiers: string;
  sanctions: string;
  phones: string;
  emails: string;
  program_ids: string;
  dataset: string;
  first_seen: string;
  last_seen: string;
  last_change: string;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateRows: number;
  errors: string[];
  warnings: string[];
  dataset_id?: string;
  processing_time_ms: number;
  file_info: {
    filename: string;
    size: number;
    format: string;
  };
}

// Publisher Types
export interface Publisher {
  organization: string;
  source_url: string;
}

// Dataset Types
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  publisher?: Publisher;
  is_system: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DatasetEntry {
  id: string;
  dataset_id: string;
  external_id?: string;
  organization_name: string;
  aliases?: string[];
  schema_type?: string;
  birth_date?: string;
  countries?: string[];
  addresses?: string;
  identifiers?: string;
  sanctions?: string;
  phones?: string;
  emails?: string;
  program_ids?: string;
  dataset_source?: string;
  first_seen?: Date;
  last_seen?: Date;
  last_change?: Date;
  category?: string;
  metadata?: any;
  created_at: string;
}

export interface CreateDatasetRequest {
  name: string;
  description?: string;
  publisher?: Publisher;
  is_system?: boolean;
}

export interface UpdateDatasetRequest {
  name?: string;
  description?: string;
  publisher?: Publisher;
  is_active?: boolean;
}

export interface CreateDatasetEntryRequest {
  organization_name: string;
  aliases?: string[];
  countries?: string[];
  schema_type?: string;
  program_ids?: string;
  category?: string;
  metadata?: any;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    total?: number;
    page?: number;
    limit?: number;
    processing_time_ms?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface DatasetListResponse {
  datasets: Dataset[];
  total: number;
  page: number;
  limit: number;
}

export interface DatasetEntriesResponse {
  entries: DatasetEntry[];
  total: number;
  page: number;
  limit: number;
  dataset_info: {
    id: string;
    name: string;
    description?: string;
  };
}

// File Processing Types
export interface FileProcessor {
  supports(mimetype: string, extension: string): boolean;
  process(filePath: string, options?: any): Promise<ImportResult>;
  validate(filePath: string): Promise<ValidationResult>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    row_count?: number;
    columns?: string[];
    encoding?: string;
  };
}

// Service Configuration
export interface ServiceConfig {
  port: number;
  environment: string;
  supabase: {
    url: string;
    anon_key: string;
    service_role_key: string;
  };
  upload: {
    max_file_size: number;
    upload_path: string;
    allowed_types: string[];
  };
  api: {
    prefix: string;
    cors_origin: string;
  };
  rate_limit: {
    window_ms: number;
    max_requests: number;
  };
}

// Error Types
export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  stack?: string;
}

export interface ValidationError extends ServiceError {
  field?: string;
  value?: any;
}

export interface DatabaseError extends ServiceError {
  query?: string;
  parameters?: any;
}

export interface FileProcessingError extends ServiceError {
  file_path?: string;
  line_number?: number;
  row_data?: any;
}