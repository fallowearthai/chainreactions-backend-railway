import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
   * 获取所有Canadian NRO组织数据
   * @param testMode 测试模式：如果为true，只返回前6个实体以节省token
   * @returns Promise<NROOrganization[]> Canadian NRO组织列表
   */
  async getCanadianNRO(testMode: boolean = false): Promise<NROOrganization[]> {
    const entityCount = testMode ? 6 : undefined;
    console.log(`🔍 Fetching Canadian NRO organizations from Supabase... ${testMode ? '(TEST MODE - Limited to 6 entities)' : '(Full dataset - 103 entities)'}`);

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
        // 通过dataset_id关联查询Canadian Named Research Organizations数据集
        .eq('dataset_id', '93283166-d816-43c3-b060-264290a561ab')
        .order('organization_name', { ascending: true });

      if (testMode) {
        query = query.limit(6);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Supabase query error:', error);
        throw new Error(`Failed to fetch Canadian NRO data: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No Canadian NRO organizations found in database');
        return [];
      }

      console.log(`✅ Successfully fetched ${data.length} Canadian NRO organizations`);

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
      console.error('❌ Error fetching Canadian NRO data:', error);
      throw new Error(
        `SupabaseNROService.getCanadianNRO failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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