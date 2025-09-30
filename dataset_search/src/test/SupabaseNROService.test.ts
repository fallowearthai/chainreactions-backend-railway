import { SupabaseNROService } from '../services/SupabaseNROService';

describe('SupabaseNROService', () => {
  let service: SupabaseNROService;

  beforeAll(async () => {
    // 使用环境变量配置Supabase
    service = new SupabaseNROService();
  });

  describe('Connection Test', () => {
    it('should connect to Supabase successfully', async () => {
      const isConnected = await service.testConnection();
      expect(isConnected).toBe(true);
    });
  });

  describe('Canadian NRO Data', () => {
    it('should fetch Canadian NRO organizations', async () => {
      const organizations = await service.getCanadianNRO();

      expect(Array.isArray(organizations)).toBe(true);
      expect(organizations.length).toBeGreaterThan(0);

      // 验证数据结构
      if (organizations.length > 0) {
        const org = organizations[0];
        expect(org).toHaveProperty('id');
        expect(org).toHaveProperty('organization_name');
        expect(org).toHaveProperty('countries');
        expect(org).toHaveProperty('dataset_source');
        expect(org.dataset_source).toBe('Canadian NRO');
      }
    });

    it('should have approximately 103 organizations', async () => {
      const organizations = await service.getCanadianNRO();

      // 允许一些数据变动，但应该接近103个
      expect(organizations.length).toBeGreaterThan(90);
      expect(organizations.length).toBeLessThan(120);
    });
  });

  describe('Search Functionality', () => {
    it('should search organizations by name', async () => {
      const searchResults = await service.searchNROByName('University');

      expect(Array.isArray(searchResults)).toBe(true);

      // 验证搜索结果包含搜索词
      searchResults.forEach(org => {
        expect(org.organization_name.toLowerCase()).toContain('university');
      });
    });

    it('should return empty array for non-existent organization', async () => {
      const searchResults = await service.searchNROByName('NonExistentOrganization12345');
      expect(searchResults).toEqual([]);
    });
  });

  describe('Statistics', () => {
    it('should return valid statistics', async () => {
      const stats = await service.getNROStatistics();

      expect(typeof stats.total).toBe('number');
      expect(stats.total).toBeGreaterThan(0);
      expect(typeof stats.byCountry).toBe('object');
      expect(typeof stats.categories).toBe('object');
    });
  });
});

// 手动测试函数（可以直接运行）
export async function manualTest() {
  console.log('🧪 Starting manual test of SupabaseNROService...');

  try {
    const service = new SupabaseNROService();

    // 测试连接
    console.log('1. Testing connection...');
    const connected = await service.testConnection();
    console.log(`   Connection: ${connected ? '✅ Success' : '❌ Failed'}`);

    // 获取组织数据
    console.log('2. Fetching Canadian NRO organizations...');
    const organizations = await service.getCanadianNRO();
    console.log(`   Found ${organizations.length} organizations`);

    // 显示前3个组织
    console.log('3. Sample organizations:');
    organizations.slice(0, 3).forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.organization_name} (${org.countries.join(', ')})`);
    });

    // 测试搜索
    console.log('4. Testing search functionality...');
    const searchResults = await service.searchNROByName('University');
    console.log(`   Search for "University": ${searchResults.length} results`);

    // 获取统计信息
    console.log('5. Getting statistics...');
    const stats = await service.getNROStatistics();
    console.log(`   Total: ${stats.total}`);
    console.log(`   Countries: ${Object.keys(stats.byCountry).length}`);
    console.log(`   Top countries: ${Object.entries(stats.byCountry)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([country, count]) => `${country}(${count})`)
      .join(', ')}`);

    console.log('✅ Manual test completed successfully!');

  } catch (error) {
    console.error('❌ Manual test failed:', error);
  }
}

// 如果直接运行此文件，执行手动测试
if (require.main === module) {
  manualTest();
}