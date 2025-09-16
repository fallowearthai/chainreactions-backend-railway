import axios, { AxiosInstance } from 'axios';
import {
  SearchEngineService,
  SearchEngineConfig,
  SearchEngineResult,
  SearchOptions,
  SearchResultItem,
  SearchEngineName
} from '../../types/searchEngines';

export class DuckDuckGoService implements SearchEngineService {
  private apiClient: AxiosInstance;
  private config: SearchEngineConfig;

  constructor() {
    this.config = {
      name: 'duckduckgo' as SearchEngineName,
      enabled: true, // DuckDuckGo API is free and doesn't require API key
      endpoint: 'https://api.duckduckgo.com',
      rate_limit: {
        requests_per_second: 1, // Be respectful to free service
        requests_per_month: 10000 // No official limit, but be conservative
      },
      strengths: ['privacy', 'uncensored', 'neutral', 'instant_answers'],
      geographic_focus: ['Global', 'Uncensored'],
      language_support: ['English', 'Multi-language'],
      priority_score: 7
    };

    this.apiClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OSINT-Research-Tool/1.0'
      }
    });
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchEngineResult> {
    try {
      const startTime = Date.now();

      // DuckDuckGo Instant Answer API
      const params = {
        q: query,
        format: 'json',
        no_html: 1,
        skip_disambig: 1,
        no_redirect: 1,
        safe_search: options.safe_search === 'strict' ? 1 : 0
      };

      console.log(`🦆 DuckDuckGo Search: "${query}"`);

      const response = await this.apiClient.get('/', { params });
      const searchTime = Date.now() - startTime;

      return this.parseResponse(query, response.data, searchTime);

    } catch (error) {
      console.error('DuckDuckGo API error:', error);

      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(`DuckDuckGo API Error: ${message}`);
      }

      throw error;
    }
  }

  private parseResponse(query: string, data: any, searchTime: number): SearchEngineResult {
    const results: SearchResultItem[] = [];

    try {
      // Extract instant answer if available
      if (data.Abstract && data.AbstractText) {
        results.push({
          title: data.Heading || 'Instant Answer',
          url: data.AbstractURL || '',
          snippet: data.AbstractText,
          displayUrl: data.AbstractSource || data.AbstractURL,
          source: 'duckduckgo_instant',
          language: 'en'
        });
      }

      // Extract definition if available
      if (data.Definition && data.DefinitionText) {
        results.push({
          title: `Definition: ${data.Heading || query}`,
          url: data.DefinitionURL || '',
          snippet: data.DefinitionText,
          displayUrl: data.DefinitionSource || data.DefinitionURL,
          source: 'duckduckgo_definition',
          language: 'en'
        });
      }

      // Extract related topics
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: this.extractTitle(topic.Text),
              url: topic.FirstURL,
              snippet: topic.Text,
              displayUrl: topic.FirstURL,
              source: 'duckduckgo_related',
              language: 'en'
            });
          }
        }
      }

      // Extract answer results
      if (data.Results && Array.isArray(data.Results)) {
        for (const result of data.Results) {
          if (result.Text && result.FirstURL) {
            results.push({
              title: this.extractTitle(result.Text),
              url: result.FirstURL,
              snippet: result.Text,
              displayUrl: result.FirstURL,
              source: 'duckduckgo_result',
              language: 'en'
            });
          }
        }
      }

      // Extract answer from Answer field
      if (data.Answer && data.AnswerType) {
        results.push({
          title: `${data.AnswerType}: ${query}`,
          url: '',
          snippet: data.Answer,
          displayUrl: 'DuckDuckGo Instant Answer',
          source: 'duckduckgo_answer',
          language: 'en'
        });
      }

      // If we have an infobox, extract it
      if (data.Infobox && data.Infobox.content) {
        for (const item of data.Infobox.content) {
          if (item.data_type === 'string' && item.value) {
            results.push({
              title: `${data.Heading || query} - ${item.label || 'Information'}`,
              url: data.AbstractURL || '',
              snippet: `${item.label || 'Info'}: ${item.value}`,
              displayUrl: data.AbstractSource || 'DuckDuckGo',
              source: 'duckduckgo_infobox',
              language: 'en'
            });
          }
        }
      }

    } catch (parseError) {
      console.warn('Error parsing DuckDuckGo response:', parseError);
    }

    return {
      engine: 'duckduckgo' as SearchEngineName,
      query,
      results,
      metadata: {
        total_results: results.length,
        search_time: searchTime,
        language: 'en',
        region: 'global'
      },
      raw_response: data
    };
  }

  private extractTitle(text: string): string {
    if (!text) return 'DuckDuckGo Result';

    // Try to extract a title from the first part of the text
    const sentences = text.split(/[.!?]/);
    const firstSentence = sentences[0]?.trim();

    if (firstSentence && firstSentence.length > 10 && firstSentence.length < 100) {
      return firstSentence;
    }

    // If the text is short enough, use it as title
    if (text.length < 80) {
      return text;
    }

    // Otherwise, truncate
    return text.substring(0, 77) + '...';
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
    return this.config.enabled;
  }

  getConfig(): SearchEngineConfig {
    return { ...this.config };
  }

  // Additional method for web search using DuckDuckGo HTML interface (limited)
  async searchWeb(query: string, options: SearchOptions = {}): Promise<SearchEngineResult> {
    try {
      const startTime = Date.now();

      // Note: This is a simplified approach. DuckDuckGo doesn't have a traditional web search API
      // This method provides instant answers and structured data, not traditional web search results
      const result = await this.search(query, options);

      // If we don't have good results from instant answers, we could potentially
      // add a note or suggestion to use other search engines for web results
      if (result.results.length === 0) {
        result.results.push({
          title: 'No instant answers found',
          url: '',
          snippet: `DuckDuckGo found no instant answers for "${query}". Consider using additional search engines for web results.`,
          displayUrl: 'DuckDuckGo',
          source: 'duckduckgo_notice',
          language: 'en'
        });
      }

      return result;

    } catch (error) {
      console.error('DuckDuckGo web search error:', error);
      throw error;
    }
  }

  // Test connection method
  async testConnection(): Promise<{ success: boolean; message: string; response_time?: number }> {
    try {
      const startTime = Date.now();
      const result = await this.search('test', { count: 1 });
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        message: `Connected successfully. DuckDuckGo instant answers available.`,
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