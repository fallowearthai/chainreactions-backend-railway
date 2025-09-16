import { Request, Response, NextFunction } from 'express';
import { SearchService } from '../services/SearchService';
import { SearchRequest, FormattedSearchResult } from '../types/gemini';

export class SearchController {
  private searchService: SearchService;

  constructor() {
    this.searchService = new SearchService();
  }

  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();

      // Log the incoming request
      console.log('Incoming search request:', {
        body: req.body,
        timestamp: new Date().toISOString()
      });

      // Validate request body
      if (!req.body) {
        res.status(400).json({
          error: 'Request body is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const searchRequest: SearchRequest = {
        Target_institution: req.body.Target_institution,
        Risk_Entity: req.body.Risk_Entity,
        Location: req.body.Location,
        Start_Date: req.body.Start_Date,
        End_Date: req.body.End_Date
      };

      // Validate the request
      const validation = await this.searchService.validateRequest(searchRequest);
      if (!validation.valid) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Perform the search
      const results: FormattedSearchResult[] = await this.searchService.performSearch(searchRequest);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Log the successful response
      console.log('Search completed successfully:', {
        resultsCount: results.length,
        processingTime,
        timestamp: new Date().toISOString()
      });

      // Send the response
      res.json({
        success: true,
        data: results,
        metadata: {
          processingTime,
          resultsCount: results.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      console.error('Search controller error:', error);

      // Send error response
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  };

  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const healthStatus = await this.searchService.getHealthStatus();

      res.json({
        status: healthStatus.status,
        services: {
          gemini_api: healthStatus.gemini_api
        },
        timestamp: healthStatus.timestamp
      });
    } catch (error: any) {
      console.error('Health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Legacy endpoint to maintain compatibility with n8n webhook
  webhook = async (req: Request, res: Response): Promise<void> => {
    try {
      // Map the n8n webhook format to our internal format
      const searchRequest: SearchRequest = {
        Target_institution: req.body.Target_institution,
        Risk_Entity: req.body.Risk_Entity,
        Location: req.body.Location,
        Start_Date: req.body.Start_Date,
        End_Date: req.body.End_Date
      };

      const results: FormattedSearchResult[] = await this.searchService.performSearch(searchRequest);

      // Format response to match n8n expected format
      const formattedResponse = {
        data: results
      };

      res.json(formattedResponse);
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(500).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };
}