import { BrightDataSerpService } from './BrightDataSerpService';
import { MetaPromptResult } from './WebSearchMetaPromptService';
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
  };
}

export class SerpExecutorService {
  private serpService: BrightDataSerpService;

  constructor() {
    this.serpService = new BrightDataSerpService();
  }

  async executeSearchStrategy(
    request: SearchRequest,
    metaPromptResult: MetaPromptResult
  ): Promise<AggregatedSerpResults> {

    const startTime = Date.now();
    const allResults: SerpExecutionResult[] = [];

    try {
      // Execute searches based on meta prompt strategy
      const searchTasks = this.generateSearchTasks(metaPromptResult);

      console.log(`Executing ${searchTasks.length} search tasks across ${metaPromptResult.searchEngines.length} engines`);

      // Execute searches in parallel with concurrency limit
      const results = await this.executeSearchesWithConcurrency(searchTasks, 3);
      allResults.push(...results);

      // Consolidate and deduplicate results
      const consolidatedResults = this.consolidateResults(allResults);

      const executionTime = Date.now() - startTime;

      return {
        allResults,
        consolidatedResults,
        executionSummary: {
          totalQueries: searchTasks.length,
          successfulQueries: results.filter(r => r.results.length > 0).length,
          failedQueries: searchTasks.length - results.filter(r => r.results.length > 0).length,
          totalResults: consolidatedResults.length,
          enginesUsed: [...new Set(results.map(r => r.engine))],
          executionTime
        }
      };

    } catch (error) {
      console.error('SERP execution failed:', error);
      throw new Error(`SERP execution failed: ${error}`);
    }
  }

  private generateSearchTasks(metaPromptResult: MetaPromptResult): SearchTask[] {
    const tasks: SearchTask[] = [];
    const { searchKeywords, searchEngines, searchStrategy } = metaPromptResult;

    // Generate tasks for each keyword on each engine
    for (const keyword of searchKeywords) {
      for (const engine of searchEngines) {
        tasks.push({
          keyword,
          engine,
          options: {
            num_results: 20,
            country: searchStrategy.regions[0] || 'us',
            language: searchStrategy.languages[0] || 'en',
            timeRange: searchStrategy.timeRange
          }
        });
      }
    }

    // Limit total tasks to manage API costs and execution time
    return tasks.slice(0, 40); // Max 40 searches
  }

  private async executeSearchesWithConcurrency(
    tasks: SearchTask[],
    concurrency: number
  ): Promise<SerpExecutionResult[]> {
    const results: SerpExecutionResult[] = [];

    // Process tasks in batches
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);

      const batchPromises = batch.map(task => this.executeSingleSearch(task));
      const batchResults = await Promise.allSettled(batchPromises);

      // Process batch results
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];

        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else {
          console.warn(`Search failed for task ${i + j}:`,
            result.status === 'rejected' ? result.reason : 'Unknown error');
        }
      }

      // Add delay between batches to respect rate limits
      if (i + concurrency < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  private async executeSingleSearch(task: SearchTask): Promise<SerpExecutionResult | null> {
    const searchStartTime = Date.now();

    try {
      console.log(`Searching "${task.keyword}" on ${task.engine}`);

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
      console.error(`Search failed for "${task.keyword}" on ${task.engine}:`, error);
      return null;
    }
  }

  private consolidateResults(allResults: SerpExecutionResult[]): any[] {
    const resultMap = new Map<string, any>();
    const seenUrls = new Set<string>();

    // Flatten all results and deduplicate by URL
    for (const serpResult of allResults) {
      for (const result of serpResult.results) {
        const url = result.url || result.link;

        if (!url || seenUrls.has(url)) continue;

        seenUrls.add(url);

        // Enhance result with search metadata
        const enhancedResult = {
          ...result,
          searchMetadata: {
            originalKeyword: serpResult.searchKeyword,
            engine: serpResult.engine,
            relevanceScore: this.calculateRelevanceScore(result, serpResult.searchKeyword)
          }
        };

        resultMap.set(url, enhancedResult);
      }
    }

    // Convert to array and sort by relevance
    const consolidatedResults = Array.from(resultMap.values());

    return consolidatedResults
      .sort((a, b) => b.searchMetadata.relevanceScore - a.searchMetadata.relevanceScore)
      .slice(0, 50); // Top 50 most relevant results
  }

  private calculateRelevanceScore(result: any, keyword: string): number {
    let score = 0;

    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    // Score based on keyword presence in title (higher weight)
    if (title.includes(lowerKeyword)) score += 3;

    // Score based on keyword presence in snippet
    if (snippet.includes(lowerKeyword)) score += 2;

    // Score based on domain authority (simple heuristic)
    const url = (result.url || '').toLowerCase();
    if (url.includes('.edu')) score += 2;
    if (url.includes('.gov')) score += 2;
    if (url.includes('.org')) score += 1;

    // Penalty for social media (less reliable for OSINT)
    if (url.includes('twitter.com') || url.includes('facebook.com')) score -= 1;

    return Math.max(score, 0);
  }

  // Helper method to get execution statistics
  getExecutionStats(results: AggregatedSerpResults): string {
    const { executionSummary } = results;

    return `
SERP Execution Summary:
- Total Queries: ${executionSummary.totalQueries}
- Successful: ${executionSummary.successfulQueries}
- Failed: ${executionSummary.failedQueries}
- Total Results: ${executionSummary.totalResults}
- Engines Used: ${executionSummary.enginesUsed.join(', ')}
- Execution Time: ${(executionSummary.executionTime / 1000).toFixed(2)}s
- Success Rate: ${((executionSummary.successfulQueries / executionSummary.totalQueries) * 100).toFixed(1)}%
    `.trim();
  }
}

interface SearchTask {
  keyword: string;
  engine: string;
  options: {
    num_results: number;
    country: string;
    language: string;
    timeRange?: string;
  };
}