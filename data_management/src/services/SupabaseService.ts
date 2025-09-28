import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Dataset, DatasetEntry, CreateDatasetRequest, UpdateDatasetRequest } from '@/types/DataTypes';

export class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient;

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration check:', {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        NODE_ENV: process.env.NODE_ENV
      });
      throw new Error(`Missing Supabase configuration - URL: ${!!supabaseUrl}, Service Key: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}, Anon Key: ${!!process.env.SUPABASE_ANON_KEY}`);
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Dataset Management
  async getDatasets(page: number = 1, limit: number = 20): Promise<{ datasets: Dataset[]; total: number }> {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.client
      .from('datasets')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch datasets: ${error.message}`);
    }

    return {
      datasets: data || [],
      total: count || 0
    };
  }

  async getDatasetById(id: string): Promise<Dataset | null> {
    const { data, error } = await this.client
      .from('datasets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch dataset: ${error.message}`);
    }

    return data;
  }

  async findDatasetByName(name: string): Promise<Dataset | null> {
    const { data, error } = await this.client
      .from('datasets')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find dataset: ${error.message}`);
    }

    return data;
  }

  async createDataset(dataset: CreateDatasetRequest): Promise<Dataset> {
    const { data, error } = await this.client
      .from('datasets')
      .insert({
        name: dataset.name,
        description: dataset.description,
        is_system: dataset.is_system || false,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create dataset: ${error.message}`);
    }

    return data;
  }

  async updateDataset(id: string, updates: UpdateDatasetRequest): Promise<Dataset> {
    const { data, error } = await this.client
      .from('datasets')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update dataset: ${error.message}`);
    }

    return data;
  }

  async deleteDataset(id: string): Promise<void> {
    // First delete all entries
    const { error: entriesError } = await this.client
      .from('dataset_entries')
      .delete()
      .eq('dataset_id', id);

    if (entriesError) {
      throw new Error(`Failed to delete dataset entries: ${entriesError.message}`);
    }

    // Then delete the dataset
    const { error } = await this.client
      .from('datasets')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete dataset: ${error.message}`);
    }
  }

  // Dataset Entries Management
  async getDatasetEntries(
    datasetId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ entries: DatasetEntry[]; total: number }> {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.client
      .from('dataset_entries')
      .select('*', { count: 'exact' })
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch dataset entries: ${error.message}`);
    }

    return {
      entries: data || [],
      total: count || 0
    };
  }

  async findEntryByExternalId(externalId: string): Promise<DatasetEntry | null> {
    const { data, error } = await this.client
      .from('dataset_entries')
      .select('*')
      .eq('external_id', externalId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to find entry: ${error.message}`);
    }

    return data;
  }

  async createDatasetEntry(entry: Partial<DatasetEntry>): Promise<DatasetEntry> {
    const { data, error } = await this.client
      .from('dataset_entries')
      .insert(entry)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create dataset entry: ${error.message}`);
    }

    return data;
  }

  async createDatasetEntries(entries: Partial<DatasetEntry>[]): Promise<DatasetEntry[]> {
    const { data, error } = await this.client
      .from('dataset_entries')
      .insert(entries)
      .select();

    if (error) {
      throw new Error(`Failed to create dataset entries: ${error.message}`);
    }

    return data || [];
  }

  async updateDatasetEntry(id: string, updates: Partial<DatasetEntry>): Promise<DatasetEntry> {
    const { data, error } = await this.client
      .from('dataset_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update dataset entry: ${error.message}`);
    }

    return data;
  }

  async deleteDatasetEntry(id: string): Promise<void> {
    const { error } = await this.client
      .from('dataset_entries')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete dataset entry: ${error.message}`);
    }
  }

  async deleteDatasetEntries(datasetId: string): Promise<void> {
    const { error } = await this.client
      .from('dataset_entries')
      .delete()
      .eq('dataset_id', datasetId);

    if (error) {
      throw new Error(`Failed to delete dataset entries: ${error.message}`);
    }
  }

  // Search and Filter
  async searchDatasetEntries(
    datasetId: string,
    query: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ entries: DatasetEntry[]; total: number }> {
    const offset = (page - 1) * limit;

    const { data, error, count } = await this.client
      .from('dataset_entries')
      .select('*', { count: 'exact' })
      .eq('dataset_id', datasetId)
      .or(`organization_name.ilike.%${query}%,aliases.cs.{${query}}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to search dataset entries: ${error.message}`);
    }

    return {
      entries: data || [],
      total: count || 0
    };
  }

  async getDatasetStats(datasetId: string): Promise<{
    total_entries: number;
    entries_with_aliases: number;
    countries: string[];
    country_distribution: { [country: string]: { count: number; percentage: number } };
    last_updated: string;
  }> {
    // Get total count
    const { count: totalEntries, error: countError } = await this.client
      .from('dataset_entries')
      .select('*', { count: 'exact', head: true })
      .eq('dataset_id', datasetId);

    if (countError) {
      throw new Error(`Failed to get entry count: ${countError.message}`);
    }

    // Get entries with aliases
    const { count: entriesWithAliases, error: aliasError } = await this.client
      .from('dataset_entries')
      .select('*', { count: 'exact', head: true })
      .eq('dataset_id', datasetId)
      .not('aliases', 'is', null);

    if (aliasError) {
      throw new Error(`Failed to get alias count: ${aliasError.message}`);
    }

    // Get countries and last updated
    const { data: statsData, error: statsError } = await this.client
      .from('dataset_entries')
      .select('countries, created_at')
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: false });

    if (statsError) {
      throw new Error(`Failed to get stats: ${statsError.message}`);
    }

    // Extract unique countries and calculate distribution
    const countries = new Set<string>();
    const countryCount: { [country: string]: number } = {};
    let lastUpdated = '';

    if (statsData && statsData.length > 0) {
      lastUpdated = statsData[0].created_at;

      statsData.forEach(entry => {
        if (entry.countries) {
          entry.countries.forEach((country: string) => {
            countries.add(country);
            countryCount[country] = (countryCount[country] || 0) + 1;
          });
        }
      });
    }

    // Calculate percentages
    const countryDistribution: { [country: string]: { count: number; percentage: number } } = {};
    const total = totalEntries || 0;

    Object.entries(countryCount).forEach(([country, count]) => {
      countryDistribution[country] = {
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      };
    });

    return {
      total_entries: totalEntries || 0,
      entries_with_aliases: entriesWithAliases || 0,
      countries: Array.from(countries),
      country_distribution: countryDistribution,
      last_updated: lastUpdated
    };
  }
}