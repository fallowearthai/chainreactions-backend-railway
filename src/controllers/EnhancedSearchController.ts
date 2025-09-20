import { Request, Response } from 'express';
import { SearchRequest, SearchResult } from '../types/gemini';
import { WebSearchMetaPromptService } from '../services/WebSearchMetaPromptService';
import { SerpExecutorService } from '../services/SerpExecutorService';
import { ResultIntegrationService } from '../services/ResultIntegrationService';
import * as fs from 'fs';
import * as path from 'path';

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

      console.log(`🚀 Starting ENHANCED search for: ${searchRequest.Target_institution} vs ${searchRequest.Risk_Entity}`);

      // Stage 1: Generate search strategy using WebSearch meta-prompting
      console.log('📋 Stage 1: Generating search strategy with WebSearch...');
      const metaPromptResult = await this.metaPromptService.generateSearchStrategy(searchRequest);

      console.log(`Generated ${metaPromptResult.search_strategy.search_keywords.length} keywords for ${metaPromptResult.search_strategy.source_engine.length} engines`);
      console.log(`Relationship likelihood: ${metaPromptResult.search_strategy.relationship_likelihood}`);

      // Stage 2: Execute OPTIMIZED SERP searches with result optimization (NEW DEFAULT)
      console.log('🔍 Stage 2: Executing OPTIMIZED SERP searches...');
      const optimizedResults = await this.serpExecutorService.executeSearchStrategyOptimized(searchRequest, metaPromptResult);

      console.log(`SERP optimization completed: ${optimizedResults.consolidatedResults.length} optimized results (${(optimizedResults.optimizationMetadata.compressionRatio * 100).toFixed(1)}% compression)`);

      // Stage 3: Integrate optimized results and generate OSINT analysis (NEW DEFAULT)
      console.log('🧠 Stage 3: Integrating OPTIMIZED results and generating analysis...');
      const finalResult = await this.resultIntegrationService.integrateAndAnalyzeOptimized(
        searchRequest,
        metaPromptResult,
        optimizedResults
      );

      const totalTime = Date.now() - startTime;

      console.log(`✅ Enhanced search completed in ${(totalTime / 1000).toFixed(2)}s`);

      res.status(200).json(finalResult);

    } catch (error) {
      console.error('❌ Enhanced search failed:', error);

      res.status(500).json({
        success: false,
        error: 'Enhanced search process failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Legacy enhanced search without optimization (kept for backward compatibility)
   */
  async enhancedSearchLegacy(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate request
      const searchRequest = this.validateSearchRequest(req.body);

      console.log(`🔄 Starting LEGACY enhanced search for: ${searchRequest.Target_institution} vs ${searchRequest.Risk_Entity}`);

      // Stage 1: Generate search strategy using WebSearch meta-prompting
      console.log('📋 Stage 1: Generating search strategy with WebSearch...');
      const metaPromptResult = await this.metaPromptService.generateSearchStrategy(searchRequest);

      console.log(`Generated ${metaPromptResult.search_strategy.search_keywords.length} keywords for ${metaPromptResult.search_strategy.source_engine.length} engines`);
      console.log(`Relationship likelihood: ${metaPromptResult.search_strategy.relationship_likelihood}`);

      // Stage 2: Execute LEGACY SERP searches without optimization
      console.log('🔍 Stage 2: Executing LEGACY SERP searches...');
      const serpResults = await this.serpExecutorService.executeSearchStrategy(searchRequest, metaPromptResult);

      console.log(`SERP execution completed: ${serpResults.executionSummary.totalResults} results from ${serpResults.executionSummary.enginesUsed.length} engines`);

      // Stage 3: Integrate results using LEGACY analysis
      console.log('🧠 Stage 3: Integrating results with LEGACY analysis...');
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
          optimization_applied: false,
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

      console.log(`✅ LEGACY enhanced search completed in ${(totalTime / 1000).toFixed(2)}s`);

      res.status(200).json(enhancedResponse);

    } catch (error) {
      console.error('❌ Legacy enhanced search failed:', error);

      res.status(500).json({
        success: false,
        error: 'Legacy enhanced search process failed',
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
        supported_engines: ["google", "baidu", "yandex"],
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

  async testStage3FromSavedResults(req: Request, res: Response): Promise<void> {
    try {
      // Get stage2 result file path from query parameter
      const filePath = req.query.filePath as string;
      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'Missing filePath query parameter'
        });
        return;
      }

      console.log(`🧠 Loading Stage 2 results from: ${filePath}`);

      // Read the saved Stage 2 results
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const savedResults = JSON.parse(fileContent);

      console.log(`📋 Loaded saved results: ${savedResults.stage2_result.consolidatedResults.length} consolidated results`);

      // Extract the components needed for Stage 3
      const searchRequest: SearchRequest = {
        Target_institution: savedResults.test_info.target_institution,
        Risk_Entity: savedResults.test_info.risk_entity,
        Location: savedResults.test_info.location
      };

      const metaPromptResult = savedResults.stage1_result;
      const serpResults = savedResults.stage2_result;

      const startTime = Date.now();

      // Execute Stage 3 only
      console.log('🧠 Stage 3: Analyzing saved Stage 2 results...');
      console.log(`📊 Input: ${serpResults.consolidatedResults.length} consolidated results`);
      const finalResult = await this.resultIntegrationService.integrateAndAnalyze(
        searchRequest,
        metaPromptResult,
        serpResults
      );

      const executionTime = Date.now() - startTime;

      console.log(`✅ Stage 3 analysis completed in ${(executionTime / 1000).toFixed(2)}s`);

      res.status(200).json({
        success: true,
        message: 'Stage 3 analysis completed using saved Stage 2 results',
        execution_time_ms: executionTime,
        input_file: filePath,
        stage3_result: finalResult,
        input_summary: {
          stage2_results: serpResults.consolidatedResults.length,
          stage2_sources: serpResults.executionSummary.enginesUsed,
          stage1_keywords: metaPromptResult.search_strategy.search_keywords.length
        }
      });

    } catch (error) {
      console.error('❌ Stage 3 test from saved results failed:', error);

      res.status(500).json({
        success: false,
        error: 'Stage 3 test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async testStage2SaveResults(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Get test number from query parameter
      const testNumber = req.query.testNumber as string || '1';

      // Use standard test case
      const searchRequest: SearchRequest = {
        Target_institution: "NanoAcademic Technologies",
        Risk_Entity: "HongZhiWei",
        Location: "China"
      };

      console.log(`🚀 Starting Stage 1+2 test #${testNumber} for: ${searchRequest.Target_institution} vs ${searchRequest.Risk_Entity}`);

      // Stage 1: Generate search strategy
      console.log('📋 Stage 1: Generating search strategy with WebSearch...');
      const metaPromptResult = await this.metaPromptService.generateSearchStrategy(searchRequest);

      console.log(`Generated ${metaPromptResult.search_strategy.search_keywords.length} keywords for ${metaPromptResult.search_strategy.source_engine.length} engines`);

      // Stage 2: Execute SERP searches
      console.log('🔍 Stage 2: Executing SERP searches...');
      const serpResults = await this.serpExecutorService.executeSearchStrategy(searchRequest, metaPromptResult);

      console.log(`SERP execution completed: ${serpResults.executionSummary.totalResults} results from ${serpResults.executionSummary.enginesUsed.length} engines`);

      const totalTime = Date.now() - startTime;

      // Create comprehensive result object
      const testResult = {
        test_info: {
          test_number: testNumber,
          timestamp: new Date().toISOString(),
          execution_time_ms: totalTime,
          target_institution: searchRequest.Target_institution,
          risk_entity: searchRequest.Risk_Entity,
          location: searchRequest.Location
        },
        stage1_result: metaPromptResult,
        stage2_result: serpResults,
        summary: {
          stage1: {
            keywords_generated: metaPromptResult.search_strategy.search_keywords.length,
            engines_selected: metaPromptResult.search_strategy.source_engine,
            relationship_likelihood: metaPromptResult.search_strategy.relationship_likelihood
          },
          stage2: {
            total_queries: serpResults.executionSummary.totalQueries,
            successful_queries: serpResults.executionSummary.successfulQueries,
            total_results: serpResults.executionSummary.totalResults,
            engines_used: serpResults.executionSummary.enginesUsed,
            execution_time_ms: serpResults.executionSummary.executionTime
          }
        }
      };

      // Save to JSON file
      const outputDir = path.join(process.cwd(), 'test_results');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const filename = `stage2_test_${testNumber}_${Date.now()}.json`;
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(testResult, null, 2));

      console.log(`✅ Test #${testNumber} completed in ${(totalTime / 1000).toFixed(2)}s - Results saved to ${filename}`);

      res.status(200).json({
        success: true,
        message: `Stage 1+2 test #${testNumber} completed successfully`,
        execution_time_ms: totalTime,
        results_file: filename,
        results_path: filepath,
        summary: testResult.summary
      });

    } catch (error) {
      console.error(`❌ Test #${req.query.testNumber || '1'} failed:`, error);

      res.status(500).json({
        success: false,
        error: `Stage 1+2 test failed`,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  async getStage2Results(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔍 Frontend request for Stage 1+2 results...');

      const searchRequest: SearchRequest = {
        Target_institution: req.body.Target_institution,
        Risk_Entity: req.body.Risk_Entity,
        Location: req.body.Location,
        Start_Date: req.body.Start_Date,
        End_Date: req.body.End_Date
      };

      const startTime = Date.now();

      // Execute Stage 1
      console.log('🧠 Stage 1: Generating search strategy...');
      const metaPromptResult = await this.metaPromptService.generateSearchStrategy(searchRequest);

      // Execute Stage 2
      console.log('🚀 Stage 2: Executing optimized SERP searches...');
      const serpResults = await this.serpExecutorService.executeSearchStrategyOptimized(searchRequest, metaPromptResult);

      const totalTime = Date.now() - startTime;

      console.log(`✅ Stage 1+2 completed in ${(totalTime / 1000).toFixed(2)}s for frontend`);

      res.status(200).json({
        success: true,
        stage1_result: metaPromptResult,
        stage2_result: {
          execution_summary: serpResults.executionSummary,
          optimization_metadata: serpResults.optimizationMetadata,
          consolidated_results: serpResults.consolidatedResults.map((result, index) => ({
            id: index + 1,
            title: result.title,
            url: result.url,
            snippet: result.snippet.substring(0, 200) + (result.snippet.length > 200 ? '...' : ''),
            engine: result.engine,
            relevance_score: result.relevanceScore,
            search_keywords: result.searchKeywords
          }))
        },
        execution_time_ms: totalTime,
        execution_time: `${(totalTime / 1000).toFixed(2)}s`
      });

    } catch (error) {
      console.error('❌ Stage 1+2 frontend request failed:', error);

      res.status(500).json({
        success: false,
        error: 'Stage 1+2 execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }
}