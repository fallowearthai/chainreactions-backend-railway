import { Request, Response } from 'express';
import { SearchRequest, SearchResult } from '../types/gemini';
import { WebSearchMetaPromptService } from '../services/WebSearchMetaPromptService';
import { SerpExecutorService } from '../services/SerpExecutorService';
import { ResultIntegrationService } from '../services/ResultIntegrationService';

export class EnhancedSearchController {
  private metaPromptService: WebSearchMetaPromptService;
  private serpExecutorService: SerpExecutorService;
  private resultIntegrationService: ResultIntegrationService;

  constructor() {
    this.metaPromptService = new WebSearchMetaPromptService();
    this.serpExecutorService = new SerpExecutorService();
    this.resultIntegrationService = new ResultIntegrationService();
  }

  async enhancedSearch(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate request
      const searchRequest = this.validateSearchRequest(req.body);

      console.log(`Starting enhanced search for: ${searchRequest.Target_institution} vs ${searchRequest.Risk_Entity}`);

      // Stage 1: Generate search strategy using WebSearch meta-prompting
      console.log('Stage 1: Generating search strategy with WebSearch...');
      const metaPromptResult = await this.metaPromptService.generateSearchStrategy(searchRequest);

      console.log(`Generated ${metaPromptResult.search_strategy.search_keywords.length} keywords for ${metaPromptResult.search_strategy.source_engine.length} engines`);
      console.log(`Relationship likelihood: ${metaPromptResult.search_strategy.relationship_likelihood}`);

      // Stage 2: Execute SERP searches based on strategy
      console.log('Stage 2: Executing SERP searches...');
      const serpResults = await this.serpExecutorService.executeSearchStrategy(searchRequest, metaPromptResult);

      console.log(`SERP execution completed: ${serpResults.executionSummary.totalResults} results from ${serpResults.executionSummary.enginesUsed.length} engines`);

      // Stage 3: Integrate results and generate OSINT analysis
      console.log('Stage 3: Integrating results and generating analysis...');
      const finalResult = await this.resultIntegrationService.integrateAndAnalyze(
        searchRequest,
        metaPromptResult,
        serpResults
      );

      const totalTime = Date.now() - startTime;

      // Enhanced response with workflow metadata
      const enhancedResponse = {
        ...finalResult,
        workflow_metadata: {
          execution_time_ms: totalTime,
          relationship_likelihood: metaPromptResult.search_strategy.relationship_likelihood,
          serp_execution_summary: serpResults.executionSummary,
          search_strategy: {
            keywords_generated: metaPromptResult.search_strategy.search_keywords.length,
            engines_used: metaPromptResult.search_strategy.source_engine,
            search_keywords: metaPromptResult.search_strategy.search_keywords,
            languages: metaPromptResult.search_strategy.languages
          },
          entity_info: {
            target: metaPromptResult.entity_a,
            risk: metaPromptResult.entity_b
          }
        }
      };

      console.log(`Enhanced search completed in ${(totalTime / 1000).toFixed(2)}s`);

      res.status(200).json(enhancedResponse);

    } catch (error) {
      console.error('Enhanced search failed:', error);

      res.status(500).json({
        success: false,
        error: 'Enhanced search process failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getSearchStrategy(req: Request, res: Response): Promise<void> {
    try {
      const searchRequest = this.validateSearchRequest(req.body);

      console.log('Generating search strategy only...');
      const metaPromptResult = await this.metaPromptService.generateSearchStrategy(searchRequest);

      res.status(200).json({
        success: true,
        strategy: metaPromptResult,
        message: 'Search strategy generated successfully'
      });

    } catch (error) {
      console.error('Strategy generation failed:', error);

      res.status(500).json({
        success: false,
        error: 'Strategy generation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async testWorkflow(req: Request, res: Response): Promise<void> {
    try {
      // Test with sample data
      const testRequest: SearchRequest = {
        Target_institution: "Shanghai HongZhiWei Technology",
        Risk_Entity: "NanoAcademic Technologies",
        Location: "China",
        Start_Date: "2020-01",
        End_Date: "2024-12"
      };

      console.log('Testing enhanced workflow with sample data...');

      const startTime = Date.now();

      // Quick strategy generation test
      const metaPromptResult = await this.metaPromptService.generateSearchStrategy(testRequest);

      const executionTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        test_result: {
          meta_prompt_working: true,
          keywords_generated: metaPromptResult.search_strategy.search_keywords.length,
          engines_selected: metaPromptResult.search_strategy.source_engine,
          relationship_likelihood: metaPromptResult.search_strategy.relationship_likelihood,
          execution_time_ms: executionTime
        },
        sample_strategy: metaPromptResult,
        message: 'Enhanced workflow test completed successfully'
      });

    } catch (error) {
      console.error('Workflow test failed:', error);

      res.status(500).json({
        success: false,
        error: 'Workflow test failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private validateSearchRequest(body: any): SearchRequest {
    const required = ['Target_institution', 'Risk_Entity', 'Location'];

    for (const field of required) {
      if (!body[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return {
      Target_institution: body.Target_institution,
      Risk_Entity: body.Risk_Entity,
      Location: body.Location,
      Start_Date: body.Start_Date,
      End_Date: body.End_Date
    };
  }

  async testStage2Only(req: Request, res: Response): Promise<void> {
    try {
      // Expect the request body to contain a Stage 1 result
      if (!req.body.entity_a || !req.body.entity_b || !req.body.search_strategy) {
        res.status(400).json({
          success: false,
          error: 'Invalid Stage 1 result format. Expected entity_a, entity_b, and search_strategy'
        });
        return;
      }

      const metaPromptResult = req.body;

      // Create a minimal search request for Stage 2 execution
      const searchRequest: SearchRequest = {
        Target_institution: metaPromptResult.entity_a.original_name,
        Risk_Entity: metaPromptResult.entity_b.original_name,
        Location: "China", // Default for test
      };

      console.log('Testing Stage 2 execution with stored Stage 1 result...');
      console.log(`Entity A: ${metaPromptResult.entity_a.original_name}`);
      console.log(`Entity B: ${metaPromptResult.entity_b.original_name}`);
      console.log(`Keywords: ${metaPromptResult.search_strategy.search_keywords.length}`);
      console.log(`Engines: ${metaPromptResult.search_strategy.source_engine.join(', ')}`);

      const startTime = Date.now();

      // Execute Stage 2 only
      const serpResults = await this.serpExecutorService.executeSearchStrategy(searchRequest, metaPromptResult);

      const executionTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        stage: 2,
        test_result: {
          stage2_execution_time_ms: executionTime,
          total_queries: serpResults.executionSummary.totalQueries,
          successful_queries: serpResults.executionSummary.successfulQueries,
          total_results: serpResults.executionSummary.totalResults,
          engines_used: serpResults.executionSummary.enginesUsed,
          engine_success_rates: serpResults.executionSummary.performanceMetrics?.engineSuccessRates
        },
        serp_results: serpResults,
        message: 'Stage 2 test completed successfully'
      });

    } catch (error) {
      console.error('Stage 2 test failed:', error);

      res.status(500).json({
        success: false,
        error: 'Stage 2 test failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Force test DuckDuckGo engine specifically
  async testDuckDuckGo(req: Request, res: Response): Promise<void> {
    try {
      console.log('🦆 Testing DuckDuckGo engine forcefully...');

      // Create a mock meta prompt result that forces DuckDuckGo usage
      const mockMetaPromptResult = {
        entity_a: {
          original_name: "Test Company",
          description: "Test company for DuckDuckGo verification",
          sectors: ["Technology"]
        },
        entity_b: {
          original_name: "Technology Partner",
          description: "Test technology partner",
          sectors: ["Technology"]
        },
        search_strategy: {
          search_keywords: [
            "\"Test Company\" \"Technology Partner\" partnership",
            "\"Test Company\" collaboration technology",
            "\"Test Company\" technology agreement"
          ],
          languages: ["en"],
          country_code: "us",
          source_engine: ["duckduckgo"], // Force DuckDuckGo only
          search_operators: [], // Required field
          relationship_likelihood: "medium"
        }
      };

      const searchRequest: SearchRequest = {
        Target_institution: "Test Company",
        Risk_Entity: "Technology Partner",
        Location: "United States"
      };

      console.log('🔍 Forcing DuckDuckGo engine selection...');
      console.log(`📝 Testing with ${mockMetaPromptResult.search_strategy.search_keywords.length} keywords`);
      console.log(`🎯 Engine: ${mockMetaPromptResult.search_strategy.source_engine.join(', ')}`);

      const startTime = Date.now();

      // Execute Stage 2 with forced DuckDuckGo
      const serpResults = await this.serpExecutorService.executeSearchStrategy(searchRequest, mockMetaPromptResult);

      const executionTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        test_type: "forced_duckduckgo",
        test_result: {
          execution_time_ms: executionTime,
          total_queries: serpResults.executionSummary.totalQueries,
          successful_queries: serpResults.executionSummary.successfulQueries,
          failed_queries: serpResults.executionSummary.failedQueries,
          total_results: serpResults.executionSummary.totalResults,
          engines_used: serpResults.executionSummary.enginesUsed,
          engine_success_rates: serpResults.executionSummary.performanceMetrics?.engineSuccessRates,
          duckduckgo_working: serpResults.executionSummary.enginesUsed.includes('duckduckgo'),
          sample_results: serpResults.consolidatedResults.slice(0, 3).map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet?.substring(0, 100) + '...'
          }))
        },
        mock_strategy: mockMetaPromptResult.search_strategy,
        message: 'DuckDuckGo force test completed'
      });

    } catch (error) {
      console.error('❌ DuckDuckGo test failed:', error);

      res.status(500).json({
        success: false,
        test_type: "forced_duckduckgo",
        error: 'DuckDuckGo test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : 'No stack trace available'
      });
    }
  }

  // Helper endpoint to get workflow status and capabilities
  async getWorkflowInfo(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        workflow_name: "Enhanced OSINT Search with WebSearch Meta-Prompting",
        version: "1.0.0",
        stages: [
          {
            stage: 1,
            name: "WebSearch Meta-Prompting",
            description: "Generate search strategy using WebSearch intelligence"
          },
          {
            stage: 2,
            name: "Multi-Engine SERP Execution",
            description: "Execute searches across multiple engines via Bright Data"
          },
          {
            stage: 3,
            name: "AI Result Integration",
            description: "Analyze and integrate results into standard OSINT format"
          }
        ],
        supported_engines: ["google", "baidu", "yandex", "duckduckgo"],
        endpoints: {
          enhanced_search: "/api/enhanced/search",
          strategy_only: "/api/enhanced/strategy",
          test_workflow: "/api/enhanced/test",
          workflow_info: "/api/enhanced/info"
        },
        advantages: [
          "WebSearch-informed keyword generation",
          "Multi-engine result aggregation",
          "Consistent result deduplication",
          "Geographic engine optimization",
          "Source credibility assessment"
        ]
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get workflow info'
      });
    }
  }
}