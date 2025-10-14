import axios, { AxiosResponse } from 'axios';
import { LinkupAPIResponse } from '../../types/entity-search/types';

export class LinkupService {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    this.apiKey = process.env.LINKUP_API_KEY || '';
    this.baseURL = process.env.LINKUP_BASE_URL || 'https://api.linkup.so/v1';

    if (!this.apiKey) {
      console.warn('⚠️ LINKUP_API_KEY not configured. Service may not function properly.');
    }
  }

  private getDefaultExcludeDomains(): string[] {
    // Conservative list of low-quality domains to exclude
    // (Linkup API may have limits on number of excluded domains)
    return [
      'wikipedia.org',
      'reddit.com',
      'quora.com',
      'pinterest.com'
    ];
  }

  private buildSearchQuery(companyName: string, location?: string): string {
    // Professional business intelligence analyst prompt based on N8N workflow
    const basePrompt = `Act as a professional business intelligence analyst. Given a specific company name and address, your goal is to accurately identify the correct company entity. Search authoritative sources, including the official company website, government registries, reputable business directories, SEC filings, press releases, and partnership announcements. If multiple companies with similar or identical names are found, set 'similar_name_companies_exist' to true and provide a list of these entities with distinguishing details. For the identified company, return a JSON object with these fields: original_name (as registered), english_name, past_names (list of previous names), description (concise summary of main activities and industry in English), headquarters (full registered address), sectors (primary business sectors), similar_name_companies_exist (true/false), vendors (key suppliers or vendors with specific details and source URLs), partnerships (notable business partnerships, joint ventures, strategic alliances with specific details and source URLs), Research References (comprehensive list of all source URLs used for each field with titles and relevance). CRITICAL: For vendors and partnerships, always include the specific source URL where this information was found. Ensure all data is current, accurate, and cite the source URL for each field. Format your response as a single, well-structured JSON object.`;

    const companyInfo = `Company_name = ${companyName}`;
    const locationInfo = location ? `Company_location = ${location}` : '';

    return `${basePrompt}${companyInfo}${locationInfo}`;
  }

  async searchEntity(companyName: string, location?: string, customExcludeDomains?: string[]): Promise<LinkupAPIResponse> {
    try {
      console.log(`🔍 Searching entity: "${companyName}"${location ? ` in ${location}` : ''}`);

      const searchQuery = this.buildSearchQuery(companyName, location);

      // Combine default and custom exclude domains
      const defaultExcludes = this.getDefaultExcludeDomains();
      const allExcludes = customExcludeDomains
        ? [...defaultExcludes, ...customExcludeDomains]
        : defaultExcludes;

      // Remove duplicates
      const uniqueExcludes = [...new Set(allExcludes)];

      const requestBody = {
        q: searchQuery,
        depth: "standard",
        outputType: "sourcedAnswer",
        excludeDomains: uniqueExcludes
      };

      console.log('📤 Sending Linkup API request:', {
        endpoint: `${this.baseURL}/search`,
        queryLength: searchQuery.length,
        company: companyName,
        location: location || 'not specified',
        excludeDomainsCount: uniqueExcludes.length,
        excludedDomains: uniqueExcludes.slice(0, 5) // Show first 5 for logging
      });

      const response: AxiosResponse = await axios.post(
        `${this.baseURL}/search`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 second timeout for comprehensive search
          proxy: false, // Disable proxy to avoid connection issues
        }
      );

      console.log('✅ Linkup API response received:', {
        status: response.status,
        hasAnswer: !!response.data?.answer,
        hasSources: !!response.data?.sources,
        answerLength: response.data?.answer?.length || 0,
        sourcesCount: response.data?.sources?.length || 0
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('❌ Error calling Linkup API:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        company: companyName
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Unknown error occurred'
      };
    }
  }

  async testConnection(): Promise<LinkupAPIResponse> {
    try {
      console.log('🧪 Testing Linkup API connection...');

      // Use credits/balance endpoint for connection test
      const response: AxiosResponse = await axios.get(
        `${this.baseURL}/credits/balance`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 10000, // 10 second timeout for test
          proxy: false, // Disable proxy to avoid connection issues
        }
      );

      console.log('✅ Linkup API connection test successful:', {
        status: response.status,
        data: response.data
      });

      return {
        success: true,
        data: {
          status: 'connected',
          message: 'Linkup API connection successful',
          timestamp: new Date().toISOString(),
          credits: response.data
        }
      };

    } catch (error: any) {
      console.error('❌ Linkup API connection test failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Connection test failed'
      };
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}