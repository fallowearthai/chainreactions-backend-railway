#!/usr/bin/env node

/**
 * Stage 2 独立测试脚本
 * 功能：运行完整的Stage 1 + Stage 2流程，并将结果保存为JSON文件
 */

// 加载环境变量
require('dotenv').config();

const fs = require('fs');
const path = require('path');

// 引入编译后的服务
const { WebSearchMetaPromptService } = require('./dist/services/WebSearchMetaPromptService');
const { SerpExecutorService } = require('./dist/services/SerpExecutorService');

async function runStage2Test() {
  console.log('🚀 Starting Stage 2 Independent Test');
  console.log('=====================================');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = `stage2-results-${timestamp}.json`;

  try {
    // 初始化服务
    console.log('🔧 Initializing services...');
    const metaPromptService = new WebSearchMetaPromptService();
    const serpExecutorService = new SerpExecutorService();

    // 测试参数配置
    const testRequest = {
      Target_institution: "NanoAcademic Technologies",
      Risk_Entity: "HongZhiWei",
      Location: "China"
    };

    console.log('📋 Test Configuration:');
    console.log(`  Target Institution: ${testRequest.Target_institution}`);
    console.log(`  Risk Entity: ${testRequest.Risk_Entity}`);
    console.log(`  Location: ${testRequest.Location}`);
    console.log('');

    // Stage 1: 生成搜索策略
    console.log('🎯 Stage 1: Generating search strategy with WebSearch meta-prompting...');
    const stage1StartTime = Date.now();

    const metaPromptResult = await metaPromptService.generateSearchStrategy(testRequest);

    const stage1ExecutionTime = Date.now() - stage1StartTime;

    console.log(`✅ Stage 1 completed in ${(stage1ExecutionTime / 1000).toFixed(2)}s`);
    console.log(`  Generated Keywords: ${metaPromptResult.search_strategy.search_keywords.length}`);
    console.log(`  Selected Engines: ${metaPromptResult.search_strategy.source_engine.join(', ')}`);
    console.log(`  Relationship Likelihood: ${metaPromptResult.search_strategy.relationship_likelihood}`);
    console.log('');

    // Stage 2: 执行SERP搜索
    console.log('🔍 Stage 2: Executing SERP searches across multiple engines...');
    const stage2StartTime = Date.now();

    const serpResults = await serpExecutorService.executeSearchStrategy(testRequest, metaPromptResult);

    const stage2ExecutionTime = Date.now() - stage2StartTime;

    console.log(`✅ Stage 2 completed in ${(stage2ExecutionTime / 1000).toFixed(2)}s`);
    console.log('');

    // 显示执行统计
    console.log('📊 Stage 2 Execution Summary:');
    console.log(`  Total Queries: ${serpResults.executionSummary.totalQueries}`);
    console.log(`  Successful Queries: ${serpResults.executionSummary.successfulQueries}`);
    console.log(`  Failed Queries: ${serpResults.executionSummary.failedQueries}`);
    console.log(`  Total Results: ${serpResults.executionSummary.totalResults}`);
    console.log(`  Engines Used: ${serpResults.executionSummary.enginesUsed.join(', ')}`);
    console.log(`  Success Rate: ${((serpResults.executionSummary.successfulQueries / serpResults.executionSummary.totalQueries) * 100).toFixed(1)}%`);

    if (serpResults.executionSummary.performanceMetrics) {
      console.log('');
      console.log('🎮 Engine Performance:');
      Object.entries(serpResults.executionSummary.performanceMetrics.engineSuccessRates).forEach(([engine, rate]) => {
        console.log(`  ${engine}: ${(rate * 100).toFixed(1)}% success rate`);
      });
    }
    console.log('');

    // 结果质量分析
    console.log('🔬 Result Quality Analysis:');
    console.log(`  Raw Results Count: ${serpResults.allResults.length}`);
    console.log(`  Consolidated Results Count: ${serpResults.consolidatedResults.length}`);
    console.log(`  Deduplication Rate: ${(((serpResults.allResults.reduce((sum, r) => sum + r.results.length, 0)) - serpResults.consolidatedResults.length) / serpResults.allResults.reduce((sum, r) => sum + r.results.length, 0) * 100).toFixed(1)}%`);

    // 显示Top 5结果预览
    console.log('');
    console.log('🏆 Top 5 Consolidated Results (by relevance):');
    serpResults.consolidatedResults.slice(0, 5).forEach((result, index) => {
      console.log(`  ${index + 1}. [${result.searchMetadata.relevanceScore.toFixed(1)}] ${result.title}`);
      console.log(`     ${result.url}`);
      console.log(`     Engine: ${result.searchMetadata.engine} | Keyword: "${result.searchMetadata.originalKeyword}"`);
      console.log('');
    });

    // 准备保存的数据
    const outputData = {
      test_metadata: {
        timestamp: new Date().toISOString(),
        test_request: testRequest,
        stage1_execution_time_ms: stage1ExecutionTime,
        stage2_execution_time_ms: stage2ExecutionTime,
        total_execution_time_ms: stage1ExecutionTime + stage2ExecutionTime
      },
      stage1_result: metaPromptResult,
      stage2_result: serpResults,
      summary: {
        stage1: {
          keywords_generated: metaPromptResult.search_strategy.search_keywords.length,
          engines_selected: metaPromptResult.search_strategy.source_engine.length,
          relationship_likelihood: metaPromptResult.search_strategy.relationship_likelihood
        },
        stage2: {
          total_queries: serpResults.executionSummary.totalQueries,
          successful_queries: serpResults.executionSummary.successfulQueries,
          total_results: serpResults.executionSummary.totalResults,
          consolidated_results: serpResults.consolidatedResults.length,
          engines_used: serpResults.executionSummary.enginesUsed,
          success_rate: ((serpResults.executionSummary.successfulQueries / serpResults.executionSummary.totalQueries) * 100).toFixed(1) + '%'
        }
      }
    };

    // 保存结果到JSON文件
    console.log('💾 Saving results to JSON file...');
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf8');

    console.log(`✅ Results saved to: ${path.resolve(outputFile)}`);
    console.log(`📁 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB`);
    console.log('');
    console.log('🎉 Stage 2 test completed successfully!');
    console.log('=====================================');

  } catch (error) {
    console.error('❌ Stage 2 test failed:', error);

    // 保存错误信息
    const errorData = {
      test_metadata: {
        timestamp: new Date().toISOString(),
        test_request: {
          Target_institution: "NanoAcademic Technologies",
          Risk_Entity: "HongZhiWei",
          Location: "China"
        }
      },
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    };

    const errorFile = `stage2-error-${timestamp}.json`;
    fs.writeFileSync(errorFile, JSON.stringify(errorData, null, 2), 'utf8');
    console.log(`💾 Error details saved to: ${errorFile}`);

    process.exit(1);
  }
}

// 执行测试
if (require.main === module) {
  runStage2Test();
}

module.exports = { runStage2Test };