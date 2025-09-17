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

      console.log(`Generated ${metaPromptResult.searchKeywords.length} keywords for ${metaPromptResult.searchEngines.length} engines`);
      console.log(`Meta-prompt confidence: ${metaPromptResult.confidence}`);

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
          meta_prompt_confidence: metaPromptResult.confidence,
          serp_execution_summary: serpResults.executionSummary,
          search_strategy: {
            keywords_generated: metaPromptResult.searchKeywords.length,
            engines_used: metaPromptResult.searchEngines,
            primary_terms: metaPromptResult.searchStrategy.primaryTerms,
            languages: metaPromptResult.searchStrategy.languages
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
          keywords_generated: metaPromptResult.searchKeywords.length,
          engines_selected: metaPromptResult.searchEngines,
          confidence: metaPromptResult.confidence,
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
        supported_engines: ["google", "bing", "baidu", "yandex", "duckduckgo"],
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