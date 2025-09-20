import * as fs from 'fs';
import * as path from 'path';
import { ResultOptimizationService } from './src/services/ResultOptimizationService';
import { AggregatedSerpResults } from './src/services/SerpExecutorService';

async function testOptimization() {
  try {
    console.log('🔧 Starting Stage 2 Results Optimization Test...\n');

    // Read the original stage2 result file
    const stage2FilePath = path.join(__dirname, 'stage2_result.json');
    console.log(`📁 Reading original file: ${stage2FilePath}`);

    const originalData = JSON.parse(fs.readFileSync(stage2FilePath, 'utf-8'));
    console.log(`📊 Original file size: ${fs.statSync(stage2FilePath).size} bytes`);

    // Extract the SERP results from the nested structure
    const serpResults: AggregatedSerpResults = originalData.serp_results;

    if (!serpResults || !serpResults.allResults) {
      throw new Error('Invalid SERP results structure');
    }

    console.log(`🔍 Original structure analysis:`);
    console.log(`   - Total search queries: ${serpResults.allResults.length}`);
    console.log(`   - Total raw results: ${serpResults.allResults.reduce((sum, r) => sum + r.results.length, 0)}`);
    console.log(`   - Engines used: ${serpResults.executionSummary.enginesUsed.join(', ')}`);

    // Initialize optimization service
    const optimizationService = new ResultOptimizationService();

    // Optimize the results
    console.log('\n🚀 Applying optimization algorithms...');
    const optimizedResults = optimizationService.optimizeResults(serpResults);

    // Create optimized version with same structure as original
    const optimizedData = {
      success: true,
      stage: 2,
      optimization_applied: true,
      optimization_metadata: optimizedResults.optimizationMetadata,
      consolidated_results: optimizedResults.consolidatedResults,
      execution_summary: optimizedResults.executionSummary
    };

    // Save optimized results
    const optimizedFilePath = path.join(__dirname, 'stage2_result_optimized.json');
    console.log(`💾 Attempting to save to: ${optimizedFilePath}`);

    try {
      fs.writeFileSync(optimizedFilePath, JSON.stringify(optimizedData, null, 2));
      console.log(`✅ File written successfully`);
    } catch (writeError) {
      console.error(`❌ Failed to write file:`, writeError);
      throw writeError;
    }

    const optimizedFileSize = fs.statSync(optimizedFilePath).size;
    console.log(`\n💾 Optimized file saved: ${optimizedFilePath}`);
    console.log(`📊 Optimized file size: ${optimizedFileSize} bytes`);

    // Display optimization statistics
    const stats = optimizationService.getOptimizationStats(serpResults, optimizedResults);
    console.log(`\n📈 ${stats}`);

    // Show sample of optimized results
    console.log('\n🎯 Top 5 Optimized Results:');
    optimizedResults.consolidatedResults.slice(0, 5).forEach((result, index) => {
      console.log(`\n${index + 1}. [Score: ${result.relevanceScore}] ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Engine: ${result.engine}`);
      console.log(`   Keywords: ${result.searchKeywords.join(', ')}`);
      if (result.snippet) {
        console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
      }
    });

    console.log('\n✅ Optimization test completed successfully!');
    console.log(`🎉 File size reduced by ${(((fs.statSync(stage2FilePath).size - optimizedFileSize) / fs.statSync(stage2FilePath).size) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Optimization test failed:', error);
    process.exit(1);
  }
}

// Run the test
testOptimization();