#!/usr/bin/env node

/**
 * 修正的Dataset Matching性能测试脚本
 * 使用数据库中实际存在的实体进行测试
 */

const axios = require('axios');

// 测试配置 - 使用数据库中实际存在的实体
const CONFIG = {
  entitySearchUrl: 'http://localhost:3003',
  datasetMatchingUrl: 'http://localhost:3004',
  testEntity: 'Hunan University', // 数据库中存在的实体
  testLocation: 'China',
  testRuns: 3
};

// 性能监控工具
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
  }

  startTimer(name) {
    this.metrics[name] = { startTime: process.hrtime.bigint() };
  }

  endTimer(name) {
    if (this.metrics[name]) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - this.metrics[name].startTime) / 1000000;
      this.metrics[name].duration = duration;
      return duration;
    }
    return 0;
  }

  getMetrics() {
    const result = {};
    for (const [name, data] of Object.entries(this.metrics)) {
      result[name] = data.duration || 0;
    }
    return result;
  }

  reset() {
    this.metrics = {};
  }
}

// 主要测试类
class DatasetMatchingPerformanceTest {
  constructor() {
    this.monitor = new PerformanceMonitor();
    this.results = [];
  }

  // 测试Entity Search服务
  async testEntitySearch() {
    console.log('\n🔍 测试 Entity Search 服务...');
    this.monitor.startTimer('entity_search_total');

    try {
      const response = await axios.post(`${CONFIG.entitySearchUrl}/api/entity-search`, {
        company_name: CONFIG.testEntity,
        location: CONFIG.testLocation,
        include_risk_analysis: true
      }, {
        timeout: 120000
      });

      this.monitor.endTimer('entity_search_total');

      if (response.data.success) {
        const affiliatedCompanies = response.data.risk_analysis?.length || 0;
        console.log(`✅ Entity Search 完成: ${this.monitor.getMetrics().entity_search_total.toFixed(2)}ms`);
        console.log(`📊 发现 ${affiliatedCompanies} 个风险关键词关联公司`);

        return {
          success: true,
          data: response.data,
          affiliatedCompanies,
          metrics: {
            totalDuration: this.monitor.getMetrics().entity_search_total,
            searchDuration: response.data.metadata?.search_duration_ms || 0,
            totalQueries: response.data.metadata?.search_queries_executed || 0,
            apiCalls: response.data.metadata?.api_calls_made || 0
          }
        };
      } else {
        throw new Error(response.data.error || 'Entity Search 失败');
      }
    } catch (error) {
      this.monitor.endTimer('entity_search_total');
      console.error(`❌ Entity Search 失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        metrics: {
          totalDuration: this.monitor.getMetrics().entity_search_total
        }
      };
    }
  }

  // 测试Dataset Matching服务（直接匹配）
  async testDirectDatasetMatching() {
    console.log('\n🎯 测试直接 Dataset Matching...');
    this.monitor.startTimer('direct_matching_total');

    try {
      const response = await axios.post(`${CONFIG.datasetMatchingUrl}/api/dataset-matching/match`, {
        entity: CONFIG.testEntity,
        location: CONFIG.testLocation,
        maxResults: 20,
        forceRefresh: true
      }, {
        timeout: 30000
      });

      this.monitor.endTimer('direct_matching_total');

      if (response.data.success) {
        const matches = response.data.data?.length || 0;
        console.log(`✅ 直接匹配完成: ${this.monitor.getMetrics().direct_matching_total.toFixed(2)}ms`);
        console.log(`📊 找到 ${matches} 个直接匹配`);

        if (matches > 0) {
          console.log(`🎯 匹配结果: ${response.data.data.map(m => m.organization_name).join(', ')}`);
        }

        return {
          success: true,
          data: response.data.data,
          matchCount: matches,
          metrics: {
            totalDuration: this.monitor.getMetrics().direct_matching_total,
            processingTime: response.data.metadata?.processing_time_ms || 0,
            cacheUsed: response.data.metadata?.cache_used || false
          }
        };
      } else {
        throw new Error(response.data.error || 'Dataset Matching 失败');
      }
    } catch (error) {
      this.monitor.endTimer('direct_matching_total');
      console.error(`❌ 直接匹配失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        metrics: {
          totalDuration: this.monitor.getMetrics().direct_matching_total
        }
      };
    }
  }

  // 测试关联公司批量匹配
  async testAffiliatedBatchMatching(entitySearchResult) {
    if (!entitySearchResult.success || !entitySearchResult.data.risk_analysis) {
      console.log('⚠️  跳过关联公司测试（Entity Search 失败或无风险分析）');
      return { success: false, reason: 'No Entity Search data' };
    }

    console.log('\n🔗 测试关联公司批量匹配...');
    this.monitor.startTimer('affiliated_matching_total');

    // 准备关联公司数据
    const affiliatedCompanies = entitySearchResult.data.risk_analysis
      .filter(risk => risk.relationship_type !== 'No Evidence Found')
      .map(risk => ({
        company_name: risk.potential_intermediary_B?.[0] || risk.finding_summary.split(' ').slice(0, 3).join(' '),
        risk_keyword: risk.risk_keyword,
        relationship_type: risk.relationship_type,
        confidence_score: risk.severity === 'high' ? 0.9 : risk.severity === 'medium' ? 0.7 : 0.5
      }))
      .filter(ac => ac.company_name && ac.company_name.length > 2)
      .slice(0, 10);

    if (affiliatedCompanies.length === 0) {
      console.log('⚠️  没有找到关联公司');
      this.monitor.endTimer('affiliated_matching_total');
      return { success: false, reason: 'No affiliated companies found' };
    }

    console.log(`📊 处理 ${affiliatedCompanies.length} 个关联公司...`);
    console.log(`📝 关联公司列表: ${affiliatedCompanies.map(ac => ac.company_name).join(', ')}`);

    try {
      const response = await axios.post(`${CONFIG.datasetMatchingUrl}/api/dataset-matching/affiliated-match`, {
        entity: CONFIG.testEntity,
        affiliated_companies: affiliatedCompanies,
        location: CONFIG.testLocation,
        options: {
          maxResults: 20,
          forceRefresh: true,
          affiliatedBoost: 1.15
        }
      }, {
        timeout: 60000
      });

      this.monitor.endTimer('affiliated_matching_total');

      if (response.data.success) {
        const data = response.data.data;
        const directMatches = data.direct_matches?.length || 0;
        const affiliatedMatches = Object.values(data.affiliated_matches || {}).reduce((sum, matches) => sum + matches.length, 0);
        const totalMatches = directMatches + affiliatedMatches;

        console.log(`✅ 关联匹配完成: ${this.monitor.getMetrics().affiliated_matching_total.toFixed(2)}ms`);
        console.log(`📊 直接匹配: ${directMatches}, 关联匹配: ${affiliatedMatches}, 总计: ${totalMatches}`);

        return {
          success: true,
          data: response.data.data,
          metrics: {
            totalDuration: this.monitor.getMetrics().affiliated_matching_total,
            processingTime: response.data.metadata?.processing_time_ms || 0,
            directMatches,
            affiliatedMatches,
            totalMatches,
            affiliatedEntities: data.match_summary?.matched_affiliated_entities || 0
          }
        };
      } else {
        throw new Error(response.data.error || 'Affiliated Matching 失败');
      }
    } catch (error) {
      this.monitor.endTimer('affiliated_matching_total');
      console.error(`❌ 关联匹配失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        metrics: {
          totalDuration: this.monitor.getMetrics().affiliated_matching_total
        }
      };
    }
  }

  // 获取服务统计信息
  async getServiceStats() {
    try {
      const response = await axios.get(`${CONFIG.datasetMatchingUrl}/api/dataset-matching/stats`);
      return response.data;
    } catch (error) {
      console.warn('⚠️  无法获取服务统计:', error.message);
      return null;
    }
  }

  // 测试缓存效果
  async testCacheEffectiveness() {
    console.log('\n💾 测试缓存效果...');

    // 第一次查询（无缓存）
    console.log('📝 第一次查询（无缓存）...');
    const start1 = process.hrtime.bigint();
    const response1 = await axios.post(`${CONFIG.datasetMatchingUrl}/api/dataset-matching/match`, {
      entity: CONFIG.testEntity,
      location: CONFIG.testLocation,
      maxResults: 20,
      forceRefresh: true
    });
    const duration1 = Number(process.hrtime.bigint() - start1) / 1000000;

    // 第二次查询（缓存命中）
    console.log('📝 第二次查询（缓存命中）...');
    const start2 = process.hrtime.bigint();
    const response2 = await axios.post(`${CONFIG.datasetMatchingUrl}/api/dataset-matching/match`, {
      entity: CONFIG.testEntity,
      location: CONFIG.testLocation,
      maxResults: 20,
      forceRefresh: false
    });
    const duration2 = Number(process.hrtime.bigint() - start2) / 1000000;

    const speedup = duration1 / duration2;
    const improvement = ((duration1 - duration2) / duration1 * 100).toFixed(1);

    console.log(`✅ 缓存测试完成:`);
    console.log(`   第一次: ${duration1.toFixed(2)}ms (无缓存)`);
    console.log(`   第二次: ${duration2.toFixed(2)}ms (缓存命中)`);
    console.log(`   速度提升: ${speedup.toFixed(1)}x (${improvement}% 改进)`);

    return {
      firstQuery: duration1,
      secondQuery: duration2,
      speedup,
      improvement
    };
  }

  // 运行完整测试
  async runFullTest(testName = 'Test Run') {
    console.log(`\n🚀 开始 ${testName}`);
    console.log('='.repeat(60));

    const testStart = Date.now();
    this.monitor.reset();

    // 获取初始统计
    const initialStats = await this.getServiceStats();

    // 1. Entity Search测试
    const entitySearchResult = await this.testEntitySearch();

    // 2. 直接Dataset Matching测试
    const directMatchingResult = await this.testDirectDatasetMatching();

    // 3. 关联公司批量匹配测试
    const affiliatedMatchingResult = await this.testAffiliatedBatchMatching(entitySearchResult);

    // 4. 缓存效果测试
    const cacheResult = await this.testCacheEffectiveness();

    // 获取最终统计
    const finalStats = await this.getServiceStats();

    const totalDuration = Date.now() - testStart;
    const metrics = this.monitor.getMetrics();

    // 结果汇总
    const result = {
      testName,
      timestamp: new Date().toISOString(),
      totalDuration,
      metrics,
      entitySearch: entitySearchResult,
      directMatching: directMatchingResult,
      affiliatedMatching: affiliatedMatchingResult,
      cacheTest: cacheResult,
      cacheStats: {
        initial: initialStats?.data?.cache,
        final: finalStats?.data?.cache,
        difference: initialStats?.data?.cache && finalStats?.data?.cache ? {
          entriesAdded: finalStats.data.cache.entries - initialStats.data.cache.entries
        } : null
      },
      performance: {
        entitySearchTime: entitySearchResult.metrics?.totalDuration || 0,
        directMatchingTime: directMatchingResult.metrics?.totalDuration || 0,
        affiliatedMatchingTime: affiliatedMatchingResult.metrics?.totalDuration || 0,
        totalTime: totalDuration
      }
    };

    this.results.push(result);
    this.printResults(result);

    return result;
  }

  // 打印测试结果
  printResults(result) {
    console.log('\n📊 测试结果汇总:');
    console.log('='.repeat(60));
    console.log(`⏱️  总耗时: ${result.totalDuration}ms (${(result.totalDuration/1000).toFixed(2)}秒)`);
    console.log(`🔍 Entity Search: ${(result.entitySearch.metrics?.totalDuration || 0).toFixed(2)}ms`);
    console.log(`🎯 直接匹配: ${(result.directMatching.metrics?.totalDuration || 0).toFixed(2)}ms`);
    console.log(`🔗 关联匹配: ${(result.affiliatedMatching.metrics?.totalDuration || 0).toFixed(2)}ms`);

    if (result.entitySearch.success) {
      console.log(`📈 风险关键词: ${result.entitySearch.affiliatedCompanies} 个关联公司`);
    }

    if (result.directMatching.success) {
      console.log(`🎯 直接匹配: ${result.directMatching.matchCount} 个结果`);
    }

    if (result.affiliatedMatching.success) {
      console.log(`🔗 关联匹配: ${result.affiliatedMatching.metrics.totalMatches} 个结果 (${result.affiliatedMatching.metrics.affiliatedEntities} 个实体)`);
    }

    if (result.cacheTest) {
      console.log(`💾 缓存效果: ${result.cacheTest.speedup.toFixed(1)}x 加速`);
    }

    console.log('\n💾 缓存统计:');
    if (result.cacheStats.final) {
      console.log(`   缓存条目: ${result.cacheStats.final.entries}/${result.cacheStats.final.max_entries}`);
    }
    if (result.cacheStats.difference) {
      console.log(`   新增缓存: ${result.cacheStats.difference.entriesAdded} 条目`);
    }
  }

  // 运行多次测试取平均值
  async runMultipleTests() {
    console.log('\n🎯 开始多次性能测试...');
    console.log(`测试实体: ${CONFIG.testEntity}`);
    console.log(`测试次数: ${CONFIG.testRuns}`);
    console.log('='.repeat(60));

    const results = [];

    for (let i = 1; i <= CONFIG.testRuns; i++) {
      console.log(`\n--- 第 ${i}/${CONFIG.testRuns} 次测试 ---`);
      const result = await this.runFullTest(`Test Run ${i}`);
      results.push(result);

      // 测试间隔
      if (i < CONFIG.testRuns) {
        console.log('\n⏳ 等待 3 秒...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // 计算平均值
    this.printAverageResults(results);
    return results;
  }

  // 打印平均结果
  printAverageResults(results) {
    console.log('\n📈 平均性能统计:');
    console.log('='.repeat(60));

    const validResults = results.filter(r => r.entitySearch.success);
    if (validResults.length === 0) {
      console.log('❌ 没有成功的测试结果');
      return;
    }

    const avgTotalDuration = results.reduce((sum, r) => sum + r.totalDuration, 0) / results.length;
    const avgEntitySearch = validResults.reduce((sum, r) => sum + (r.entitySearch.metrics?.totalDuration || 0), 0) / validResults.length;
    const avgDirectMatching = results.filter(r => r.directMatching.success).reduce((sum, r) => sum + (r.directMatching.metrics?.totalDuration || 0), 0) / Math.max(1, results.filter(r => r.directMatching.success).length);
    const avgAffiliatedMatching = results.filter(r => r.affiliatedMatching.success).reduce((sum, r) => sum + (r.affiliatedMatching.metrics?.totalDuration || 0), 0) / Math.max(1, results.filter(r => r.affiliatedMatching.success).length);

    const avgCacheSpeedup = results.filter(r => r.cacheTest?.speedup).reduce((sum, r) => sum + r.cacheTest.speedup, 0) / Math.max(1, results.filter(r => r.cacheTest?.speedup).length);

    console.log(`⏱️  平均总耗时: ${avgTotalDuration.toFixed(2)}ms (${(avgTotalDuration/1000).toFixed(2)}秒)`);
    console.log(`🔍 平均Entity Search: ${avgEntitySearch.toFixed(2)}ms`);
    console.log(`🎯 平均直接匹配: ${avgDirectMatching.toFixed(2)}ms`);
    console.log(`🔗 平均关联匹配: ${avgAffiliatedMatching.toFixed(2)}ms`);
    console.log(`💾 平均缓存加速: ${avgCacheSpeedup.toFixed(1)}x`);

    // 性能对比
    const baselineTime = 35000; // 原始基准时间35秒
    const improvement = ((baselineTime - avgTotalDuration) / baselineTime * 100).toFixed(1);
    const speedup = (baselineTime / avgTotalDuration).toFixed(1);

    console.log('\n🚀 性能改进分析:');
    console.log(`   基准时间: ${(baselineTime/1000).toFixed(1)}秒`);
    console.log(`   当前时间: ${(avgTotalDuration/1000).toFixed(1)}秒`);
    console.log(`   性能提升: ${improvement}%`);
    console.log(`   速度倍数: ${speedup}x`);

    // Dataset Matching 性能分析
    const datasetMatchingTime = avgDirectMatching + avgAffiliatedMatching;
    console.log('\n🎯 Dataset Matching 细分性能:');
    console.log(`   直接匹配: ${avgDirectMatching.toFixed(2)}ms (${(avgDirectMatching/datasetMatchingTime*100).toFixed(1)}%)`);
    console.log(`   关联匹配: ${avgAffiliatedMatching.toFixed(2)}ms (${(avgAffiliatedMatching/datasetMatchingTime*100).toFixed(1)}%)`);
    console.log(`   总计: ${datasetMatchingTime.toFixed(2)}ms`);

    if (avgTotalDuration < 5000) {
      console.log('✅ 达到目标性能 (< 5秒)');
    } else if (avgTotalDuration < 10000) {
      console.log('⚠️  接近目标性能 (< 10秒)');
    } else {
      console.log('❌ 未达到目标性能 (> 10秒)');
    }
  }
}

// 主执行函数
async function main() {
  const tester = new DatasetMatchingPerformanceTest();

  try {
    await tester.runMultipleTests();
  } catch (error) {
    console.error('❌ 测试执行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { DatasetMatchingPerformanceTest };