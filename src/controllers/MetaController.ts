import { Request, Response } from 'express';
import { MetaPromptService } from '../services/MetaPromptService';
import { SearchRequest } from '../types/gemini';

export class MetaController {
  private metaPromptService: MetaPromptService;

  constructor() {
    this.metaPromptService = new MetaPromptService();
  }

  async generateStrategy(req: Request, res: Response): Promise<void> {
    try {
      console.log('\ud83e\uddd1\u200d\ud83d\uddfa Meta strategy request:', {
        body: req.body,
        timestamp: new Date().toISOString()
      });

      const request: SearchRequest = {
        Target_institution: req.body.Target_institution || '',
        Risk_Entity: req.body.Risk_Entity || '',
        Location: req.body.Location || '',
        Start_Date: req.body.Start_Date,
        End_Date: req.body.End_Date
      };

      // Generate meta strategy
      const strategy = await this.metaPromptService.generateSearchStrategy(request);

      console.log('✅ Meta strategy generated:', {
        strategy: strategy.entity_analysis,
        tools: strategy.tool_selection?.selected_tools,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        data: strategy,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('Meta controller error:', error);
      res.status(500).json({
        success: false,
        error: `Meta strategy generation failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  async testMetaPrompt(req: Request, res: Response): Promise<void> {
    try {
      console.log('\ud83e\uddea Testing meta prompt service...');

      // Test with HongZhiWei case
      const testRequest: SearchRequest = {
        Target_institution: 'HongZhiWei Technologies',
        Risk_Entity: 'NanoAcademic Technologies',
        Location: 'China'
      };

      const strategy = await this.metaPromptService.generateSearchStrategy(testRequest);

      console.log('🔬 Test results:', {
        entityAnalysis: strategy.entity_analysis,
        searchStrategy: strategy.search_strategy,
        toolSelection: strategy.tool_selection,
        fallbackUsed: strategy.fallback_used
      });

      res.status(200).json({
        success: true,
        test: 'HongZhiWei vs NanoAcademic case',
        strategy: strategy,
        availableTools: this.metaPromptService.getAvailableToolNames(),
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Meta test error:', error);
      res.status(500).json({
        success: false,
        error: `Meta test failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }
}