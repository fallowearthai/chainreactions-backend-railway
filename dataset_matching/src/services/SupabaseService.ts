import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DatasetEntry,
  Dataset,
  DatasetMatch,
  DatabaseError,
  ServiceResponse
} from '../types/DatasetMatchTypes';
import { createDatabaseError } from '../utils/ErrorHandler';

export class SupabaseService {
  private client: SupabaseClient;
  private static instance: SupabaseService;

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      realtime: {
        params: {
          eventsPerSecond: 1
        }
      }
    });
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Test database connection
  async testConnection(): Promise<ServiceResponse<{ status: string; tables: string[] }>> {
    try {
      const startTime = process.hrtime();

      // Test basic connection with a simple query
      const { data: datasets, error: datasetsError } = await this.client
        .from('datasets')
        .select('id, name, is_active')
        .limit(1);

      if (datasetsError) {
        throw datasetsError;
      }

      // Test the enhanced function
      const { data: functionTest, error: functionError } = await this.client
        .rpc('get_datasets_version');

      if (functionError) {
        console.warn('Enhanced function test failed:', functionError);
      }

      const processingTime = this.getProcessingTime(startTime);

      return {
        success: true,
        data: {
          status: 'connected',
          tables: ['datasets', 'dataset_entries', 'Functions available']
        },
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };
    } catch (error: any) {
      const dbError = createDatabaseError(
        `Database connection test failed: ${error.message}`,
        'SELECT datasets',
        {}
      );

      return {
        success: false,
        error: dbError
      };
    }
  }

  // Get datasets version for cache invalidation
  async getDatasetsVersion(): Promise<ServiceResponse<string>> {
    try {
      const startTime = process.hrtime();

      const { data, error } = await this.client.rpc('get_datasets_version');

      if (error) {
        throw error;
      }

      const processingTime = this.getProcessingTime(startTime);
      const version = data || Date.now().toString();

      return {
        success: true,
        data: version,
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };
    } catch (error: any) {
      // Fallback to timestamp if function doesn't exist
      const fallbackVersion = Date.now().toString();
      console.warn('Failed to get datasets version, using fallback:', error.message);

      return {
        success: true,
        data: fallbackVersion,
        metadata: {
          processing_time_ms: 0,
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };
    }
  }

  // Enhanced dataset matching using the database function with optional geographic filtering
  async findDatasetMatches(
    searchText: string,
    searchLocation?: string,
    options?: {
      prioritizeLocal?: boolean;
      maxResults?: number;
    }
  ): Promise<ServiceResponse<DatasetMatch[]>> {
    try {
      const startTime = process.hrtime();

      // If location is provided, use geographic-aware search
      if (searchLocation) {
        return this.findDatasetMatchesWithLocation(searchText, searchLocation, options);
      }

      // Try the enhanced function first
      const { data, error } = await this.client.rpc('find_dataset_matches_enhanced', {
        search_text: searchText
      });

      if (error) {
        console.warn('Enhanced function failed, using optimized fallback:', error.message);
        return this.findDatasetMatchesOptimized(searchText, undefined, options);
      }

      const processingTime = this.getProcessingTime(startTime);

      // Map the database results to our type
      const matches: DatasetMatch[] = (data || []).map((item: any) => ({
        dataset_name: item.dataset_name,
        organization_name: item.organization_name,
        match_type: item.match_type as DatasetMatch['match_type'],
        category: item.category,
        confidence_score: item.confidence_score,
        last_updated: item.last_updated,
        quality_metrics: {
          specificity_score: 0.8,
          length_ratio: 1.0,
          word_count_ratio: 1.0,
          match_coverage: 1.0
        }
      }));

      return {
        success: true,
        data: matches,
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };

    } catch (error: any) {
      const dbError = createDatabaseError(
        `Dataset matching query failed: ${error.message}`,
        'find_dataset_matches_optimized',
        { search_text: searchText }
      );

      return {
        success: false,
        error: dbError
      };
    }
  }

  // Geographic-aware dataset matching
  private async findDatasetMatchesWithLocation(
    searchText: string,
    searchLocation: string,
    options?: { prioritizeLocal?: boolean; maxResults?: number }
  ): Promise<ServiceResponse<DatasetMatch[]>> {
    try {
      const startTime = process.hrtime();
      const { CountryNormalizer } = await import('../utils/CountryNormalizer');
      const countryNormalizer = CountryNormalizer.getInstance();

      // Normalize the search location
      const normalizedLocation = countryNormalizer.normalizeCountry(searchLocation);
      if (!normalizedLocation) {
        console.warn(`Could not normalize location: ${searchLocation}, falling back to text-only search`);
        return this.findDatasetMatchesOptimized(searchText, undefined, options);
      }

      const searchLower = searchText.toLowerCase().trim();
      const allMatches: DatasetMatch[] = [];
      const maxResults = options?.maxResults || 20;

      // Step 1: Search with geographic filtering (same country)
      const { data: sameCountryMatches, error: sameCountryError } = await this.client
        .from('dataset_entries')
        .select(`
          organization_name,
          category,
          aliases,
          countries,
          datasets!inner(name, updated_at, is_active)
        `)
        .eq('datasets.is_active', true)
        .contains('countries', [normalizedLocation.canonical])
        .or(`organization_name.ilike.%${searchText}%`)
        .limit(maxResults);

      if (sameCountryError) throw sameCountryError;

      // Process same country matches with higher priority
      if (sameCountryMatches && sameCountryMatches.length > 0) {
        sameCountryMatches.forEach((entry: any) => {
          const match = this.processMatchEntry(entry, searchText, searchLower, 1.2); // Geographic boost
          if (match) allMatches.push(match);
        });
      }

      // Step 2: If we need more results, search regional countries
      if (allMatches.length < maxResults) {
        const regionalCountries = countryNormalizer.getRegionalCountries(normalizedLocation.canonical);
        const otherRegionalCountries = regionalCountries.filter(c => c !== normalizedLocation.canonical);

        if (otherRegionalCountries.length > 0) {
          const { data: regionalMatches, error: regionalError } = await this.client
            .from('dataset_entries')
            .select(`
              organization_name,
              category,
              aliases,
              countries,
              datasets!inner(name, updated_at, is_active)
            `)
            .eq('datasets.is_active', true)
            .overlaps('countries', otherRegionalCountries)
            .or(`organization_name.ilike.%${searchText}%`)
            .limit(maxResults - allMatches.length);

          if (!regionalError && regionalMatches) {
            regionalMatches.forEach((entry: any) => {
              // Avoid duplicates
              const isDuplicate = allMatches.some(existing =>
                existing.organization_name === entry.organization_name &&
                existing.dataset_name === entry.datasets.name
              );

              if (!isDuplicate) {
                const match = this.processMatchEntry(entry, searchText, searchLower, 1.1); // Regional boost
                if (match) allMatches.push(match);
              }
            });
          }
        }
      }

      // Step 3: If still need more results and not prioritizing local, get global results
      if (allMatches.length < maxResults && !options?.prioritizeLocal) {
        const { data: globalMatches, error: globalError } = await this.client
          .from('dataset_entries')
          .select(`
            organization_name,
            category,
            aliases,
            countries,
            datasets!inner(name, updated_at, is_active)
          `)
          .eq('datasets.is_active', true)
          .or(`organization_name.ilike.%${searchText}%`)
          .limit(maxResults - allMatches.length);

        if (!globalError && globalMatches) {
          globalMatches.forEach((entry: any) => {
            // Avoid duplicates
            const isDuplicate = allMatches.some(existing =>
              existing.organization_name === entry.organization_name &&
              existing.dataset_name === entry.datasets.name
            );

            if (!isDuplicate) {
              const match = this.processMatchEntry(entry, searchText, searchLower, 0.9); // Global penalty
              if (match) allMatches.push(match);
            }
          });
        }
      }

      const processingTime = this.getProcessingTime(startTime);

      // Sort by confidence score
      const sortedMatches = allMatches.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));

      return {
        success: true,
        data: sortedMatches.slice(0, maxResults),
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0-geographic'
        }
      };

    } catch (error: any) {
      const dbError = createDatabaseError(
        `Geographic dataset matching failed: ${error.message}`,
        'SELECT dataset_entries (geographic)',
        { search_text: searchText, location: searchLocation }
      );

      return {
        success: false,
        error: dbError
      };
    }
  }

  // Helper method to process match entries with geographic boost
  private processMatchEntry(entry: any, searchText: string, searchLower: string, geographicBoost: number): DatasetMatch | null {
    const orgNameLower = entry.organization_name.toLowerCase();
    let matchType: DatasetMatch['match_type'] = 'partial';
    let confidence = 0.6;

    // Exact match
    if (orgNameLower === searchLower) {
      matchType = 'exact';
      confidence = 1.0;
    }
    // Fuzzy match (remove spaces)
    else if (orgNameLower.replace(/\s+/g, '') === searchLower.replace(/\s+/g, '')) {
      matchType = 'fuzzy';
      confidence = 0.9;
    }
    // Core match (remove parentheses and spaces)
    else if (orgNameLower.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, '') === searchLower.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, '')) {
      matchType = 'core_match';
      confidence = 0.8;
    }
    // Partial match
    else if (orgNameLower.includes(searchLower) || searchLower.includes(orgNameLower)) {
      matchType = 'partial';
      confidence = 0.6;
    }
    else {
      return null; // No match
    }

    // Apply geographic boost
    confidence *= geographicBoost;

    return {
      dataset_name: entry.datasets.name,
      organization_name: entry.organization_name,
      match_type: matchType,
      category: entry.category,
      confidence_score: Math.min(1.0, confidence),
      last_updated: entry.datasets.updated_at
    };
  }

  // Optimized dataset matching using efficient direct queries
  private async findDatasetMatchesOptimized(
    searchText: string,
    searchLocation?: string,
    options?: { maxResults?: number }
  ): Promise<ServiceResponse<DatasetMatch[]>> {
    try {
      const startTime = process.hrtime();
      const searchLower = searchText.toLowerCase().trim();
      const allMatches: DatasetMatch[] = [];

      // Strategy 1: Exact and partial name matches (fastest - uses index)
      const { data: exactMatches, error: exactError } = await this.client
        .from('dataset_entries')
        .select(`
          organization_name,
          category,
          aliases,
          datasets!inner(name, updated_at, is_active)
        `)
        .eq('datasets.is_active', true)
        .or(`organization_name.ilike.%${searchText}%`)
        .limit(20);

      if (exactError) throw exactError;

      // Process matches with better logic
      if (exactMatches && exactMatches.length > 0) {
        exactMatches.forEach((entry: any) => {
          const orgNameLower = entry.organization_name.toLowerCase();
          let matchType: DatasetMatch['match_type'] = 'partial';
          let confidence = 0.6;

          // Exact match
          if (orgNameLower === searchLower) {
            matchType = 'exact';
            confidence = 1.0;
          }
          // Fuzzy match (remove spaces)
          else if (orgNameLower.replace(/\s+/g, '') === searchLower.replace(/\s+/g, '')) {
            matchType = 'fuzzy';
            confidence = 0.9;
          }
          // Core match (remove parentheses and spaces)
          else if (orgNameLower.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, '') === searchLower.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, '')) {
            matchType = 'core_match';
            confidence = 0.8;
          }
          // Partial match
          else if (orgNameLower.includes(searchLower) || searchLower.includes(orgNameLower)) {
            matchType = 'partial';
            confidence = 0.6;
          }

          allMatches.push({
            dataset_name: entry.datasets.name,
            organization_name: entry.organization_name,
            match_type: matchType,
            category: entry.category,
            confidence_score: confidence,
            last_updated: entry.datasets.updated_at
          });
        });
      }

      // Strategy 2: Partial name matches (if no exact matches)
      if (allMatches.length === 0) {
        const { data: partialMatches, error: partialError } = await this.client
          .from('dataset_entries')
          .select(`
            organization_name,
            category,
            aliases,
            datasets!inner(name, updated_at, is_active)
          `)
          .eq('datasets.is_active', true)
          .or(`organization_name.ilike.%${searchText}%`)
          .limit(20);

        if (partialError) throw partialError;

        // Process partial matches
        if (partialMatches && partialMatches.length > 0) {
          partialMatches.forEach((entry: any) => {
            const orgNameLower = entry.organization_name.toLowerCase();

            // Check for fuzzy match (remove spaces)
            const normalizedOrg = orgNameLower.replace(/\s+/g, '');
            const normalizedSearch = searchLower.replace(/\s+/g, '');

            let matchType: DatasetMatch['match_type'] = 'partial';
            let confidence = 0.6;

            if (normalizedOrg === normalizedSearch) {
              matchType = 'fuzzy';
              confidence = 0.9;
            } else if (orgNameLower.includes(searchLower) || searchLower.includes(orgNameLower)) {
              matchType = 'partial';
              confidence = 0.6;
            }

            allMatches.push({
              dataset_name: entry.datasets.name,
              organization_name: entry.organization_name,
              match_type: matchType,
              category: entry.category,
              confidence_score: confidence,
              last_updated: entry.datasets.updated_at
            });
          });
        }
      }

      // Strategy 3: Alias matches (check aliases array)
      if (allMatches.length < 5) {
        const { data: allEntries, error: aliasError } = await this.client
          .from('dataset_entries')
          .select(`
            organization_name,
            category,
            aliases,
            datasets!inner(name, updated_at, is_active)
          `)
          .eq('datasets.is_active', true)
          .not('aliases', 'is', null)
          .limit(50);

        if (aliasError) throw aliasError;

        // Check aliases in application layer (more efficient than complex SQL)
        if (allEntries && allEntries.length > 0) {
          allEntries.forEach((entry: any) => {
            if (entry.aliases && Array.isArray(entry.aliases)) {
              for (const alias of entry.aliases) {
                if (alias && alias.toLowerCase() === searchLower) {
                  allMatches.push({
                    dataset_name: entry.datasets.name,
                    organization_name: entry.organization_name,
                    match_type: 'alias',
                    category: entry.category,
                    confidence_score: 0.95,
                    last_updated: entry.datasets.updated_at
                  });
                  break; // Found exact alias match, no need to check more
                }
              }
            }
          });
        }
      }

      const processingTime = this.getProcessingTime(startTime);

      // Remove duplicates and sort by confidence
      const uniqueMatches = this.removeDuplicateMatches(allMatches);
      const sortedMatches = uniqueMatches.sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0));

      return {
        success: true,
        data: sortedMatches.slice(0, 10), // Limit to top 10 results
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0-optimized'
        }
      };
    } catch (error: any) {
      const dbError = createDatabaseError(
        `Optimized dataset matching failed: ${error.message}`,
        'SELECT dataset_entries (optimized)',
        { search_text: searchText }
      );

      return {
        success: false,
        error: dbError
      };
    }
  }

  // Remove duplicate matches helper
  private removeDuplicateMatches(matches: DatasetMatch[]): DatasetMatch[] {
    const seen = new Set<string>();
    const uniqueMatches: DatasetMatch[] = [];

    for (const match of matches) {
      const key = `${match.dataset_name}:${match.organization_name}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMatches.push(match);
      }
    }

    return uniqueMatches;
  }

  // Fallback method using direct table queries
  private async findDatasetMatchesFallback(searchText: string): Promise<ServiceResponse<DatasetMatch[]>> {
    try {
      const startTime = process.hrtime();

      // Query dataset entries with active datasets
      const { data: entries, error } = await this.client
        .from('dataset_entries')
        .select(`
          organization_name,
          category,
          aliases,
          datasets!inner(name, updated_at, is_active)
        `)
        .eq('datasets.is_active', true)
        .or(`organization_name.ilike.%${searchText}%,aliases.cs.{${searchText}}`);

      if (error) {
        throw error;
      }

      const processingTime = this.getProcessingTime(startTime);

      // Simple mapping for fallback
      const matches: DatasetMatch[] = (entries || []).map((entry: any) => ({
        dataset_name: entry.datasets.name,
        organization_name: entry.organization_name,
        match_type: this.determineMatchType(searchText, entry.organization_name, entry.aliases),
        category: entry.category,
        confidence_score: 0.5, // Default confidence for fallback
        last_updated: entry.datasets.updated_at
      }));

      return {
        success: true,
        data: matches,
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0-fallback'
        }
      };
    } catch (error: any) {
      const dbError = createDatabaseError(
        `Fallback dataset matching failed: ${error.message}`,
        'SELECT dataset_entries',
        { search_text: searchText }
      );

      return {
        success: false,
        error: dbError
      };
    }
  }

  // Simple match type determination for fallback
  private determineMatchType(searchText: string, orgName: string, aliases: string[]): DatasetMatch['match_type'] {
    const normalizedSearch = searchText.toLowerCase().trim();
    const normalizedOrg = orgName.toLowerCase().trim();

    if (normalizedSearch === normalizedOrg) {
      return 'exact';
    }

    if (aliases && aliases.some(alias => alias.toLowerCase() === normalizedSearch)) {
      return 'alias';
    }

    if (normalizedOrg.includes(normalizedSearch) || normalizedSearch.includes(normalizedOrg)) {
      return 'partial';
    }

    return 'fuzzy';
  }

  // Get all active datasets
  async getActiveDatasets(): Promise<ServiceResponse<Dataset[]>> {
    try {
      const startTime = process.hrtime();

      const { data, error } = await this.client
        .from('datasets')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        throw error;
      }

      const processingTime = this.getProcessingTime(startTime);

      return {
        success: true,
        data: data || [],
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };
    } catch (error: any) {
      const dbError = createDatabaseError(
        `Failed to get active datasets: ${error.message}`,
        'SELECT datasets',
        { is_active: true }
      );

      return {
        success: false,
        error: dbError
      };
    }
  }

  // Get dataset entries by dataset
  async getDatasetEntries(datasetId: string, limit: number = 100): Promise<ServiceResponse<DatasetEntry[]>> {
    try {
      const startTime = process.hrtime();

      const { data, error } = await this.client
        .from('dataset_entries')
        .select('*')
        .eq('dataset_id', datasetId)
        .limit(limit)
        .order('organization_name');

      if (error) {
        throw error;
      }

      const processingTime = this.getProcessingTime(startTime);

      return {
        success: true,
        data: data || [],
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };
    } catch (error: any) {
      const dbError = createDatabaseError(
        `Failed to get dataset entries: ${error.message}`,
        'SELECT dataset_entries',
        { dataset_id: datasetId, limit }
      );

      return {
        success: false,
        error: dbError
      };
    }
  }

  // Batch search for multiple entities
  async findDatasetMatchesBatch(searchTexts: string[]): Promise<ServiceResponse<Record<string, DatasetMatch[]>>> {
    try {
      const startTime = process.hrtime();
      const results: Record<string, DatasetMatch[]> = {};

      // Process in smaller batches to avoid overwhelming the database
      const batchSize = 10;
      const batches = [];

      for (let i = 0; i < searchTexts.length; i += batchSize) {
        batches.push(searchTexts.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (text) => {
          const result = await this.findDatasetMatches(text);
          return { text, matches: result.success ? result.data! : [] };
        });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(({ text, matches }) => {
          results[text] = matches;
        });
      }

      const processingTime = this.getProcessingTime(startTime);

      return {
        success: true,
        data: results,
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };
    } catch (error: any) {
      const dbError = createDatabaseError(
        `Batch dataset matching failed: ${error.message}`,
        'batch_find_dataset_matches',
        { search_texts: searchTexts.length + ' entities' }
      );

      return {
        success: false,
        error: dbError
      };
    }
  }

  // Helper method to calculate processing time
  private getProcessingTime(startTime: [number, number]): number {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    return Math.round((seconds * 1000) + (nanoseconds / 1e6));
  }

  // Get database statistics
  async getDatabaseStats(): Promise<ServiceResponse<any>> {
    try {
      const startTime = process.hrtime();

      // Get dataset count
      const { count: datasetCount, error: datasetError } = await this.client
        .from('datasets')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (datasetError) {
        throw datasetError;
      }

      // Get dataset entries count
      const { count: entriesCount, error: entriesError } = await this.client
        .from('dataset_entries')
        .select('*', { count: 'exact', head: true });

      if (entriesError) {
        throw entriesError;
      }

      const processingTime = this.getProcessingTime(startTime);

      return {
        success: true,
        data: {
          active_datasets: datasetCount || 0,
          total_entries: entriesCount || 0,
          last_updated: new Date().toISOString()
        },
        metadata: {
          processing_time_ms: processingTime,
          cache_used: false,
          algorithm_version: '1.0.0'
        }
      };
    } catch (error: any) {
      const dbError = createDatabaseError(
        `Failed to get database statistics: ${error.message}`,
        'SELECT COUNT(*)',
        {}
      );

      return {
        success: false,
        error: dbError
      };
    }
  }
}