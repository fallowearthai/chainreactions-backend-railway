"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchHistoryService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const DatasetSearchTypes_1 = require("../types/DatasetSearchTypes");
class SearchHistoryService {
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new DatasetSearchTypes_1.DatasetSearchError('Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.', 'MISSING_SUPABASE_CONFIG', 500);
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    /**
     * Create a new search history entry
     */
    async createSearchHistory(params) {
        try {
            const searchHistoryData = {
                user_id: params.user_id,
                execution_id: params.execution_id,
                target_institution: params.target_institution,
                keywords: params.keywords || [],
                start_date: params.start_date,
                end_date: params.end_date,
                excel_file_name: params.excel_file_name,
                search_results: [],
                execution_status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const { data, error } = await this.supabase
                .from('long_text_search_history')
                .insert(searchHistoryData)
                .select()
                .single();
            if (error) {
                throw new DatasetSearchTypes_1.DatasetSearchError(`Failed to create search history: ${error.message}`, 'DATABASE_INSERT_ERROR', 500);
            }
            return this.mapDatabaseRowToHistoryItem(data);
        }
        catch (error) {
            if (error instanceof DatasetSearchTypes_1.DatasetSearchError) {
                throw error;
            }
            throw new DatasetSearchTypes_1.DatasetSearchError(`Unexpected error creating search history: ${error}`, 'SEARCH_HISTORY_CREATE_ERROR', 500);
        }
    }
    /**
     * Update an existing search history entry
     */
    async updateSearchHistory(params) {
        try {
            const updateData = {
                updated_at: new Date().toISOString()
            };
            if (params.execution_status !== undefined) {
                updateData.execution_status = params.execution_status;
            }
            if (params.search_results !== undefined) {
                updateData.search_results = params.search_results;
            }
            if (params.error_message !== undefined) {
                updateData.error_message = params.error_message;
            }
            const { data, error } = await this.supabase
                .from('long_text_search_history')
                .update(updateData)
                .eq('execution_id', params.execution_id)
                .select()
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    // Record not found
                    return null;
                }
                throw new DatasetSearchTypes_1.DatasetSearchError(`Failed to update search history: ${error.message}`, 'DATABASE_UPDATE_ERROR', 500);
            }
            return this.mapDatabaseRowToHistoryItem(data);
        }
        catch (error) {
            if (error instanceof DatasetSearchTypes_1.DatasetSearchError) {
                throw error;
            }
            throw new DatasetSearchTypes_1.DatasetSearchError(`Unexpected error updating search history: ${error}`, 'SEARCH_HISTORY_UPDATE_ERROR', 500);
        }
    }
    /**
     * Add a single search result to the history (for real-time updates)
     */
    async addSearchResult(executionId, result) {
        try {
            // First, get the current search results
            const { data: currentData, error: fetchError } = await this.supabase
                .from('long_text_search_history')
                .select('search_results')
                .eq('execution_id', executionId)
                .single();
            if (fetchError) {
                console.error('Failed to fetch current search results:', fetchError);
                return false;
            }
            // Add the new result to the existing results
            const currentResults = currentData.search_results || [];
            const updatedResults = [...currentResults, result];
            // Update the database with the new results
            const { error: updateError } = await this.supabase
                .from('long_text_search_history')
                .update({
                search_results: updatedResults,
                updated_at: new Date().toISOString()
            })
                .eq('execution_id', executionId);
            if (updateError) {
                console.error('Failed to add search result:', updateError);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('Unexpected error adding search result:', error);
            return false;
        }
    }
    /**
     * Get search history by execution ID
     */
    async getSearchHistoryByExecutionId(executionId) {
        try {
            const { data, error } = await this.supabase
                .from('long_text_search_history')
                .select('*')
                .eq('execution_id', executionId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    // Record not found
                    return null;
                }
                throw new DatasetSearchTypes_1.DatasetSearchError(`Failed to fetch search history: ${error.message}`, 'DATABASE_FETCH_ERROR', 500);
            }
            return this.mapDatabaseRowToHistoryItem(data);
        }
        catch (error) {
            if (error instanceof DatasetSearchTypes_1.DatasetSearchError) {
                throw error;
            }
            throw new DatasetSearchTypes_1.DatasetSearchError(`Unexpected error fetching search history: ${error}`, 'SEARCH_HISTORY_FETCH_ERROR', 500);
        }
    }
    /**
     * Get search history with pagination and filtering
     */
    async getSearchHistory(request) {
        try {
            const { user_id, limit = 50, offset = 0, status_filter, date_from, date_to } = request;
            let query = this.supabase
                .from('long_text_search_history')
                .select('*', { count: 'exact' });
            // Apply filters
            if (user_id) {
                query = query.eq('user_id', user_id);
            }
            if (status_filter) {
                query = query.eq('execution_status', status_filter);
            }
            if (date_from) {
                query = query.gte('created_at', date_from);
            }
            if (date_to) {
                query = query.lte('created_at', date_to);
            }
            // Apply pagination and ordering
            query = query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            const { data, error, count } = await query;
            if (error) {
                throw new DatasetSearchTypes_1.DatasetSearchError(`Failed to fetch search history: ${error.message}`, 'DATABASE_FETCH_ERROR', 500);
            }
            const historyItems = (data || []).map(row => this.mapDatabaseRowToHistoryItem(row));
            return {
                success: true,
                data: historyItems,
                pagination: {
                    total: count || 0,
                    limit,
                    offset,
                    has_more: (count || 0) > offset + limit
                }
            };
        }
        catch (error) {
            if (error instanceof DatasetSearchTypes_1.DatasetSearchError) {
                throw error;
            }
            throw new DatasetSearchTypes_1.DatasetSearchError(`Unexpected error fetching search history: ${error}`, 'SEARCH_HISTORY_FETCH_ERROR', 500);
        }
    }
    /**
     * Delete search history entry by execution ID
     */
    async deleteSearchHistory(executionId) {
        try {
            const { error } = await this.supabase
                .from('long_text_search_history')
                .delete()
                .eq('execution_id', executionId);
            if (error) {
                throw new DatasetSearchTypes_1.DatasetSearchError(`Failed to delete search history: ${error.message}`, 'DATABASE_DELETE_ERROR', 500);
            }
            return true;
        }
        catch (error) {
            if (error instanceof DatasetSearchTypes_1.DatasetSearchError) {
                throw error;
            }
            console.error('Unexpected error deleting search history:', error);
            return false;
        }
    }
    /**
     * Update search status to cancelled
     */
    async cancelSearch(executionId) {
        try {
            const { error } = await this.supabase
                .from('long_text_search_history')
                .update({
                execution_status: 'cancelled',
                updated_at: new Date().toISOString()
            })
                .eq('execution_id', executionId);
            if (error) {
                console.error('Failed to cancel search:', error);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('Unexpected error cancelling search:', error);
            return false;
        }
    }
    /**
     * Get statistics about search history
     */
    async getSearchHistoryStatistics(userId) {
        try {
            let query = this.supabase
                .from('long_text_search_history')
                .select('execution_status, search_results');
            if (userId) {
                query = query.eq('user_id', userId);
            }
            const { data, error } = await query;
            if (error) {
                throw new DatasetSearchTypes_1.DatasetSearchError(`Failed to fetch search statistics: ${error.message}`, 'DATABASE_FETCH_ERROR', 500);
            }
            const searches = data || [];
            const totalSearches = searches.length;
            const completedSearches = searches.filter(s => s.execution_status === 'completed').length;
            const failedSearches = searches.filter(s => s.execution_status === 'failed').length;
            const cancelledSearches = searches.filter(s => s.execution_status === 'cancelled').length;
            const totalResults = searches.reduce((sum, search) => {
                return sum + (search.search_results?.length || 0);
            }, 0);
            const averageResultsPerSearch = totalSearches > 0 ? totalResults / totalSearches : 0;
            return {
                total_searches: totalSearches,
                completed_searches: completedSearches,
                failed_searches: failedSearches,
                cancelled_searches: cancelledSearches,
                average_results_per_search: Math.round(averageResultsPerSearch * 100) / 100
            };
        }
        catch (error) {
            if (error instanceof DatasetSearchTypes_1.DatasetSearchError) {
                throw error;
            }
            throw new DatasetSearchTypes_1.DatasetSearchError(`Unexpected error fetching search statistics: ${error}`, 'SEARCH_STATISTICS_ERROR', 500);
        }
    }
    /**
     * Test database connection
     */
    async testConnection() {
        try {
            const { data, error } = await this.supabase
                .from('long_text_search_history')
                .select('id')
                .limit(1);
            return !error;
        }
        catch (error) {
            console.error('Database connection test failed:', error);
            return false;
        }
    }
    /**
     * Map database row to history item interface
     */
    mapDatabaseRowToHistoryItem(row) {
        return {
            id: row.id,
            user_id: row.user_id,
            target_institution: row.target_institution,
            keywords: row.keywords || [],
            start_date: row.start_date,
            end_date: row.end_date,
            excel_file_name: row.excel_file_name,
            search_results: row.search_results || [],
            execution_status: row.execution_status,
            execution_id: row.execution_id,
            created_at: row.created_at,
            updated_at: row.updated_at
        };
    }
}
exports.SearchHistoryService = SearchHistoryService;
//# sourceMappingURL=SearchHistoryService.js.map