// Backup of original SearchService before meta prompting integration
import { GeminiService } from './GeminiService';
import { PromptBuilder } from '../utils/promptBuilder';
import { ResponseParser } from '../utils/responseParser';
import { SearchRequest, SearchResult, FormattedSearchResult, GeminiResponse } from '../types/gemini';

export class SearchService {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  async performSearch(request: SearchRequest): Promise<FormattedSearchResult[]> {
    try {
      // Build the search prompt
      const prompt = PromptBuilder.buildSearchPrompt(request);
      const systemInstruction = PromptBuilder.getSystemInstruction();

      // Call Gemini API
      const response = await this.geminiService.generateSearchContent(prompt, systemInstruction);

      // Extract grounding metadata
      const groundingData = ResponseParser.extractGroundingMetadata(response);

      // Parse the response
      const searchResults = ResponseParser.parseGeminiResponse(response);

      // Format the results
      const formattedResults = ResponseParser.formatSearchResults(
        searchResults,
        groundingData.renderedContent,
        groundingData.webSearchQueries
      );

      return formattedResults;
    } catch (error: any) {
      console.error('Search service error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async validateRequest(request: SearchRequest): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate required fields
    if (!request.Target_institution || request.Target_institution.trim() === '') {
      errors.push('Target_institution is required');
    }

    if (!request.Risk_Entity || request.Risk_Entity.trim() === '') {
      errors.push('Risk_Entity is required');
    }

    if (!request.Location || request.Location.trim() === '') {
      errors.push('Location is required');
    }

    // Validate date format if provided
    if (request.Start_Date) {
      if (!this.isValidDateFormat(request.Start_Date)) {
        errors.push('Start_Date must be in YYYY-MM format');
      }
    }

    if (request.End_Date) {
      if (!this.isValidDateFormat(request.End_Date)) {
        errors.push('End_Date must be in YYYY-MM format');
      }
    }

    // Validate date range
    if (request.Start_Date && request.End_Date) {
      if (request.Start_Date > request.End_Date) {
        errors.push('Start_Date must be before End_Date');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private isValidDateFormat(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }

    const [year, month] = dateString.split('-').map(Number);
    if (year < 1900 || year > new Date().getFullYear() + 1) {
      return false;
    }

    if (month < 1 || month > 12) {
      return false;
    }

    return true;
  }

  async getHealthStatus(): Promise<{ status: string; gemini_api: boolean; timestamp: string }> {
    try {
      // Test Gemini API with a simple request
      await this.geminiService.generateSearchContent(
        'Hello, this is a health check.',
        'Please respond with "OK" only.'
      );

      return {
        status: 'healthy',
        gemini_api: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        gemini_api: false,
        timestamp: new Date().toISOString()
      };
    }
  }
}