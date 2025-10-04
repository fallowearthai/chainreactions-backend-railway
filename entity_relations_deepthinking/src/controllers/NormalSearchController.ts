import { Request, Response } from 'express';
import { GeminiNormalSearchService } from '../services/GeminiNormalSearchService';
import { NormalSearchRequest, NormalSearchResult, FormattedSearchOutput } from '../types/gemini';

export class NormalSearchController {
  private geminiService: GeminiNormalSearchService;

  constructor() {
    this.geminiService = new GeminiNormalSearchService();
  }

  /**
   * Format search results to match N8N output format
   */
  private formatSearchResults(
    result: NormalSearchResult,
    metadata: {
      renderedContent?: string;
      webSearchQueries: string[];
    }
  ): FormattedSearchOutput {
    // Handle intermediary_B array conversion to string
    let intermediaryString = 'None';
    if (Array.isArray(result.potential_intermediary_B) && result.potential_intermediary_B.length > 0) {
      intermediaryString = result.potential_intermediary_B.join(', ');
    }

    // Create formatted output string with \\n as line breaks (matching N8N format)
    const formattedOutput = `Risk Item: ${result.risk_item}\\nInstitution A: ${result.institution_A}\\nRelationship Type: ${result.relationship_type}\\nFinding Summary: ${result.finding_summary}\\nIntermediary B: ${intermediaryString}`;

    // Create separate URLs string
    let urlsString = '';
    if (result.sources && result.sources.length > 0) {
      result.sources.forEach((url, index) => {
        urlsString += `${index + 1}. ${url}\\n`;
      });
      // Remove last line break
      if (urlsString.endsWith('\\n')) {
        urlsString = urlsString.slice(0, -2);
      }
    }

    return {
      result: formattedOutput,
      urls: urlsString,
      raw_data: {
        risk_item: result.risk_item,
        institution_A: result.institution_A,
        relationship_type: result.relationship_type,
        finding_summary: result.finding_summary,
        potential_intermediary_B: intermediaryString, // Convert array to string for frontend compatibility
        urls: urlsString,
        sources_count: result.sources?.length || 0,
        renderedContent: metadata.renderedContent,
        webSearchQueries: metadata.webSearchQueries
      }
    };
  }

  /**
   * Handle normal search request
   * POST /api/normal-search
   */
  async handleNormalSearch(req: Request, res: Response): Promise<void> {
    try {
      const searchRequest: NormalSearchRequest = {
        Target_institution: req.body.Target_institution,
        Risk_Entity: req.body.Risk_Entity,
        Location: req.body.Location,
        Start_Date: req.body.Start_Date,
        End_Date: req.body.End_Date
      };

      // Validate required fields
      if (!searchRequest.Target_institution || !searchRequest.Risk_Entity) {
        res.status(400).json({
          error: 'Missing required fields: Target_institution, Risk_Entity'
        });
        return;
      }

      console.log('📨 Normal Search Request:', searchRequest);

      // Execute search
      const { results, metadata } = await this.geminiService.executeNormalSearch(searchRequest);

      // Handle no results case
      if (!results || results.length === 0) {
        res.status(200).json({
          result: 'No relationships found',
          urls: '',
          raw_data: {
            risk_item: searchRequest.Risk_Entity,
            institution_A: searchRequest.Target_institution,
            relationship_type: 'No Evidence Found',
            finding_summary: 'After thorough search, no evidence of connection was found.',
            potential_intermediary_B: [],
            urls: '',
            sources_count: 0,
            renderedContent: metadata.renderedContent,
            webSearchQueries: metadata.webSearchQueries
          }
        });
        return;
      }

      // Format first result (matching N8N behavior which returns single result)
      const formattedResult = this.formatSearchResults(results[0], metadata);

      console.log('✅ Normal Search completed successfully');
      res.status(200).json(formattedResult);

    } catch (error) {
      console.error('❌ Normal Search Error:', error);
      res.status(500).json({
        error: 'Internal server error during normal search',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Health check endpoint
   * GET /api/health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'healthy',
      service: 'entity_relations_normal',
      version: '1.0.0',
      port: process.env.PORT || 3005,
      features: [
        'Google Web Search via Gemini API',
        'Multi-language OSINT analysis',
        'Time-range filtering',
        'Relationship type classification'
      ]
    });
  }

  /**
   * Get service information
   * GET /api/info
   */
  async getInfo(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      service: 'Entity Relations Normal Search',
      description: 'Google Web Search based OSINT analysis using Gemini AI',
      search_method: 'Google Web Search (via Gemini googleSearch tool)',
      capabilities: {
        multi_language: true,
        time_range_filtering: true,
        relationship_types: [
          'Direct',
          'Indirect',
          'Significant Mention',
          'Unknown',
          'No Evidence Found'
        ],
        intermediary_detection: true
      },
      api_endpoints: {
        search: 'POST /api/normal-search',
        health: 'GET /api/health',
        info: 'GET /api/info'
      },
      request_format: {
        Target_institution: 'string (required)',
        Risk_Entity: 'string (required)',
        Location: 'string (required)',
        Start_Date: 'string (optional, YYYY-MM-DD)',
        End_Date: 'string (optional, YYYY-MM-DD)'
      },
      response_format: {
        result: 'Formatted text output',
        urls: 'Numbered source URLs',
        raw_data: {
          risk_item: 'string',
          institution_A: 'string',
          relationship_type: 'string',
          finding_summary: 'string',
          potential_intermediary_B: 'array',
          urls: 'string',
          sources_count: 'number',
          renderedContent: 'string (optional)',
          webSearchQueries: 'array'
        }
      }
    });
  }
}
