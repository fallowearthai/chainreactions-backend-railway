require('dotenv').config();
const { SupabaseNROService } = require('./dist/services/SupabaseNROService');

async function testSupabaseNRO() {
  console.log('🧪 Testing SupabaseNROService...');

  try {
    const service = new SupabaseNROService();

    // 测试连接
    console.log('1. Testing connection...');
    const connected = await service.testConnection();
    console.log(`   Connection: ${connected ? '✅ Success' : '❌ Failed'}`);

    if (!connected) {
      throw new Error('Failed to connect to Supabase');
    }

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

    console.log('✅ SupabaseNROService test completed successfully!');

    return {
      success: true,
      totalOrganizations: organizations.length,
      stats
    };

  } catch (error) {
    console.error('❌ SupabaseNROService test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// 运行测试
testSupabaseNRO()
  .then(result => {
    console.log('\n📊 Test Result:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });