import { LongTextSearchHistoryItem, ParsedSearchResult, SearchHistoryRequest, SearchHistoryResponse, ExecutionStatus } from '../types/DatasetSearchTypes';
export interface CreateSearchHistoryParams {
    user_id: string;
    execution_id: string;
    target_institution: string;
    keywords?: string[];
    start_date?: string;
    end_date?: string;
    excel_file_name?: string;
}
export interface UpdateSearchHistoryParams {
    execution_id: string;
    execution_status?: ExecutionStatus;
    search_results?: ParsedSearchResult[];
    error_message?: string;
}
export declare class SearchHistoryService {
    private supabase;
    constructor();
    /**
     * Create a new search history entry
     */
    createSearchHistory(params: CreateSearchHistoryParams): Promise<LongTextSearchHistoryItem>;
    /**
     * Update an existing search history entry
     */
    updateSearchHistory(params: UpdateSearchHistoryParams): Promise<LongTextSearchHistoryItem | null>;
    /**
     * Add a single search result to the history (for real-time updates)
     */
    addSearchResult(executionId: string, result: ParsedSearchResult): Promise<boolean>;
    /**
     * Get search history by execution ID
     */
    getSearchHistoryByExecutionId(executionId: string): Promise<LongTextSearchHistoryItem | null>;
    /**
     * Get search history with pagination and filtering
     */
    getSearchHistory(request: SearchHistoryRequest): Promise<SearchHistoryResponse>;
    /**
     * Delete search history entry by execution ID
     */
    deleteSearchHistory(executionId: string): Promise<boolean>;
    /**
     * Update search status to cancelled
     */
    cancelSearch(executionId: string): Promise<boolean>;
    /**
     * Get statistics about search history
     */
    getSearchHistoryStatistics(userId?: string): Promise<{
        total_searches: number;
        completed_searches: number;
        failed_searches: number;
        cancelled_searches: number;
        average_results_per_search: number;
    }>;
    /**
     * Test database connection
     */
    testConnection(): Promise<boolean>;
    /**
     * Map database row to history item interface
     */
    private mapDatabaseRowToHistoryItem;
}
//# sourceMappingURL=SearchHistoryService.d.ts.map