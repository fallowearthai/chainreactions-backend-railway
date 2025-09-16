import axios, { AxiosInstance } from 'axios';
import {
  SearchEngineService,
  SearchEngineConfig,
  SearchEngineResult,
  SearchOptions,
  SearchResultItem,
  SearchEngineName
} from '../../types/searchEngines';

export class BingSearchService implements SearchEngineService {
  private apiClient: AxiosInstance;
  private config: SearchEngineConfig;

  constructor() {
    this.config = {
      name: 'bing' as SearchEngineName,
      enabled: !!process.env.BING_SEARCH_API_KEY,
      api_key: process.env.BING_SEARCH_API_KEY,
      endpoint: 'https://api.bing.microsoft.com/v7.0/search',
      rate_limit: {
        requests_per_second: 3,
        requests_per_month: 3000 // Free tier limit
      },
      strengths: ['balanced', 'accessible', 'global'],
      geographic_focus: ['Global', 'China', 'Middle East'],
      language_support: ['English', 'Chinese', 'Arabic', 'Russian', 'Spanish'],
      priority_score: 8
    };

    this.apiClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: 30000,
      headers: {
        'Ocp-Apim-Subscription-Key': this.config.api_key || '',
        'Accept': 'application/json',
        'User-Agent': 'OSINT-Research-Tool/1.0'
      }
    });
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchEngineResult> {
    if (!this.isAvailable()) {
      throw new Error('Bing Search API is not available. Please check API key configuration.');
    }

    try {
      const startTime = Date.now();

      const params = {
        q: query,
        count: options.count || 20,
        offset: options.offset || 0,
        mkt: this.getMarketCode(options.language, options.region),
        safeSearch: this.getSafeSearchValue(options.safe_search),
        freshness: this.getFreshnessValue(options.time_filter),
        responseFilter: 'Webpages',
        textDecorations: false,
        textFormat: 'HTML'
      };

      console.log(`🔍 Bing Search: "${query}" (${params.count} results)`);

      const response = await this.apiClient.get('', { params });
      const searchTime = Date.now() - startTime;

      return this.parseResponse(query, response.data, searchTime);

    } catch (error) {
      console.error('Bing Search API error:', error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(`Bing Search API Error (${status}): ${message}`);
      }

      throw error;
    }
  }

  private parseResponse(query: string, data: any, searchTime: number): SearchEngineResult {
    const webPages = data.webPages || {};
    const results: SearchResultItem[] = [];

    if (webPages.value && Array.isArray(webPages.value)) {
      for (const item of webPages.value) {
        results.push({
          title: this.cleanText(item.name || ''),
          url: item.url || '',
          snippet: this.cleanText(item.snippet || ''),
          displayUrl: item.displayUrl || item.url,
          datePublished: item.dateLastCrawled,
          language: data.queryContext?.originalQuery ? this.detectLanguage(data.queryContext.originalQuery) : undefined,
          source: 'bing'
        });
      }
    }

    return {
      engine: 'bing' as SearchEngineName,
      query,
      results,
      metadata: {
        total_results: webPages.totalEstimatedMatches || results.length,
        search_time: searchTime,
        language: data.queryContext?.originalQuery ? this.detectLanguage(data.queryContext.originalQuery) : undefined,
        region: data.queryContext?.adultIntent
      },
      raw_response: data
    };
  }

  private getMarketCode(language?: string, region?: string): string {
    // Map language/region to Bing market codes
    const marketMap: Record<string, string> = {
      'en-US': 'en-US',
      'en-GB': 'en-GB',
      'zh-CN': 'zh-CN',
      'zh-TW': 'zh-TW',
      'ru-RU': 'ru-RU',
      'ar-SA': 'ar-SA',
      'ja-JP': 'ja-JP',
      'ko-KR': 'ko-KR',
      'de-DE': 'de-DE',
      'fr-FR': 'fr-FR',
      'es-ES': 'es-ES'
    };

    if (language && region) {
      const key = `${language}-${region}`;
      return marketMap[key] || 'en-US';
    }

    if (language) {
      // Map common language codes
      const langMap: Record<string, string> = {
        'chinese': 'zh-CN',
        'russian': 'ru-RU',
        'arabic': 'ar-SA',
        'japanese': 'ja-JP',
        'korean': 'ko-KR',
        'german': 'de-DE',
        'french': 'fr-FR',
        'spanish': 'es-ES'
      };

      return langMap[language.toLowerCase()] || 'en-US';
    }

    return 'en-US'; // Default
  }

  private getSafeSearchValue(safeSearch?: 'strict' | 'moderate' | 'off'): string {
    const safeSearchMap: Record<string, string> = {
      'strict': 'Strict',
      'moderate': 'Moderate',
      'off': 'Off'
    };

    return safeSearchMap[safeSearch || 'moderate'] || 'Moderate';
  }

  private getFreshnessValue(timeFilter?: string): string | undefined {
    const freshnessMap: Record<string, string> = {
      'day': 'Day',
      'week': 'Week',
      'month': 'Month',
      'year': 'Year'
    };

    return timeFilter ? freshnessMap[timeFilter] : undefined;
  }

  private detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u0400-\u04ff]/.test(text)) return 'ru';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';

    return 'en'; // Default to English
  }

  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  isAvailable(): boolean {
    return this.config.enabled && !!this.config.api_key;
  }

  getConfig(): SearchEngineConfig {
    return { ...this.config };
  }

  // Test connection method
  async testConnection(): Promise<{ success: boolean; message: string; response_time?: number }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        message: 'Bing Search API key not configured'
      };
    }

    try {
      const startTime = Date.now();
      const result = await this.search('test query', { count: 1 });
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        message: `Connected successfully. Found ${result.results.length} results.`,
        response_time: responseTime
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }
}