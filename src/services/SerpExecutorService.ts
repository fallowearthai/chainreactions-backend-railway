import { BrightDataSerpService } from './BrightDataSerpService';
import { MetaPromptResult } from './WebSearchMetaPromptService';
import { ResultOptimizationService, OptimizedSerpResults } from './ResultOptimizationService';
import { SearchRequest } from '../types/gemini';

export interface SerpExecutionResult {
  searchKeyword: string;
  engine: string;
  results: any[];
  metadata: {
    totalResults: number;
    searchTime: number;
    engine: string;
    country?: string;
    language?: string;
  };
}

export interface AggregatedSerpResults {
  allResults: SerpExecutionResult[];
  consolidatedResults: any[];
  executionSummary: {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    totalResults: number;
    enginesUsed: string[];
    executionTime: number;
    performanceMetrics?: {
      averageResponseTime: number;
      engineSuccessRates: Record<string, number>;
      retrySuccessCount: number;
    };
  };
}

interface SearchTask {
  keyword: string;
  engine: string;
  type: 'keyword' | 'operator';
  priority: number;
  options: {
    num_results: number;
    country: string;
    language: string;
    timeRange?: string;
  };
}

export class SerpExecutorService {
  private serpService: BrightDataSerpService;
  private optimizationService: ResultOptimizationService;

  constructor() {
    this.serpService = new BrightDataSerpService();
    this.optimizationService = new ResultOptimizationService();
  }

  async executeSearchStrategy(
    request: SearchRequest,
    metaPromptResult: MetaPromptResult
  ): Promise<AggregatedSerpResults> {

    const startTime = Date.now();
    const allResults: SerpExecutionResult[] = [];

    try {
      // Generate search tasks based on meta prompt strategy
      const searchTasks = this.generateSearchTasks(metaPromptResult);

      console.log(`🚀 Executing ${searchTasks.length} optimized search tasks across ${metaPromptResult.search_strategy.source_engine.length} engines`);

      // Execute searches with enhanced concurrency control
      const results = await this.executeSearchesWithConcurrency(searchTasks, 3);
      allResults.push(...results);

      // Consolidate and deduplicate results with enhanced scoring
      const consolidatedResults = this.consolidateResults(allResults, metaPromptResult);

      const executionTime = Date.now() - startTime;

      // Calculate performance metrics
      const successfulResults = results.filter(r => r.results.length > 0);
      const avgResponseTime = allResults.length > 0 ?
        allResults.reduce((sum, r) => sum + r.metadata.searchTime, 0) / allResults.length : 0;

      const engineSuccessRates: Record<string, number> = {};
      for (const engine of metaPromptResult.search_strategy.source_engine) {
        const engineTasks = searchTasks.filter(t => t.engine === engine).length;
        const engineSuccesses = successfulResults.filter(r => r.engine === engine).length;
        engineSuccessRates[engine] = engineTasks > 0 ? engineSuccesses / engineTasks : 0;
      }

      return {
        allResults,
        consolidatedResults,
        executionSummary: {
          totalQueries: searchTasks.length,
          successfulQueries: successfulResults.length,
          failedQueries: searchTasks.length - successfulResults.length,
          totalResults: consolidatedResults.length,
          enginesUsed: [...new Set(results.map(r => r.engine))],
          executionTime,
          performanceMetrics: {
            averageResponseTime: avgResponseTime,
            engineSuccessRates,
            retrySuccessCount: 0
          }
        }
      };

    } catch (error) {
      console.error('❌ SERP execution failed:', error);
      throw new Error(`SERP execution failed: ${error}`);
    }
  }

  /**
   * Execute search strategy and return optimized results
   * This is the enhanced version that includes result optimization
   */
  async executeSearchStrategyOptimized(
    request: SearchRequest,
    metaPromptResult: MetaPromptResult
  ): Promise<OptimizedSerpResults> {
    try {
      console.log('🚀 Starting optimized SERP execution workflow...');

      // Step 1: Execute standard search strategy
      const standardResults = await this.executeSearchStrategy(request, metaPromptResult);

      // Step 2: Apply optimization
      console.log('🔧 Applying result optimization...');
      const optimizedResults = this.optimizationService.optimizeResults(standardResults);

      console.log(`✅ Optimization complete: ${standardResults.allResults.reduce((sum, r) => sum + r.results.length, 0)} → ${optimizedResults.consolidatedResults.length} results`);

      return optimizedResults;

    } catch (error) {
      console.error('❌ Optimized SERP execution failed:', error);
      throw new Error(`Optimized SERP execution failed: ${error}`);
    }
  }

  /**
   * Execute optimized search strategy with progress callbacks for SSE
   */
  async executeSearchStrategyOptimizedWithProgress(
    request: SearchRequest,
    metaPromptResult: MetaPromptResult,
    progressCallback: (progress: string, current?: number, total?: number) => void
  ): Promise<OptimizedSerpResults> {
    try {
      console.log('🚀 Starting optimized SERP execution workflow with progress...');
      progressCallback('Initializing search tasks...');

      // Step 1: Execute standard search strategy with progress
      const standardResults = await this.executeSearchStrategyWithProgress(request, metaPromptResult, progressCallback);

      // Step 2: Apply optimization
      progressCallback('Optimizing and consolidating results...');
      console.log('🔧 Applying result optimization...');
      const optimizedResults = this.optimizationService.optimizeResults(standardResults);

      console.log(`✅ Optimization complete: ${standardResults.allResults.reduce((sum, r) => sum + r.results.length, 0)} → ${optimizedResults.consolidatedResults.length} results`);
      progressCallback(`Optimization complete: ${optimizedResults.consolidatedResults.length} consolidated results`);

      return optimizedResults;

    } catch (error) {
      console.error('❌ Optimized SERP execution failed:', error);
      progressCallback(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Optimized SERP execution failed: ${error}`);
    }
  }

  /**
   * Execute search strategy with progress callbacks
   */
  private async executeSearchStrategyWithProgress(
    request: SearchRequest,
    metaPromptResult: MetaPromptResult,
    progressCallback: (progress: string, current?: number, total?: number) => void
  ): Promise<AggregatedSerpResults> {
    const startTime = Date.now();
    const tasks = this.generateSearchTasks(metaPromptResult);

    progressCallback(`Generated ${tasks.length} search tasks`, 0, tasks.length);

    const results: SerpExecutionResult[] = [];
    const BATCH_SIZE = 3; // Process 3 searches concurrently
    let completedTasks = 0;

    // Process tasks in batches
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);

      // Update progress for current batch
      const batchStart = i + 1;
      const batchEnd = Math.min(i + BATCH_SIZE, tasks.length);
      progressCallback(`Executing searches ${batchStart}-${batchEnd} of ${tasks.length}...`, completedTasks, tasks.length);

      // Execute batch of searches concurrently
      const batchPromises = batch.map(async (task) => {
        try {
          const engineProgress = `Searching ${task.engine} for "${task.keyword}"...`;
          progressCallback(engineProgress, completedTasks, tasks.length);

          const result = await this.executeSingleSearch(task);
          completedTasks++;

          progressCallback(`Completed ${task.engine} search (${completedTasks}/${tasks.length})`, completedTasks, tasks.length);
          return result;
        } catch (error) {
          completedTasks++;
          console.error(`Search failed for ${task.keyword} on ${task.engine}:`, error);
          progressCallback(`Failed ${task.engine} search (${completedTasks}/${tasks.length})`, completedTasks, tasks.length);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Add successful results
      for (const result of batchResults) {
        if (result) {
          results.push(result);
        }
      }

      // Small delay between batches to avoid overwhelming the API
      if (i + BATCH_SIZE < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    progressCallback('Consolidating search results...', tasks.length, tasks.length);

    // Consolidate results
    const consolidatedResults = this.consolidateResults(results, metaPromptResult);
    const executionTime = Date.now() - startTime;

    const summary = {
      totalQueries: tasks.length,
      successfulQueries: results.length,
      failedQueries: tasks.length - results.length,
      totalResults: consolidatedResults.length,
      enginesUsed: [...new Set(results.map(r => r.engine))],
      executionTime
    };

    progressCallback(`Search execution complete: ${summary.successfulQueries}/${summary.totalQueries} successful`);

    return {
      allResults: results,
      consolidatedResults,
      executionSummary: summary
    };
  }

  private generateSearchTasks(metaPromptResult: MetaPromptResult): SearchTask[] {
    const tasks: SearchTask[] = [];
    const { search_strategy } = metaPromptResult;

    console.log(`📋 Generating search tasks for ${search_strategy.search_keywords.length} keywords across ${search_strategy.source_engine.length} engines`);

    // Generate tasks for each keyword on each engine
    for (const keyword of search_strategy.search_keywords) {
      for (const engine of search_strategy.source_engine) {
        tasks.push({
          keyword,
          engine,
          type: 'keyword',
          priority: this.calculateKeywordPriority(keyword, metaPromptResult),
          options: {
            num_results: 25, // Increased for better coverage
            country: search_strategy.country_code || 'us',
            language: search_strategy.languages[0] || 'en',
          }
        });
      }
    }

    // Sort by priority and return all tasks
    const sortedTasks = tasks.sort((a, b) => b.priority - a.priority);

    console.log(`✅ Generated ${sortedTasks.length} search tasks (${search_strategy.search_keywords.length} keywords × ${search_strategy.source_engine.length} engines)`);

    return sortedTasks;
  }

  private calculateKeywordPriority(keyword: string, metaPromptResult: MetaPromptResult): number {
    let priority = 5;
    const keywordLower = keyword.toLowerCase();

    // Extract entity names from Stage 1 results
    const entityAName = metaPromptResult.entity_a.original_name.toLowerCase();
    const entityBName = metaPromptResult.entity_b.original_name.toLowerCase();

    // Higher priority for exact entity name matches
    if (keywordLower.includes(entityAName) || keywordLower.includes(entityBName)) {
      priority += 4;
    }

    // Higher priority for partial entity name matches (company name components)
    const entityAWords = entityAName.split(/\s+/);
    const entityBWords = entityBName.split(/\s+/);
    const hasEntityWord = [...entityAWords, ...entityBWords].some(word =>
      word.length > 3 && keywordLower.includes(word)
    );
    if (hasEntityWord) {
      priority += 3;
    }

    // Higher priority for relationship keywords (common patterns)
    const relationshipTerms = [
      'partnership', 'collaboration', 'cooperation', 'agreement', 'contract',
      'deal', 'acquisition', 'merger', 'joint venture', 'alliance',
      '合作', '伙伴', '协议', '合同', '收购', '并购', '联合'
    ];
    if (relationshipTerms.some(term => keywordLower.includes(term))) {
      priority += 2;
    }

    // Medium priority for sector-specific terms
    const allSectors = [...metaPromptResult.entity_a.sectors, ...metaPromptResult.entity_b.sectors];
    if (allSectors.some(sector => keywordLower.includes(sector.toLowerCase()))) {
      priority += 1;
    }

    return priority;
  }

  private async executeSearchesWithConcurrency(
    tasks: SearchTask[],
    concurrency: number
  ): Promise<SerpExecutionResult[]> {
    const results: SerpExecutionResult[] = [];
    const failedTasks: SearchTask[] = [];

    // Group tasks by engine for better load distribution
    const tasksByEngine = this.groupTasksByEngine(tasks);

    // Process each engine's tasks
    for (const [engine, engineTasks] of tasksByEngine) {
      console.log(`🔍 Processing ${engineTasks.length} tasks for ${engine}`);

      const engineResults = await this.executeEngineTasksBatch(engineTasks, concurrency);
      results.push(...engineResults.successful);
      failedTasks.push(...engineResults.failed);

      // Delay between engines
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Simple retry for critical failed tasks
    if (failedTasks.length > 0) {
      console.log(`🔄 Retrying ${Math.min(failedTasks.length, 5)} critical failed tasks`);
      const retryResults = await this.retryFailedTasks(failedTasks.slice(0, 5));
      results.push(...retryResults);
    }

    return results;
  }

  private groupTasksByEngine(tasks: SearchTask[]): Map<string, SearchTask[]> {
    const grouped = new Map<string, SearchTask[]>();

    for (const task of tasks) {
      if (!grouped.has(task.engine)) {
        grouped.set(task.engine, []);
      }
      grouped.get(task.engine)!.push(task);
    }

    return grouped;
  }

  private async executeEngineTasksBatch(
    tasks: SearchTask[],
    concurrency: number
  ): Promise<{ successful: SerpExecutionResult[]; failed: SearchTask[] }> {
    const successful: SerpExecutionResult[] = [];
    const failed: SearchTask[] = [];

    // Process in batches
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);

      const batchPromises = batch.map(task => this.executeSingleSearchWithTimeout(task, 30000));
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const task = batch[j];

        if (result.status === 'fulfilled' && result.value) {
          successful.push(result.value);
        } else {
          failed.push(task);
          console.warn(`❌ Search failed for "${task.keyword}" on ${task.engine}`);
        }
      }

      // Adaptive delay based on performance
      if (i + concurrency < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return { successful, failed };
  }

  private async executeSingleSearchWithTimeout(task: SearchTask, timeout: number): Promise<SerpExecutionResult | null> {
    return new Promise(async (resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn(`⏰ Search timeout for "${task.keyword}" on ${task.engine}`);
        resolve(null);
      }, timeout);

      try {
        const result = await this.executeSingleSearch(task);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        resolve(null);
      }
    });
  }

  private async retryFailedTasks(failedTasks: SearchTask[]): Promise<SerpExecutionResult[]> {
    const retryResults: SerpExecutionResult[] = [];
    const fallbackEngines = ['google', 'yandex'];

    for (const task of failedTasks) {
      // Try one alternative engine
      for (const fallbackEngine of fallbackEngines) {
        if (fallbackEngine !== task.engine) {
          try {
            const retryTask = { ...task, engine: fallbackEngine };
            const result = await this.executeSingleSearchWithTimeout(retryTask, 20000);

            if (result) {
              retryResults.push(result);
              console.log(`✅ Retry successful for "${task.keyword}" using ${fallbackEngine}`);
              break;
            }
          } catch (error) {
            // Silent fail for retries
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return retryResults;
  }

  private async executeSingleSearch(task: SearchTask): Promise<SerpExecutionResult | null> {
    const searchStartTime = Date.now();

    try {
      console.log(`🔍 Searching "${task.keyword}" on ${task.engine}`);

      const searchResult = await this.serpService.searchSingleEngine(
        task.engine as any,
        task.keyword,
        {
          country: task.options.country,
          language: task.options.language,
          num_results: task.options.num_results
        }
      );

      const searchTime = Date.now() - searchStartTime;

      return {
        searchKeyword: task.keyword,
        engine: task.engine,
        results: searchResult.results || [],
        metadata: {
          totalResults: searchResult.results?.length || 0,
          searchTime,
          engine: task.engine,
          country: task.options.country,
          language: task.options.language
        }
      };

    } catch (error) {
      console.error(`❌ Search failed for "${task.keyword}" on ${task.engine}:`, error);
      return null;
    }
  }

  private consolidateResults(serpResults: SerpExecutionResult[], metaPromptResult: MetaPromptResult): any[] {
    const resultMap = new Map<string, any>();
    const seenUrls = new Set<string>();

    // Collect and deduplicate results
    for (const serpResult of serpResults) {
      for (const result of serpResult.results) {
        const url = result.url || result.link;
        if (!url) continue;

        // Filter out image search results
        if (this.isImageSearchResult(url)) continue;

        const normalizedUrl = this.normalizeUrl(url);
        if (seenUrls.has(normalizedUrl)) continue;

        seenUrls.add(normalizedUrl);

        // Enhanced result with metadata
        const enhancedResult = {
          ...result,
          searchMetadata: {
            originalKeyword: serpResult.searchKeyword,
            engine: serpResult.engine,
            relevanceScore: this.calculateEnhancedRelevanceScore(result, serpResult, metaPromptResult)
          }
        };

        resultMap.set(normalizedUrl, enhancedResult);
      }
    }

    // Sort by relevance and return top results
    const consolidatedResults = Array.from(resultMap.values());
    return consolidatedResults
      .sort((a, b) => b.searchMetadata.relevanceScore - a.searchMetadata.relevanceScore)
      .slice(0, 60);
  }

  private calculateEnhancedRelevanceScore(result: any, serpResult: SerpExecutionResult, metaPromptResult: MetaPromptResult): number {
    const keyword = serpResult.searchKeyword.toLowerCase();
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const url = (result.url || '').toLowerCase();

    let score = 0;

    // Entity matching
    if (this.containsEntityNames(title + ' ' + snippet, metaPromptResult)) score += 5;

    // Title relevance
    if (title.includes(keyword.split(' ')[0])) score += 3;

    // Snippet relevance
    if (snippet.includes(keyword.split(' ')[0])) score += 2;

    // Domain authority
    if (url.includes('.edu') || url.includes('.gov')) score += 2;
    if (url.includes('.org')) score += 1;
    if (url.includes('.cn') && keyword.includes('china')) score += 1;

    // Penalty for social media
    if (url.includes('twitter.com') || url.includes('facebook.com')) score -= 1;

    // Search type bonus
    if (serpResult.searchKeyword.includes('"') || serpResult.searchKeyword.includes('AND')) {
      score += 2;
    }

    return Math.max(score, 0);
  }

  private containsEntityNames(content: string, metaPromptResult: MetaPromptResult): boolean {
    // Extract entity names from Stage 1 results
    const entityAName = metaPromptResult.entity_a.original_name.toLowerCase();
    const entityBName = metaPromptResult.entity_b.original_name.toLowerCase();

    // Create entity terms for matching
    const entityTerms: string[] = [];

    // Add full entity names
    entityTerms.push(entityAName, entityBName);

    // Add significant words from entity names (longer than 3 characters)
    const entityAWords = entityAName.split(/\s+/).filter(word => word.length > 3);
    const entityBWords = entityBName.split(/\s+/).filter(word => word.length > 3);
    entityTerms.push(...entityAWords, ...entityBWords);

    // Check if content contains any entity terms
    return entityTerms.some(term => content.includes(term));
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove tracking parameters
      urlObj.searchParams.delete('utm_source');
      urlObj.searchParams.delete('utm_medium');
      urlObj.searchParams.delete('utm_campaign');
      urlObj.searchParams.delete('fbclid');
      urlObj.searchParams.delete('gclid');
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * Check if a URL is an image search result that should be filtered out
   */
  private isImageSearchResult(url: string): boolean {
    const imageSearchPatterns = [
      'image.baidu.com/search', // Baidu image search
      'images.google.com',      // Google image search
      'www.google.com/search.*tbm=isch', // Google image search via tbm parameter
      'yandex.com/images',      // Yandex image search
      'search.yahoo.com/search.*&p=.*&fr=yfp-t&ei=UTF-8&fp=1', // Yahoo image search
      '/imgres?', // Google image result redirects
      'tn=baiduimage', // Baidu image search parameter
    ];

    return imageSearchPatterns.some(pattern => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(url);
      } catch (error) {
        // Fallback to simple string matching if regex fails
        return url.toLowerCase().includes(pattern.toLowerCase());
      }
    });
  }

  // Helper method to get execution statistics
  getExecutionStats(results: AggregatedSerpResults): string {
    const { executionSummary } = results;

    return `
🎯 SERP Execution Summary:
- Total Queries: ${executionSummary.totalQueries}
- Successful: ${executionSummary.successfulQueries}
- Failed: ${executionSummary.failedQueries}
- Total Results: ${executionSummary.totalResults}
- Engines Used: ${executionSummary.enginesUsed.join(', ')}
- Execution Time: ${(executionSummary.executionTime / 1000).toFixed(2)}s
- Success Rate: ${((executionSummary.successfulQueries / executionSummary.totalQueries) * 100).toFixed(1)}%
${executionSummary.performanceMetrics ? `
📊 Performance Metrics:
- Avg Response Time: ${(executionSummary.performanceMetrics.averageResponseTime / 1000).toFixed(2)}s
- Engine Success Rates: ${Object.entries(executionSummary.performanceMetrics.engineSuccessRates)
  .map(([engine, rate]) => `${engine}: ${(rate * 100).toFixed(1)}%`)
  .join(', ')}` : ''}
    `.trim();
  }
}