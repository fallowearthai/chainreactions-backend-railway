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

  async enhancedSearchStream(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Helper function to send SSE events
      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Validate request from query parameters
      const searchRequest = this.validateSearchRequest(req.query);

      console.log(`🚀 Starting ENHANCED SSE search for: ${searchRequest.Target_institution} vs ${searchRequest.Risk_Entity}`);

      // Send initial connection event
      sendEvent({
        stage: 'connection',
        status: 'connected',
        message: 'SSE connection established'
      });

      // Stage 1: Generate search strategy using WebSearch meta-prompting
      sendEvent({
        stage: 1,
        status: 'running',
        message: 'Generating search strategy with WebSearch...'
      });

      const metaPromptResult = await this.metaPromptService.generateSearchStrategy(searchRequest);

      // Send Stage 1 completion
      sendEvent({
        stage: 1,
        status: 'completed',
        result: {
          entity_a: {
            name: metaPromptResult.entity_a.original_name,
            description: metaPromptResult.entity_a.description,
            sectors: metaPromptResult.entity_a.sectors
          },
          entity_b: {
            name: metaPromptResult.entity_b.original_name,
            description: metaPromptResult.entity_b.description,
            sectors: metaPromptResult.entity_b.sectors
          },
          search_strategy: {
            keywords_count: metaPromptResult.search_strategy.search_keywords.length,
            engines: metaPromptResult.search_strategy.source_engine,
            relationship_likelihood: metaPromptResult.search_strategy.relationship_likelihood,
            keywords: metaPromptResult.search_strategy.search_keywords
          }
        }
      });

      console.log(`Generated ${metaPromptResult.search_strategy.search_keywords.length} keywords for ${metaPromptResult.search_strategy.source_engine.length} engines`);

      // Stage 2: Execute OPTIMIZED SERP searches with progress updates
      sendEvent({
        stage: 2,
        status: 'running',
        message: 'Starting multi-engine SERP searches...'
      });

      // Create progress callback for Stage 2
      const stage2ProgressCallback = (progress: string, current?: number, total?: number) => {
        sendEvent({
          stage: 2,
          status: 'progress',
          message: progress,
          progress: current && total ? { current, total } : undefined
        });
      };

      const optimizedResults = await this.serpExecutorService.executeSearchStrategyOptimizedWithProgress(
        searchRequest,
        metaPromptResult,
        stage2ProgressCallback
      );

      // Send Stage 2 completion
      sendEvent({
        stage: 2,
        status: 'completed',
        result: {
          total_results: optimizedResults.consolidatedResults.length,
          compression_ratio: (optimizedResults.optimizationMetadata.compressionRatio * 100).toFixed(1),
          engines_used: metaPromptResult.search_strategy.source_engine,
          execution_summary: {
            successful_queries: optimizedResults.optimizationMetadata.originalResults > 0 ? 'Success' : 'Failed',
            optimization_applied: true
          },
          sample_results: optimizedResults.consolidatedResults.map(result => ({
            title: result.title,
            url: result.url,
            snippet: result.snippet,
            relevance_score: result.relevanceScore || 0,
            engine: result.engine
          })),
          top_sources: [...new Set(optimizedResults.consolidatedResults.map(r => {
            try {
              return new URL(r.url).hostname;
            } catch {
              return r.url;
            }
          }))]
        }
      });

      console.log(`SERP optimization completed: ${optimizedResults.consolidatedResults.length} optimized results`);

      // Stage 3: Integrate optimized results and generate OSINT analysis
      sendEvent({
        stage: 3,
        status: 'running',
        message: 'AI analyzing search results for relationship evidence...'
      });

      // Create progress callback for Stage 3
      const stage3ProgressCallback = (progress: string) => {
        sendEvent({
          stage: 3,
          status: 'progress',
          message: progress
        });
      };

      // Use stable non-SSE method with manual progress updates
      stage3ProgressCallback('Starting AI analysis...');

      // 添加调试信息
      console.log('🎯 About to call integrateAndAnalyzeOptimized');
      console.log('📋 Request:', {
        Target_institution: searchRequest.Target_institution,
        Risk_Entity: searchRequest.Risk_Entity,
        resultsCount: optimizedResults.consolidatedResults.length
      });

      let finalResult;
      try {
        finalResult = await this.resultIntegrationService.integrateAndAnalyzeOptimized(
          searchRequest,
          metaPromptResult,
          optimizedResults
        );
        stage3ProgressCallback('Analysis completed');
      } catch (stage3Error) {
        console.error('❌ Stage 3 analysis failed:', stage3Error);

        // 发送具体的Stage3错误信息
        sendEvent({
          stage: 'error',
          status: 'failed',
          error: 'Stage 3 AI analysis failed',
          message: `AI analysis error: ${stage3Error instanceof Error ? stage3Error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString()
        });

        // 延迟关闭连接
        setTimeout(() => {
          res.end();
        }, 100);

        return; // 不继续到final completion
      }

      const totalTime = Date.now() - startTime;

      // Send final completion
      sendEvent({
        stage: 'final',
        status: 'completed',
        result: {
          analysis_results: finalResult.data,
          metadata: {
            overall_confidence: finalResult.metadata?.overall_confidence,
            total_sources: finalResult.sources?.length,
            methodology: finalResult.metadata?.methodology,
            execution_time_ms: totalTime
          },
          sources: finalResult.sources
        }
      });

      console.log(`✅ Enhanced SSE search completed in ${(totalTime / 1000).toFixed(2)}s`);

      // Close the connection
      res.end();

    } catch (error) {
      console.error('❌ Enhanced SSE search failed:', error);

      // Send error event
      res.write(`data: ${JSON.stringify({
        stage: 'error',
        status: 'failed',
        error: 'Enhanced search process failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })}\n\n`);

      // 添加延迟以确保错误事件被完全接收
      setTimeout(() => {
        res.end();
      }, 100); // 100ms延迟
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
    const required = ['Target_institution', 'Risk_Entity'];

    for (const field of required) {
      if (!body[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate custom keyword if provided
    let customKeyword: string | undefined;
    if (body.Custom_Keyword) {
      customKeyword = this.validateCustomKeyword(body.Custom_Keyword);
    }

    return {
      Target_institution: body.Target_institution,
      Risk_Entity: body.Risk_Entity,
      Location: body.Location || '',  // Make Location optional with empty string default
      Start_Date: body.Start_Date || '',
      End_Date: body.End_Date || '',
      Custom_Keyword: customKeyword
    };
  }

  /**
   * Validate custom keyword format and content
   */
  private validateCustomKeyword(keyword: any): string {
    if (typeof keyword !== 'string') {
      throw new Error('Custom_Keyword must be a string');
    }

    const trimmed = keyword.trim();

    // Length validation
    if (trimmed.length === 0) {
      throw new Error('Custom_Keyword cannot be empty');
    }

    if (trimmed.length > 50) {
      throw new Error('Custom_Keyword must be 50 characters or less');
    }

    // Word count validation (1-3 words)
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount > 3) {
      throw new Error('Custom_Keyword must be 1-3 words only');
    }

    // Content validation - allow letters, numbers, spaces, and basic symbols
    const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validPattern.test(trimmed)) {
      throw new Error('Custom_Keyword can only contain letters, numbers, spaces, hyphens, and underscores');
    }

    console.log(`✅ Custom keyword validated: "${trimmed}"`);
    return trimmed;
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



}