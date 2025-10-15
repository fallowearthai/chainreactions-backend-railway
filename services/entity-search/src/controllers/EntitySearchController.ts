import { Request, Response, NextFunction } from 'express';
import { LinkupService } from '../services/LinkupService';
import { ResponseParser } from '../services/responseParser';
import { EntitySearchRequest, EntitySearchResponse } from '../types/types';

export class EntitySearchController {
  private linkupService: LinkupService;

  constructor() {
    this.linkupService = new LinkupService();
  }

  /**
   * POST /api/entity-search
   * Search for entity using Linkup API
   */
  async handleEntitySearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { company_name, location, exclude_domains }: EntitySearchRequest = req.body;

      // Validate required fields
      if (!company_name) {
        res.status(400).json({
          success: false,
          error: 'company_name is required',
          message: 'Please provide a company_name in the request body'
        } as EntitySearchResponse);
        return;
      }

      console.log('📥 Entity search request:', {
        company: company_name,
        location: location || 'not specified',
        excludeDomains: exclude_domains?.length || 0
      });

      // Check if Linkup service is configured
      if (!this.linkupService.isConfigured()) {
        res.status(503).json({
          success: false,
          error: 'Service not configured',
          message: 'LINKUP_API_KEY is not configured'
        } as EntitySearchResponse);
        return;
      }

      // Call Linkup API
      const linkupResponse = await this.linkupService.searchEntity(
        company_name,
        location,
        exclude_domains
      );

      if (!linkupResponse.success) {
        res.status(500).json({
          success: false,
          error: linkupResponse.error,
          message: 'Failed to search entity'
        } as EntitySearchResponse);
        return;
      }

      // Parse and format response
      const parsedResponse = ResponseParser.processLinkupResponse(linkupResponse.data);
      const cleanData = ResponseParser.extractCleanData(parsedResponse);

      res.json({
        success: true,
        data: cleanData,
        message: parsedResponse.success
          ? 'Entity search completed successfully'
          : 'Entity search completed but parsing failed'
      } as EntitySearchResponse);

    } catch (error: any) {
      console.error('❌ Error in entity search controller:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Internal server error'
      } as EntitySearchResponse);
    }
  }

  /**
   * GET /api/health
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    const config = this.linkupService.checkConfiguration();

    res.json({
      status: config.configured ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'Entity Search Service',
      version: '1.0.0',
      configuration: {
        linkup_api_configured: config.hasApiKey,
        base_url: config.baseURL
      },
      note: 'Configuration check only - no API calls made'
    });
  }

  /**
   * GET /api/info
   * Service information endpoint
   */
  async getInfo(req: Request, res: Response): Promise<void> {
    res.json({
      service: 'Entity Search Service',
      version: '1.0.0',
      description: 'Linkup API integration for professional business intelligence',
      port: process.env.PORT || 3003,
      endpoints: [
        'POST /api/entity-search - Search for entity information',
        'GET /api/health - Health check',
        'GET /api/info - Service information'
      ],
      status: 'operational'
    });
  }
}
