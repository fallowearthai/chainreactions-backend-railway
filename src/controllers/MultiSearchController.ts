import { Request, Response } from 'express';
import { MultiSearchEngineService } from '../services/MultiSearchEngineService';
import { MultiEngineSearchRequest } from '../types/searchEngines';

export class MultiSearchController {
  private multiSearchService: MultiSearchEngineService;

  constructor() {
    this.multiSearchService = new MultiSearchEngineService();
  }

  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      console.log('🏥 Multi-search engine health check requested');

      const healthStatus = await this.multiSearchService.healthCheck();
      const availableEngines = this.multiSearchService.getAvailableEngines();
      const engineConfigs = this.multiSearchService.getEngineConfigs();

      console.log(`📊 Health check completed: ${availableEngines.length} engines available`);

      res.status(200).json({
        success: true,
        available_engines: availableEngines,
        health_status: healthStatus,
        engine_configs: engineConfigs,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Multi-search health check error:', error);
      res.status(500).json({
        success: false,
        error: `Health check failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  async searchMultiple(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔍 Multi-engine search request:', {
        body: req.body,
        timestamp: new Date().toISOString()
      });

      const searchRequest: MultiEngineSearchRequest = {
        query: req.body.query || '',
        location: req.body.location || 'Global',
        languages: req.body.languages || ['english'],
        engines: req.body.engines, // Optional, let system choose if not provided
        max_results_per_engine: req.body.max_results_per_engine || 10,
        search_type: req.body.search_type || 'general'
      };

      // Validate required fields
      if (!searchRequest.query.trim()) {
        res.status(400).json({
          success: false,
          error: 'Query is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Execute multi-engine search
      const results = await this.multiSearchService.searchMultipleEngines(searchRequest);

      console.log('✅ Multi-search completed:', {
        query: results.query,
        engines_used: results.engines_used,
        total_results: results.metadata.total_results,
        processing_time: results.metadata.total_time,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        data: results,
        metadata: {
          processing_time: results.metadata.total_time,
          engines_used: results.engines_used.length,
          engines_succeeded: results.metadata.engines_succeeded,
          engines_failed: results.metadata.engines_failed,
          total_results: results.metadata.total_results,
          timestamp: results.metadata.timestamp
        }
      });

    } catch (error: any) {
      console.error('Multi-search error:', error);
      res.status(500).json({
        success: false,
        error: `Multi-search failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  async testEngineSelection(req: Request, res: Response): Promise<void> {
    try {
      const location = req.body?.location || req.query?.location || 'Global';
      const riskCategory = req.body?.risk_category || req.query?.risk_category || 'unknown';
      const languages = req.body?.languages || req.query?.languages || ['english'];

      console.log(`🎯 Testing engine selection for: ${location}, ${riskCategory}`);

      const selection = this.multiSearchService.selectEngines(
        location as string,
        riskCategory as string,
        Array.isArray(languages) ? languages : [languages]
      );

      const availableEngines = this.multiSearchService.getAvailableEngines();

      res.status(200).json({
        success: true,
        input: {
          location,
          risk_category: riskCategory,
          languages
        },
        selection,
        available_engines: availableEngines,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Engine selection test error:', error);
      res.status(500).json({
        success: false,
        error: `Engine selection test failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  async quickTest(req: Request, res: Response): Promise<void> {
    try {
      console.log('🧪 Running quick multi-search test...');

      const testQuery = 'HongZhiWei Technologies NanoAcademic';
      const testRequest: MultiEngineSearchRequest = {
        query: testQuery,
        location: 'China',
        languages: ['english', 'chinese'],
        max_results_per_engine: 5
      };

      const results = await this.multiSearchService.searchMultipleEngines(testRequest);

      // Summarize results for easy viewing
      const summary = {
        query: results.query,
        engines_used: results.engines_used,
        results_per_engine: {} as Record<string, number>,
        sample_results: {} as Record<string, any[]>
      };

      for (const [engine, engineResults] of Object.entries(results.results_by_engine)) {
        summary.results_per_engine[engine] = engineResults.results.length;
        summary.sample_results[engine] = engineResults.results.slice(0, 2).map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet.substring(0, 100) + '...'
        }));
      }

      console.log('🎯 Quick test completed:', {
        total_results: results.metadata.total_results,
        processing_time: results.metadata.total_time,
        engines_succeeded: results.metadata.engines_succeeded
      });

      res.status(200).json({
        success: true,
        test: 'Multi-engine search quick test',
        results: summary,
        full_results: results,
        metadata: results.metadata,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Quick test error:', error);
      res.status(500).json({
        success: false,
        error: `Quick test failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  async compareEngines(req: Request, res: Response): Promise<void> {
    try {
      const query = req.body?.query || req.query?.query || 'test search';

      console.log(`⚖️ Engine comparison test for: "${query}"`);

      const testRequest: MultiEngineSearchRequest = {
        query: query as string,
        location: 'Global',
        languages: ['english'],
        max_results_per_engine: 10
      };

      const results = await this.multiSearchService.searchMultipleEngines(testRequest);

      // Create comparison analysis
      const comparison = {
        query,
        engines_tested: results.engines_used,
        performance: {} as Record<string, any>,
        result_overlap: this.analyzeResultOverlap(results.results_by_engine),
        aggregation_summary: {
          total_unique_results: results.aggregated_results.length,
          deduplication_effectiveness: this.calculateDeduplicationStats(results.results_by_engine, results.aggregated_results)
        }
      };

      // Analyze each engine's performance
      for (const [engine, engineResults] of Object.entries(results.results_by_engine)) {
        comparison.performance[engine] = {
          results_count: engineResults.results.length,
          response_time: engineResults.metadata.search_time,
          total_estimated: engineResults.metadata.total_results,
          avg_snippet_length: engineResults.results.reduce((sum, r) => sum + r.snippet.length, 0) / engineResults.results.length || 0,
          url_domains: [...new Set(engineResults.results.map(r => {
            try { return new URL(r.url).hostname; } catch { return 'unknown'; }
          }))]
        };
      }

      console.log('📊 Engine comparison completed');

      res.status(200).json({
        success: true,
        comparison,
        raw_results: results,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Engine comparison error:', error);
      res.status(500).json({
        success: false,
        error: `Engine comparison failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  private analyzeResultOverlap(resultsByEngine: Record<string, any>): any {
    const engines = Object.keys(resultsByEngine);
    const overlap: Record<string, any> = {};

    for (let i = 0; i < engines.length; i++) {
      for (let j = i + 1; j < engines.length; j++) {
        const engine1 = engines[i];
        const engine2 = engines[j];

        const urls1 = new Set(resultsByEngine[engine1].results.map((r: any) => r.url));
        const urls2 = new Set(resultsByEngine[engine2].results.map((r: any) => r.url));

        const intersection = new Set([...urls1].filter(url => urls2.has(url)));
        const union = new Set([...urls1, ...urls2]);

        const overlapKey = `${engine1}_vs_${engine2}`;
        overlap[overlapKey] = {
          common_urls: intersection.size,
          total_unique_urls: union.size,
          overlap_percentage: union.size > 0 ? (intersection.size / union.size * 100).toFixed(2) : 0
        };
      }
    }

    return overlap;
  }

  private calculateDeduplicationStats(resultsByEngine: Record<string, any>, aggregatedResults: any[]): any {
    let totalResultsBeforeDedup = 0;
    for (const engineResults of Object.values(resultsByEngine)) {
      totalResultsBeforeDedup += (engineResults as any).results.length;
    }

    return {
      results_before_dedup: totalResultsBeforeDedup,
      results_after_dedup: aggregatedResults.length,
      dedup_ratio: totalResultsBeforeDedup > 0 ?
        ((totalResultsBeforeDedup - aggregatedResults.length) / totalResultsBeforeDedup * 100).toFixed(2) : 0
    };
  }
}