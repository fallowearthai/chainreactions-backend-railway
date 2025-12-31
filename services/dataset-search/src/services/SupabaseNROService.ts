import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  entity_count?: number;
  is_system: boolean;
  created_at: string;
  updated_at?: string;
  uploaded_by?: string;
  file_name?: string;
  schema_type?: string;
}

export interface NROOrganization {
  id: string;
  organization_name: string;
  countries: string[];
  aliases?: string[];
  category?: string;
  metadata?: any;
  dataset_source: string;
}

export interface SupabaseNROServiceConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
}

export class SupabaseNROService {
  private supabase: SupabaseClient;

  constructor(config?: SupabaseNROServiceConfig) {
    const supabaseUrl = config?.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config?.supabaseKey || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and API key are required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * 获取所有可用的数据集
   * @returns Promise<Dataset[]> 数据集列表
   */
  async getAvailableDatasets(): Promise<Dataset[]> {
    console.log('📋 Fetching available datasets from Supabase...');

    try {
      const { data, error } = await this.supabase
        .from('datasets')
        .select(`
          id,
          name,
          description,
          is_system,
          created_at,
          updated_at,
          created_by,
          publisher
        `)
        .eq('is_active', true) // Only get active datasets
        .order('is_system', { ascending: false }) // 系统数据集优先
        .order('name', { ascending: true });

      if (error) {
        console.error('❌ Supabase query error:', error);
        throw new Error(`Failed to fetch datasets: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No datasets found in database');
        return [];
      }

      console.log(`✅ Successfully fetched ${data.length} datasets`);

      // Get entity counts for each dataset
      const datasetsWithCounts = await Promise.all(
        data.map(async (row) => {
          try {
            const { count } = await this.supabase
              .from('dataset_entries')
              .select('*', { count: 'exact', head: true })
              .eq('dataset_id', row.id);

            return {
              id: row.id,
              name: row.name,
              description: row.description,
              entity_count: count || 0,
              is_system: row.is_system || false,
              created_at: row.created_at,
              updated_at: row.updated_at,
              uploaded_by: row.created_by,
              file_name: row.publisher, // Map publisher to file_name for compatibility
              schema_type: row.publisher
            };
          } catch (countError) {
            console.warn(`⚠️ Could not count entities for dataset ${row.id}:`, countError);
            return {
              id: row.id,
              name: row.name,
              description: row.description,
              entity_count: 0,
              is_system: row.is_system || false,
              created_at: row.created_at,
              updated_at: row.updated_at,
              uploaded_by: row.created_by,
              file_name: row.publisher,
              schema_type: row.publisher
            };
          }
        })
      );

      return datasetsWithCounts;

    } catch (error) {
      console.error('❌ Error fetching datasets:', error);
      throw new Error(
        `SupabaseNROService.getAvailableDatasets failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 根据数据集ID获取数据集条目
   * @param datasetId 数据集ID
   * @param testMode 测试模式：如果为true，只返回前6个实体以节省token
   * @returns Promise<NROOrganization[]> 数据集条目列表
   */
  async getDatasetEntries(datasetId: string, testMode: boolean = false): Promise<NROOrganization[]> {
    const entityCount = testMode ? 6 : undefined;
    console.log(`🔍 Fetching dataset entries for dataset: ${datasetId}... ${testMode ? '(TEST MODE - Limited to 6 entities)' : '(Full dataset)'}`);

    try {
      let query = this.supabase
        .from('dataset_entries')
        .select(`
          id,
          organization_name,
          countries,
          aliases,
          category,
          metadata,
          dataset_source
        `)
        .eq('dataset_id', datasetId)
        .order('organization_name', { ascending: true });

      if (testMode) {
        query = query.limit(6);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Supabase query error:', error);
        throw new Error(`Failed to fetch dataset entries: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.warn(`⚠️ No dataset entries found for dataset: ${datasetId}`);
        return [];
      }

      console.log(`✅ Successfully fetched ${data.length} dataset entries`);

      return data.map(row => ({
        id: row.id,
        organization_name: row.organization_name,
        countries: row.countries || [],
        aliases: row.aliases || [],
        category: row.category,
        metadata: row.metadata,
        dataset_source: row.dataset_source
      }));

    } catch (error) {
      console.error('❌ Error fetching dataset entries:', error);
      throw new Error(
        `SupabaseNROService.getDatasetEntries failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 获取所有Canadian NRO组织数据 (保持向后兼容性)
   * @param testMode 测试模式：如果为true，只返回前6个实体以节省token
   * @returns Promise<NROOrganization[]> Canadian NRO组织列表
   */
  async getCanadianNRO(testMode: boolean = false): Promise<NROOrganization[]> {
    const nroDatasetId = '93283166-d816-43c3-b060-264290a561ab';
    return this.getDatasetEntries(nroDatasetId, testMode);
  }

  /**
   * 根据组织名称搜索NRO组织（支持模糊匹配）
   * @param searchTerm 搜索词
   * @returns Promise<NROOrganization[]> 匹配的组织列表
   */
  async searchNROByName(searchTerm: string): Promise<NROOrganization[]> {
    console.log(`🔍 Searching NRO organizations for: "${searchTerm}"`);

    try {
      const { data, error } = await this.supabase
        .from('dataset_entries')
        .select(`
          id,
          organization_name,
          countries,
          aliases,
          category,
          metadata,
          dataset_source
        `)
        .eq('dataset_id', '93283166-d816-43c3-b060-264290a561ab')
        .ilike('organization_name', `%${searchTerm}%`)
        .order('organization_name', { ascending: true });

      if (error) {
        console.error('❌ Supabase search error:', error);
        throw new Error(`Failed to search NRO data: ${error.message}`);
      }

      console.log(`✅ Found ${data?.length || 0} matching NRO organizations`);

      return (data || []).map(row => ({
        id: row.id,
        organization_name: row.organization_name,
        countries: row.countries || [],
        aliases: row.aliases || [],
        category: row.category,
        metadata: row.metadata,
        dataset_source: row.dataset_source
      }));

    } catch (error) {
      console.error('❌ Error searching NRO data:', error);
      throw new Error(
        `SupabaseNROService.searchNROByName failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 获取NRO数据统计信息
   * @returns Promise<{total: number, byCountry: Record<string, number>}>
   */
  async getNROStatistics(): Promise<{
    total: number;
    byCountry: Record<string, number>;
    categories: Record<string, number>;
  }> {
    console.log('📊 Fetching NRO statistics...');

    try {
      const organizations = await this.getCanadianNRO();

      const total = organizations.length;
      const byCountry: Record<string, number> = {};
      const categories: Record<string, number> = {};

      organizations.forEach(org => {
        // 统计国家分布
        org.countries.forEach(country => {
          byCountry[country] = (byCountry[country] || 0) + 1;
        });

        // 统计类别分布
        if (org.category) {
          categories[org.category] = (categories[org.category] || 0) + 1;
        }
      });

      console.log(`✅ NRO Statistics - Total: ${total}, Countries: ${Object.keys(byCountry).length}`);

      return {
        total,
        byCountry,
        categories
      };

    } catch (error) {
      console.error('❌ Error getting NRO statistics:', error);
      throw new Error(
        `SupabaseNROService.getNROStatistics failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 测试数据库连接
   * @returns Promise<boolean> 连接是否成功
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔗 Testing Supabase connection...');

      const { data, error } = await this.supabase
        .from('dataset_entries')
        .select('id')
        .eq('dataset_id', '93283166-d816-43c3-b060-264290a561ab')
        .limit(1);

      if (error) {
        console.error('❌ Supabase connection test failed:', error);
        return false;
      }

      console.log('✅ Supabase connection test successful');
      return true;

    } catch (error) {
      console.error('❌ Supabase connection test error:', error);
      return false;
    }
  }
}