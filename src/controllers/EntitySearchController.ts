import { Request, Response, NextFunction } from 'express';
import { LinkupService } from '../services/entity-search/LinkupService';
import { ResponseParser } from '../services/entity-search/responseParser';
import { EntitySearchRequest, EntitySearchResponse } from '../types/entity-search/types';

export class EntitySearchController {
  private linkupService: LinkupService;

  constructor() {
    this.linkupService = new LinkupService();
  }

  async handleEntitySearch(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const { company_name, location, exclude_domains }: EntitySearchRequest = req.body;

      // Validate required fields
      if (!company_name || !company_name.trim()) {
        res.status(400).json({
          success: false,
          error: 'company_name is required and cannot be empty'
        });
        return;
      }

      // Validate exclude_domains if provided
      if (exclude_domains && !Array.isArray(exclude_domains)) {
        res.status(400).json({
          success: false,
          error: 'exclude_domains must be an array of strings'
        });
        return;
      }

      console.log('📥 Entity search request:', {
        company_name,
        location: location || 'not specified',
        custom_exclude_domains: exclude_domains?.length || 0,
        timestamp: new Date().toISOString()
      });

      // Check if Linkup service is configured
      if (!this.linkupService.isConfigured()) {
        console.error('❌ Linkup API not configured');
        res.status(500).json({
          success: false,
          error: 'Linkup API service not properly configured'
        });
        return;
      }

      // Perform the search with exclude_domains
      const searchResult = await this.linkupService.searchEntity(company_name, location, exclude_domains);

      if (searchResult.success) {
        console.log('🔄 Processing Linkup API response...');

        // Process response using N8N-based parser
        const parsedResponse = ResponseParser.processLinkupResponse(searchResult.data);

        // Extract clean data for frontend (matches N8N output format)
        const responseData = ResponseParser.extractCleanData(parsedResponse);

        console.log('✅ Entity search completed successfully:', {
          company_name,
          parsing_success: parsedResponse.success,
          has_company_info: !!parsedResponse.data.company_info,
          results_count: responseData.length,
          sources_count: parsedResponse.data.sources.length,
          timestamp: new Date().toISOString()
        });

        // Return array directly to match frontend expectations (useCompanySearch.ts line 55)
        // Frontend expects: Array.isArray(result) ? result : [result]
        res.json(responseData);

      } else {
        console.error('❌ Entity search failed:', {
          company_name,
          error: searchResult.error,
          timestamp: new Date().toISOString()
        });

        // Return empty array for consistency with frontend error handling
        res.json([]);
      }

    } catch (error: any) {
      console.error('❌ Error in handleEntitySearch:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      // Return empty array for consistency with frontend error handling
      res.json([]);
    }
  }

  async testLinkupConnection(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      console.log('🧪 Testing Linkup API connection...');
      console.warn('⚠️ WARNING: This endpoint will consume Linkup API credits!');

      if (!this.linkupService.isConfigured()) {
        res.status(500).json({
          success: false,
          message: 'Linkup API not configured',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // IMPORTANT: This will consume credits! Only call when explicitly requested by user
      const testResult = await this.linkupService.testConnection();

      if (testResult.success) {
        res.json({
          success: true,
          message: 'Linkup API connection test successful (1 credit consumed)',
          data: testResult.data,
          timestamp: new Date().toISOString(),
          warning: 'This test consumed Linkup API credits'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Linkup API connection test failed',
          error: testResult.error,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error: any) {
      console.error('❌ Error in testLinkupConnection:', error);

      res.status(500).json({
        success: false,
        message: 'Error testing Linkup API connection',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Health check method for Entity Search service
  // IMPORTANT: Does NOT call real Linkup API to prevent credit consumption
  async healthCheck(): Promise<{ status: string; configured: boolean; details: any }> {
    const configured = this.linkupService.isConfigured();
    let details: any = {
      configured,
      note: 'Health check does not call real API to prevent credit consumption'
    };

    // Only check configuration, DO NOT call real API
    if (configured) {
      details.api_key_status = 'configured';
      details.api_connection = 'not_tested'; // Changed from 'operational' to 'not_tested'
    } else {
      details.api_key_status = 'missing';
      details.api_connection = 'unavailable';
    }

    return {
      status: configured ? 'operational' : 'misconfigured',
      configured,
      details
    };
  }
}