import { AggregatedSerpResults } from './SerpExecutorService';

export interface OptimizedSearchResult {
  title: string;
  url: string;
  snippet: string;
  engine: string;
  relevanceScore: number;
  searchKeywords: string[];
}

export interface OptimizedSerpResults {
  success: boolean;
  stage: number;
  optimizationMetadata: {
    originalResults: number;
    deduplicatedResults: number;
    compressionRatio: number;
    processingTime: number;
    filtersApplied: string[];
  };
  consolidatedResults: OptimizedSearchResult[];
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

export class ResultOptimizationService {

  /**
   * Main optimization method that removes duplicates, filters invalid results,
   * and compresses the data structure
   */
  optimizeResults(serpResults: AggregatedSerpResults): OptimizedSerpResults {
    const startTime = Date.now();
    const originalCount = serpResults.allResults.reduce((sum, result) => sum + result.results.length, 0);

    // Step 1: Extract and flatten all search results
    const flatResults = this.extractAllResults(serpResults);

    // Step 2: Remove duplicates by URL
    const deduplicatedResults = this.deduplicateByUrl(flatResults);

    // Step 3: Filter out invalid/low-quality results
    const filteredResults = this.filterInvalidResults(deduplicatedResults);

    // Step 4: Calculate relevance scores
    const scoredResults = this.calculateRelevanceScores(filteredResults);

    // Step 5: Sort by relevance and limit results
    const finalResults = this.sortAndLimitResults(scoredResults, 20);

    const processingTime = Date.now() - startTime;
    const compressionRatio = originalCount > 0 ? finalResults.length / originalCount : 0;

    return {
      success: true,
      stage: 2,
      optimizationMetadata: {
        originalResults: originalCount,
        deduplicatedResults: finalResults.length,
        compressionRatio: Math.round(compressionRatio * 100) / 100,
        processingTime,
        filtersApplied: [
          'URL deduplication',
          'Image search result filtering',
          'Minimal quality filtering',
          'Smart penalty scoring',
          'Relevance-based ranking',
          'Top 20 selection'
        ]
      },
      consolidatedResults: finalResults,
      executionSummary: serpResults.executionSummary
    };
  }

  /**
   * Extract all search results from the nested structure
   */
  private extractAllResults(serpResults: AggregatedSerpResults): Array<{
    title: string;
    url: string;
    snippet: string;
    engine: string;
    searchKeyword: string;
    position: number;
  }> {
    const allResults: Array<any> = [];

    for (const searchResult of serpResults.allResults) {
      const { searchKeyword, engine, results } = searchResult;

      for (const result of results) {
        if (result.type === 'organic' && result.url && result.title) {
          allResults.push({
            title: result.title,
            url: result.url,
            snippet: result.snippet || '',
            engine,
            searchKeyword,
            position: result.position || 999
          });
        }
      }
    }

    return allResults;
  }

  /**
   * Remove duplicate results based on URL normalization
   */
  private deduplicateByUrl(results: Array<any>): Array<any> {
    const urlMap = new Map<string, any>();

    for (const result of results) {
      const normalizedUrl = this.normalizeUrl(result.url);

      if (!urlMap.has(normalizedUrl)) {
        urlMap.set(normalizedUrl, {
          ...result,
          searchKeywords: [result.searchKeyword]
        });
      } else {
        // If duplicate, merge search keywords and keep the one with better snippet
        const existing = urlMap.get(normalizedUrl);
        if (!existing.searchKeywords.includes(result.searchKeyword)) {
          existing.searchKeywords.push(result.searchKeyword);
        }

        // Keep the result with better content (non-empty snippet preferred)
        if (!existing.snippet && result.snippet) {
          urlMap.set(normalizedUrl, {
            ...result,
            searchKeywords: existing.searchKeywords
          });
        }
      }
    }

    return Array.from(urlMap.values());
  }

  /**
   * Normalize URLs for better deduplication
   */
  private normalizeUrl(url: string): string {
    try {
      // Remove Baidu redirect patterns
      if (url.includes('baidu.com/link?url=')) {
        return url; // Keep as-is for now, could be improved with redirect resolution
      }

      const urlObj = new URL(url);

      // Remove common tracking parameters
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param));

      // Remove trailing slash and fragment
      urlObj.hash = '';
      let pathname = urlObj.pathname;
      if (pathname.endsWith('/') && pathname.length > 1) {
        pathname = pathname.slice(0, -1);
      }
      urlObj.pathname = pathname;

      return urlObj.toString().toLowerCase();
    } catch (error) {
      return url.toLowerCase();
    }
  }

  /**
   * Filter out only truly invalid results (minimal filtering)
   */
  private filterInvalidResults(results: Array<any>): Array<any> {
    return results.filter(result => {
      // Only filter out results with very short or missing titles
      if (!result.title || result.title.length < 5) {
        return false;
      }

      // Only filter out completely broken URLs
      if (!result.url || result.url.length < 10) {
        return false;
      }

      // Filter out image search results (Baidu image search, Google images, etc.)
      if (this.isImageSearchResult(result.url)) {
        return false;
      }

      // Keep all other results - quality will be handled by scoring
      return true;
    });
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

  /**
   * Calculate relevance scores based on multiple factors
   */
  private calculateRelevanceScores(results: Array<any>): OptimizedSearchResult[] {
    const targetKeywords = ['nanoacademic', 'hongzhiwei', '鸿之微', 'partnership', 'collaboration', '合作'];

    return results.map(result => {
      let score = 0;

      // Base score from search position (earlier positions get higher scores)
      score += Math.max(0, 20 - result.position);

      // Engine quality weight
      const engineWeights = { google: 1.2, baidu: 1.0, yandex: 1.0 };
      score *= engineWeights[result.engine as keyof typeof engineWeights] || 1.0;

      // Keyword relevance in title
      const titleLower = result.title.toLowerCase();
      targetKeywords.forEach(keyword => {
        if (titleLower.includes(keyword.toLowerCase())) {
          score += 10;
        }
      });

      // Keyword relevance in snippet
      const snippetLower = result.snippet.toLowerCase();
      targetKeywords.forEach(keyword => {
        if (snippetLower.includes(keyword.toLowerCase())) {
          score += 5;
        }
      });

      // Bonus for multiple search keywords matching
      score += result.searchKeywords.length * 3;

      // Penalty system for quality issues (instead of filtering)
      if (!result.snippet || result.snippet.trim().length === 0) {
        score *= 0.6; // Significant penalty for empty snippets
      } else if (result.snippet.length < 50) {
        score *= 0.8; // Moderate penalty for very short snippets
      }

      // PDF file handling: slight penalty but not excluded
      if (result.url.endsWith('.pdf')) {
        if (result.snippet && result.snippet.length > 30) {
          score *= 1.1; // Bonus for PDFs with good snippets (likely official docs)
        } else {
          score *= 0.7; // Penalty for PDFs without good snippets
        }
      }

      // Baidu redirect link penalty
      if (result.url.includes('baidu.com/link?url=')) {
        if (result.snippet && result.snippet.length > 20) {
          score *= 0.9; // Small penalty even with snippet
        } else {
          score *= 0.5; // Larger penalty without snippet
        }
      }

      // Bonus for official/academic domains
      const officialDomains = ['.edu', '.gov', '.org', 'nanoacademic.com', 'hzwtech.com'];
      if (officialDomains.some(domain => result.url.includes(domain))) {
        score *= 1.4; // Increased bonus for official domains
      }

      // Bonus for HTTPS (security/quality indicator)
      if (result.url.startsWith('https://')) {
        score *= 1.05;
      }

      return {
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        engine: result.engine,
        relevanceScore: Math.round(score * 100) / 100,
        searchKeywords: result.searchKeywords
      };
    });
  }

  /**
   * Sort by relevance score and limit to top N results
   */
  private sortAndLimitResults(results: OptimizedSearchResult[], limit: number): OptimizedSearchResult[] {
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(original: AggregatedSerpResults, optimized: OptimizedSerpResults): string {
    const originalSize = JSON.stringify(original).length;
    const optimizedSize = JSON.stringify(optimized).length;
    const sizeReduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);

    return `
Optimization Results:
- Original results: ${optimized.optimizationMetadata.originalResults}
- Deduplicated results: ${optimized.optimizationMetadata.deduplicatedResults}
- Compression ratio: ${optimized.optimizationMetadata.compressionRatio}
- Size reduction: ${sizeReduction}%
- Processing time: ${optimized.optimizationMetadata.processingTime}ms
- Filters applied: ${optimized.optimizationMetadata.filtersApplied.join(', ')}
    `.trim();
  }
}