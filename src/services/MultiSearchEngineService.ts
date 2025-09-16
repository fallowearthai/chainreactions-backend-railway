import {
  SearchEngineService,
  SearchEngineName,
  MultiEngineSearchRequest,
  MultiEngineSearchResponse,
  SearchEngineResult,
  SearchResultItem,
  EngineSelectionStrategy,
  SearchAggregationConfig
} from '../types/searchEngines';
import { BingSearchService } from './searchEngines/BingSearchService';
import { DuckDuckGoService } from './searchEngines/DuckDuckGoService';

export class MultiSearchEngineService implements EngineSelectionStrategy {
  private engines: Map<SearchEngineName, SearchEngineService>;
  private aggregationConfig: SearchAggregationConfig;

  constructor() {
    this.engines = new Map();
    this.initializeEngines();

    this.aggregationConfig = {
      deduplication_threshold: 0.8,
      confidence_weights: {
        'google': 1.0,
        'bing': 0.9,
        'duckduckgo': 0.7,
        'baidu': 0.8,
        'yandex': 0.8
      },
      max_results_per_engine: 20,
      min_engines_for_high_confidence: 2
    };
  }

  private initializeEngines(): void {
    // Initialize available search engines
    try {
      const bingService = new BingSearchService();
      if (bingService.isAvailable()) {
        this.engines.set('bing', bingService);
        console.log('✅ Bing Search Engine initialized');
      } else {
        console.log('⚠️ Bing Search Engine not available (missing API key)');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Bing Search:', error);
    }

    try {
      const duckduckgoService = new DuckDuckGoService();
      if (duckduckgoService.isAvailable()) {
        this.engines.set('duckduckgo', duckduckgoService);
        console.log('✅ DuckDuckGo Search Engine initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize DuckDuckGo Search:', error);
    }

    console.log(`🔍 Total search engines available: ${this.engines.size}`);
  }

  selectEngines(
    location: string,
    riskCategory: string,
    languages: string[]
  ): { engines: SearchEngineName[]; reasoning: string } {
    const selectedEngines: SearchEngineName[] = [];
    const reasons: string[] = [];

    // Always include Google as baseline (note: we'll need to handle this separately since we don't have Google service yet)
    // selectedEngines.push('google');
    // reasons.push('Google for baseline global search');

    // Geographic-based selection
    const locationLower = location.toLowerCase();

    if (['china', 'hong kong', 'taiwan', 'macau'].some(region => locationLower.includes(region))) {
      if (this.engines.has('bing')) {
        selectedEngines.push('bing');
        reasons.push('Bing for balanced China-accessible search');
      }
      if (this.engines.has('duckduckgo')) {
        selectedEngines.push('duckduckgo');
        reasons.push('DuckDuckGo for uncensored China search');
      }
      // TODO: Add Baidu when implemented
      reasons.push('Chinese search engines needed for local content');
    }

    if (['russia', 'belarus', 'kazakhstan', 'ukraine'].some(region => locationLower.includes(region))) {
      if (this.engines.has('bing')) {
        selectedEngines.push('bing');
        reasons.push('Bing for Eastern Europe search');
      }
      if (this.engines.has('duckduckgo')) {
        selectedEngines.push('duckduckgo');
        reasons.push('DuckDuckGo for uncensored Russian region search');
      }
      // TODO: Add Yandex when implemented
      reasons.push('Russian search engines needed for Cyrillic content');
    }

    if (['iran', 'syria', 'lebanon', 'iraq'].some(region => locationLower.includes(region))) {
      if (this.engines.has('bing')) {
        selectedEngines.push('bing');
        reasons.push('Bing for Middle East search');
      }
      if (this.engines.has('duckduckgo')) {
        selectedEngines.push('duckduckgo');
        reasons.push('DuckDuckGo for uncensored Middle East search');
      }
      reasons.push('Multiple engines needed due to regional content restrictions');
    }

    // Default selection for other regions
    if (selectedEngines.length === 0) {
      if (this.engines.has('bing')) {
        selectedEngines.push('bing');
        reasons.push('Bing as primary search engine');
      }
      if (this.engines.has('duckduckgo')) {
        selectedEngines.push('duckduckgo');
        reasons.push('DuckDuckGo for additional coverage');
      }
    }

    // Risk category based additions
    if (riskCategory === 'academic' || riskCategory === 'technology') {
      // Academic searches benefit from multiple perspectives
      reasons.push('Academic/technology searches benefit from diverse sources');
    }

    if (riskCategory === 'government' || riskCategory === 'military') {
      // Sensitive searches need uncensored sources
      if (this.engines.has('duckduckgo') && !selectedEngines.includes('duckduckgo')) {
        selectedEngines.push('duckduckgo');
        reasons.push('DuckDuckGo added for sensitive government/military searches');
      }
    }

    // Ensure we have at least one engine
    if (selectedEngines.length === 0 && this.engines.size > 0) {
      const firstEngine = Array.from(this.engines.keys())[0];
      selectedEngines.push(firstEngine);
      reasons.push(`Fallback to ${firstEngine} as default`);
    }

    return {
      engines: selectedEngines,
      reasoning: reasons.join('; ')
    };
  }

  async searchMultipleEngines(request: MultiEngineSearchRequest): Promise<MultiEngineSearchResponse> {
    const startTime = Date.now();

    // Determine which engines to use
    const selectedEngines = request.engines || this.selectEngines(
      request.location,
      'unknown', // We'd need this from context
      request.languages
    ).engines;

    console.log(`🔍 Multi-engine search: "${request.query}" using [${selectedEngines.join(', ')}]`);

    const resultsByEngine: Record<string, SearchEngineResult> = {};
    const searchPromises: Promise<void>[] = [];

    let enginesSucceeded = 0;
    let enginesFailed = 0;

    // Execute searches in parallel
    for (const engineName of selectedEngines) {
      const engine = this.engines.get(engineName);
      if (!engine) {
        console.warn(`⚠️ Engine ${engineName} not available`);
        enginesFailed++;
        continue;
      }

      const searchPromise = engine.search(request.query, {
        count: request.max_results_per_engine || this.aggregationConfig.max_results_per_engine,
        language: request.languages[0], // Use first language as primary
        safe_search: 'moderate'
      })
        .then(result => {
          resultsByEngine[engineName] = result;
          enginesSucceeded++;
          console.log(`✅ ${engineName}: ${result.results.length} results in ${result.metadata.search_time}ms`);
        })
        .catch(error => {
          console.error(`❌ ${engineName} search failed:`, error.message);
          enginesFailed++;
        });

      searchPromises.push(searchPromise);
    }

    // Wait for all searches to complete
    await Promise.all(searchPromises);

    // Aggregate results
    const aggregatedResults = this.aggregateResults(resultsByEngine);
    const totalTime = Date.now() - startTime;

    console.log(`🎯 Multi-search completed: ${enginesSucceeded}/${selectedEngines.length} engines succeeded, ${aggregatedResults.length} total results`);

    return {
      query: request.query,
      engines_used: selectedEngines,
      results_by_engine: resultsByEngine,
      aggregated_results: aggregatedResults,
      metadata: {
        total_results: aggregatedResults.length,
        total_time: totalTime,
        engines_succeeded: enginesSucceeded,
        engines_failed: enginesFailed,
        timestamp: new Date().toISOString()
      }
    };
  }

  private aggregateResults(resultsByEngine: Record<SearchEngineName, SearchEngineResult>): SearchResultItem[] {
    const allResults: Array<SearchResultItem & { engine: SearchEngineName; score: number }> = [];

    // Collect all results with scoring
    for (const [engineName, engineResult] of Object.entries(resultsByEngine)) {
      const engineWeight = this.aggregationConfig.confidence_weights[engineName as SearchEngineName] || 0.5;

      for (const [index, result] of engineResult.results.entries()) {
        // Score based on engine weight and position
        const positionScore = Math.max(0, 1 - (index * 0.1)); // Higher score for earlier results
        const finalScore = engineWeight * positionScore;

        allResults.push({
          ...result,
          engine: engineName as SearchEngineName,
          score: finalScore
        });
      }
    }

    // Deduplicate based on URL similarity
    const dedupedResults = this.deduplicateResults(allResults);

    // Sort by score (highest first)
    dedupedResults.sort((a, b) => b.score - a.score);

    // Remove score field and return clean results
    return dedupedResults.map(({ score, engine, ...result }) => result);
  }

  private deduplicateResults(results: Array<SearchResultItem & { engine: SearchEngineName; score: number }>): Array<SearchResultItem & { engine: SearchEngineName; score: number }> {
    const dedupedResults: Array<SearchResultItem & { engine: SearchEngineName; score: number }> = [];
    const seenUrls = new Set<string>();

    for (const result of results) {
      const url = this.normalizeUrl(result.url);

      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        dedupedResults.push(result);
      } else {
        // If we've seen this URL, check if this result has a higher score
        const existingIndex = dedupedResults.findIndex(r => this.normalizeUrl(r.url) === url);
        if (existingIndex >= 0 && dedupedResults[existingIndex].score < result.score) {
          dedupedResults[existingIndex] = result; // Replace with higher scored version
        }
      }
    }

    return dedupedResults;
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove common tracking parameters
      urlObj.searchParams.delete('utm_source');
      urlObj.searchParams.delete('utm_medium');
      urlObj.searchParams.delete('utm_campaign');
      urlObj.searchParams.delete('fbclid');
      urlObj.searchParams.delete('gclid');

      return urlObj.toString();
    } catch {
      return url; // Return original if URL parsing fails
    }
  }

  // Health check for all engines
  async healthCheck(): Promise<Record<string, { available: boolean; response_time?: number; message: string }>> {
    const health: Record<string, { available: boolean; response_time?: number; message: string }> = {};

    for (const [engineName, engine] of this.engines) {
      try {
        if ('testConnection' in engine) {
          const result = await (engine as any).testConnection();
          health[engineName] = {
            available: result.success,
            response_time: result.response_time,
            message: result.message
          };
        } else {
          health[engineName] = {
            available: engine.isAvailable(),
            message: engine.isAvailable() ? 'Available' : 'Not configured'
          };
        }
      } catch (error: any) {
        health[engineName] = {
          available: false,
          message: `Health check failed: ${error.message}`
        };
      }
    }

    return health;
  }

  getAvailableEngines(): SearchEngineName[] {
    return Array.from(this.engines.keys());
  }

  getEngineConfigs(): Record<string, any> {
    const configs: Record<string, any> = {};
    for (const [engineName, engine] of this.engines) {
      configs[engineName] = engine.getConfig();
    }
    return configs;
  }
}