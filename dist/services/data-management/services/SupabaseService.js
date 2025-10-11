"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class SupabaseService {
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            console.error('Supabase configuration check:', {
                SUPABASE_URL: !!supabaseUrl,
                SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
                NODE_ENV: process.env.NODE_ENV
            });
            throw new Error(`Missing Supabase configuration - URL: ${!!supabaseUrl}, Anon Key: ${!!process.env.SUPABASE_ANON_KEY}`);
        }
        this.client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    static getInstance() {
        if (!SupabaseService.instance) {
            SupabaseService.instance = new SupabaseService();
        }
        return SupabaseService.instance;
    }
    // Helper method to parse publisher JSON string
    parseDatasetPublisher(dataset) {
        if (dataset && typeof dataset.publisher === 'string') {
            try {
                dataset.publisher = JSON.parse(dataset.publisher);
            }
            catch (error) {
                console.warn('Failed to parse publisher JSON:', dataset.publisher);
                dataset.publisher = null;
            }
        }
        return dataset;
    }
    // Helper method to parse multiple datasets
    parseDatasets(datasets) {
        return datasets.map(dataset => this.parseDatasetPublisher(dataset));
    }
    // Dataset Management
    async getDatasets(page = 1, limit = 20) {
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
            datasets: this.parseDatasets(data || []),
            total: count || 0
        };
    }
    async getDatasetById(id) {
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
        return this.parseDatasetPublisher(data);
    }
    async findDatasetByName(name) {
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
        return this.parseDatasetPublisher(data);
    }
    async createDataset(dataset) {
        const { data, error } = await this.client
            .from('datasets')
            .insert({
            name: dataset.name,
            description: dataset.description,
            publisher: dataset.publisher ? JSON.stringify(dataset.publisher) : null,
            is_system: dataset.is_system || false,
            is_active: true
        })
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to create dataset: ${error.message}`);
        }
        return this.parseDatasetPublisher(data);
    }
    async updateDataset(id, updates) {
        // Prepare updates with proper publisher serialization
        const processedUpdates = { ...updates };
        if (updates.publisher !== undefined) {
            processedUpdates.publisher = updates.publisher ? JSON.stringify(updates.publisher) : null;
        }
        const { data, error } = await this.client
            .from('datasets')
            .update({
            ...processedUpdates,
            updated_at: new Date().toISOString()
        })
            .eq('id', id)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to update dataset: ${error.message}`);
        }
        return this.parseDatasetPublisher(data);
    }
    async deleteDataset(id) {
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
    async getDatasetEntries(datasetId, page = 1, limit = 50) {
        // Enforce reasonable limits to prevent excessive data transfer
        const safeLimit = Math.min(limit, 100); // Max 100 records per page
        const offset = (page - 1) * safeLimit;
        // Select only essential fields for list view to reduce data transfer
        const { data, error, count } = await this.client
            .from('dataset_entries')
            .select(`
        id,
        dataset_id,
        organization_name,
        aliases,
        countries,
        created_at,
        schema_type
      `, { count: 'exact' })
            .eq('dataset_id', datasetId)
            .order('created_at', { ascending: false })
            .range(offset, offset + safeLimit - 1);
        if (error) {
            throw new Error(`Failed to fetch dataset entries: ${error.message}`);
        }
        return {
            entries: data || [],
            total: count || 0
        };
    }
    async findEntryByExternalId(externalId) {
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
    async createDatasetEntry(entry) {
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
    async createDatasetEntries(entries) {
        const { data, error } = await this.client
            .from('dataset_entries')
            .insert(entries)
            .select();
        if (error) {
            throw new Error(`Failed to create dataset entries: ${error.message}`);
        }
        return data || [];
    }
    async updateDatasetEntry(id, updates) {
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
    async deleteDatasetEntry(id) {
        const { error } = await this.client
            .from('dataset_entries')
            .delete()
            .eq('id', id);
        if (error) {
            throw new Error(`Failed to delete dataset entry: ${error.message}`);
        }
    }
    async deleteDatasetEntries(datasetId) {
        const { error } = await this.client
            .from('dataset_entries')
            .delete()
            .eq('dataset_id', datasetId);
        if (error) {
            throw new Error(`Failed to delete dataset entries: ${error.message}`);
        }
    }
    // Search and Filter
    async searchDatasetEntries(datasetId, query, page = 1, limit = 50) {
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
    async getDatasetStats(datasetId) {
        try {
            // Get all stats in parallel queries - NO MORE PULLING ALL DATA!
            const [totalCount, aliasesCount, lastUpdated, countryData, entityTypesData] = await Promise.all([
                this.client
                    .from('dataset_entries')
                    .select('*', { count: 'exact', head: true })
                    .eq('dataset_id', datasetId),
                this.client
                    .from('dataset_entries')
                    .select('*', { count: 'exact', head: true })
                    .eq('dataset_id', datasetId)
                    .not('aliases', 'is', null),
                this.client
                    .from('dataset_entries')
                    .select('created_at')
                    .eq('dataset_id', datasetId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single(),
                this.client
                    .from('dataset_entries')
                    .select('countries')
                    .eq('dataset_id', datasetId),
                this.client
                    .from('dataset_entries')
                    .select('schema_type')
                    .eq('dataset_id', datasetId)
            ]);
            if (totalCount.error)
                throw totalCount.error;
            if (aliasesCount.error)
                throw aliasesCount.error;
            if (lastUpdated.error)
                throw lastUpdated.error;
            if (countryData.error)
                throw countryData.error;
            if (entityTypesData.error)
                throw entityTypesData.error;
            // Process country distribution efficiently (including unknown)
            const countries = new Set();
            const countryCount = {};
            let unknownCountryCount = 0;
            countryData.data?.forEach((entry) => {
                if (entry.countries && Array.isArray(entry.countries) && entry.countries.length > 0) {
                    entry.countries.forEach((country) => {
                        if (country && country.trim() && country.toLowerCase() !== 'n/a') {
                            countries.add(country);
                            countryCount[country] = (countryCount[country] || 0) + 1;
                        }
                        else {
                            unknownCountryCount++;
                        }
                    });
                }
                else {
                    unknownCountryCount++;
                }
            });
            // Add unknown category if there are any unknown countries
            if (unknownCountryCount > 0) {
                countries.add('Unknown');
                countryCount['Unknown'] = unknownCountryCount;
            }
            // Process entity types distribution
            const entityTypesCount = {};
            const entityTypesSet = new Set();
            entityTypesData.data?.forEach((entry) => {
                const entityType = entry.schema_type || 'Organization';
                entityTypesSet.add(entityType);
                entityTypesCount[entityType] = (entityTypesCount[entityType] || 0) + 1;
            });
            // Calculate percentages
            const totalEntries = totalCount.count || 0;
            const entriesWithAliases = aliasesCount.count || 0;
            const countryDistribution = {};
            Object.entries(countryCount).forEach(([country, count]) => {
                countryDistribution[country] = {
                    count,
                    percentage: totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0
                };
            });
            const entityTypesDistribution = {};
            Object.entries(entityTypesCount).forEach(([type, count]) => {
                entityTypesDistribution[type] = {
                    count,
                    percentage: totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0
                };
            });
            return {
                total_entries: totalEntries,
                entries_with_aliases: entriesWithAliases,
                countries: Array.from(countries),
                country_distribution: countryDistribution,
                entity_types: entityTypesDistribution,
                last_updated: lastUpdated.data?.created_at || ''
            };
        }
        catch (error) {
            throw error;
        }
    }
}
exports.SupabaseService = SupabaseService;
//# sourceMappingURL=SupabaseService.js.map