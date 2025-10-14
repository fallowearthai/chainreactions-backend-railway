import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  BrightDataSerpRequest,
  BrightDataSerpResponse,
  MultiEngineSearchRequest,
  MultiEngineSearchResponse,
  AggregatedResult,
  SerpEngine,
  SearchEngineConfig,
  EngineSelectionStrategy
} from '../types/brightDataSerpApi';

export class BrightDataSerpService implements EngineSelectionStrategy {
  private apiClient: AxiosInstance;
  private apiKey: string;
  private zone: string;
  private engineConfigs: Map<SerpEngine, SearchEngineConfig>;

  constructor() {
    this.apiKey = process.env.BRIGHT_DATA_API_KEY || '';
    this.zone = process.env.BRIGHT_DATA_SERP_ZONE || '';

    if (!this.apiKey || !this.zone) {
      console.warn('⚠️ Bright Data API key or zone not configured');
    }

    this.apiClient = axios.create({
      baseURL: 'https://api.brightdata.com',
      timeout: 90000, // Standard timeout for all engines
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'User-Agent': 'OSINT-Research-Tool/2.0'
      }
    });

    this.engineConfigs = new Map();
    this.initializeEngineConfigs();
  }

  private initializeEngineConfigs(): void {
    const configs: SearchEngineConfig[] = [
      {
        name: 'google',
        base_url: 'https://www.google.com/search'
      },
      {
        name: 'baidu',
        base_url: 'https://www.baidu.com/s'
      },
      {
        name: 'yandex',
        base_url: 'https://www.yandex.com/search'
      }
    ];

    configs.forEach(config => {
      this.engineConfigs.set(config.name, config);
    });

    console.log(`🔍 Bright Data SERP: ${this.engineConfigs.size} search engines configured`);
  }

  selectEngines(
    location: string,
    riskCategory: string,
    _languages: string[]
  ): { engines: SerpEngine[]; reasoning: string } {
    const selectedEngines: SerpEngine[] = [];
    const reasons: string[] = [];
    const locationLower = location.toLowerCase();

    // Always include Google as baseline
    selectedEngines.push('google');
    reasons.push('Google for comprehensive global coverage');

    // Geographic-based selection
    if (['china', 'hong kong', 'taiwan', 'macau'].some(region => locationLower.includes(region))) {
      selectedEngines.push('baidu');
      reasons.push('Baidu for native Chinese content and local sources');

    }

    if (['russia', 'belarus', 'kazakhstan', 'ukraine'].some(region => locationLower.includes(region))) {
      selectedEngines.push('yandex');
      reasons.push('Yandex for native Russian/Cyrillic content');

    }


    // Risk category based additions
    if (riskCategory === 'academic' || riskCategory === 'technology') {
      if (!selectedEngines.includes('yandex')) {
        selectedEngines.push('yandex');
        reasons.push('Yandex for academic and technical content diversity');
      }
    }


    // Default fallback for other regions
    if (selectedEngines.length === 1) {
      selectedEngines.push('yandex');
      reasons.push('Yandex for additional coverage');
    }

    return {
      engines: selectedEngines,
      reasoning: reasons.join('; ')
    };
  }

  async searchSingleEngine(
    engine: SerpEngine,
    query: string,
    options: {
      location?: string;
      language?: string;
      country?: string;
      num_results?: number;
      time_filter?: string;
      safe_search?: string;
      start_date?: string;  // Format: YYYY-MM
      end_date?: string;    // Format: YYYY-MM
    } = {}
  ): Promise<BrightDataSerpResponse> {
    try {

      // Use URL format for all supported engines with engine-specific API format
      const searchUrl = this.buildSearchUrl(engine, query, options);
      const request = this.buildEngineSpecificRequest(engine, searchUrl, options);

      console.log(`🔍 ${engine.toUpperCase()} Search: "${query}"`);
      console.log(`📡 Request URL: ${searchUrl}`);
      console.log(`📜 Request payload:`, JSON.stringify(request, null, 2));

      // Standard timeout for all engines
      const requestTimeout = 90000;

      const response = await this.apiClient.post('/request', request, {
        timeout: requestTimeout
      });

      console.log(`📨 ${engine.toUpperCase()} Response status:`, response.status);
      console.log(`📨 ${engine.toUpperCase()} Response headers:`, response.headers);
      console.log(`📨 ${engine.toUpperCase()} Raw response:`, JSON.stringify(response.data, null, 2).substring(0, 1000) + '...');

      const parsedResult = this.parseEngineResponse(engine, response.data);
      console.log(`✅ ${engine.toUpperCase()} Parsed ${parsedResult.results.length} results`);

      return parsedResult;

    } catch (error) {
      console.error(`❌ ${engine} search failed:`, error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.response?.data?.message || error.message;


        console.error(`❌ Error details:`, error.response?.data);
        throw new Error(`Bright Data SERP API Error for ${engine} (${status}): ${message}`);
      }

      throw error;
    }
  }

  private buildEngineSpecificRequest(
    engine: SerpEngine,
    searchUrl: string,
    options: any
  ): any {
    // Map restricted countries to allowed alternatives for Bright Data
    const countryMapping: Record<string, string> = {
      'ir': 'ae',   // Iran -> UAE (Middle East region)
      'ru': 'us',   // Russia -> USA (if restricted)
      'cn': 'hk',   // China -> Hong Kong (if needed)
      // Add more mappings as needed
    };

    // Use mapped country if original is restricted
    const originalCountry = options.country?.toLowerCase();
    const effectiveCountry = countryMapping[originalCountry] || options.country || 'us';

    // Log country mapping for debugging
    if (countryMapping[originalCountry]) {
      console.log(`🌍 Country mapping applied: ${originalCountry} -> ${effectiveCountry} for ${engine}`);
    }

    const baseRequest = {
      zone: this.zone,
      url: searchUrl,
      method: 'GET',
      country: effectiveCountry
    };

    // Engine-specific API format configuration
    switch (engine) {
      case 'google':
        // Google supports data_format: 'parsed' for structured JSON response
        return {
          ...baseRequest,
          format: 'json',
          data_format: 'parsed'
        };

      case 'yandex':
        // Yandex requires format but doesn't support data_format
        // Uses format: 'json' which returns HTML that we parse with cheerio
        return {
          zone: this.zone,
          url: searchUrl,
          method: 'GET',
          country: effectiveCountry,
          format: 'json'
          // Note: No data_format parameter for Yandex, only format
        };

      case 'baidu':
        // Baidu uses JSON format (returns HTML in body)
        return {
          ...baseRequest,
          format: 'json'
        };

      default:
        // Fallback to standard format
        return {
          ...baseRequest,
          format: 'json'
        };
    }
  }

  /**
   * Convert YYYY-MM format to Google date format MM/DD/YYYY
   */
  private convertToGoogleDateFormat(yearMonth: string, isEndDate: boolean): string {
    if (!yearMonth || !yearMonth.match(/^\d{4}-\d{2}$/)) {
      throw new Error(`Invalid date format: ${yearMonth}. Expected YYYY-MM format.`);
    }

    const [year, month] = yearMonth.split('-');
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (monthNum < 1 || monthNum > 12) {
      throw new Error(`Invalid month: ${monthNum}. Must be between 1-12.`);
    }

    let day: number;
    if (isEndDate) {
      // Get last day of month
      const lastDay = new Date(yearNum, monthNum, 0).getDate();
      day = lastDay;
    } else {
      // First day of month
      day = 1;
    }

    // Format as MM/DD/YYYY
    const monthStr = monthNum.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');

    return `${monthStr}/${dayStr}/${year}`;
  }

  private buildSearchUrl(
    engine: SerpEngine,
    query: string,
    options: any
  ): string {
    const config = this.engineConfigs.get(engine);
    if (!config) {
      throw new Error(`Unsupported search engine: ${engine}`);
    }

    const baseUrl = config.base_url;
    const params = new URLSearchParams();

    // Add engine-specific parameters
    switch (engine) {
      case 'google':
        params.set('q', query);
        params.set('hl', options.language || 'en');
        params.set('gl', options.country || 'us');
        if (options.num_results) params.set('num', options.num_results.toString());

        // Date filtering: Custom date range takes priority over time_filter
        if (options.start_date && options.end_date) {
          const googleStartDate = this.convertToGoogleDateFormat(options.start_date, false);
          const googleEndDate = this.convertToGoogleDateFormat(options.end_date, true);
          params.set('tbs', `cdr:1,cd_min:${googleStartDate},cd_max:${googleEndDate}`);
          console.log(`📅 Google date filter applied: ${options.start_date} to ${options.end_date} → ${googleStartDate} to ${googleEndDate}`);
        } else if (options.time_filter) {
          params.set('tbs', `qdr:${options.time_filter}`);
        }

        if (options.safe_search) params.set('safe', options.safe_search);
        break;


      case 'baidu':
        params.set('wd', query); // Baidu uses 'wd' instead of 'q'
        if (options.num_results) params.set('rn', options.num_results.toString());
        // Add additional Baidu-specific parameters
        params.set('pn', '1'); // Page number (start from page 1)
        params.set('ie', 'utf-8'); // Input encoding
        params.set('oe', 'utf-8'); // Output encoding
        break;

      case 'yandex':
        params.set('text', query); // Yandex uses 'text' instead of 'q'

        // Set language first, then region based on country/language
        if (options.language) {
          params.set('lang', options.language);
        }

        // Map countries to Yandex region codes (based on official Yandex location codes)
        const countryToLr: Record<string, string> = {
          'ru': '225',    // Russia (Universal location code)
          'us': '84',     // USA (keeping existing if working)
          'ir': '1004',   // Middle East region (since Iran not specifically listed)
          'cn': '134',    // China (confirmed)
          'hk': '134',    // Hong Kong (use China region)
          'uk': '102',    // United Kingdom (keeping existing)
          'de': '96',     // Germany (keeping existing)
          'fr': '124',    // France (keeping existing)
          'moscow': '213', // Moscow specifically
          'spb': '2',     // St. Petersburg
        };

        const regionCode = countryToLr[options.country?.toLowerCase()] || '84'; // Default to USA
        params.set('lr', regionCode);

        // Add pagination parameter
        params.set('p', '0'); // Start from page 0

        // Simplify time filter - only use supported values
        if (options.time_filter) {
          const timeMap: Record<string, string> = {
            'd': '77', // Past 24 hours
            'w': '1',  // Past 2 weeks
            'm': '1'   // Use 2 weeks instead of month for better compatibility
          };
          params.set('within', timeMap[options.time_filter] || '1');
        }
        break;

    }

    return `${baseUrl}?${params.toString()}`;
  }

  private parseEngineResponse(engine: SerpEngine, data: any): BrightDataSerpResponse {
    console.log(`🔍 Parsing ${engine} response structure:`, Object.keys(data || {}));
    console.log(`📊 ${engine} response details:`, {
      status_code: data.status_code,
      body_type: typeof data.body,
      body_keys: data.body && typeof data.body === 'object' ? Object.keys(data.body) : 'N/A',
      body_size: data.body ? (typeof data.body === 'string' ? data.body.length : 'object') : 0
    });

    // Enhanced Google structured data detection
    if (engine === 'google' && data.body) {
      let googleBody = data.body;

      // Handle Google's data_format: 'parsed' which may return JSON string
      if (typeof data.body === 'string') {
        console.log(`🔍 Google returned string body, attempting JSON parse...`);
        try {
          googleBody = JSON.parse(data.body);
          console.log(`✅ Google JSON parse successful, keys:`, Object.keys(googleBody));
        } catch (error) {
          console.warn(`⚠️ Google JSON parse failed:`, error instanceof Error ? error.message : String(error));
          // If JSON parse fails, fall through to HTML handling
          googleBody = null;
        }
      }

      if (googleBody && typeof googleBody === 'object') {
        console.log(`🔍 Google body structure analysis:`, {
          has_organic: !!googleBody.organic,
          has_results: !!googleBody.results,
          has_search_results: !!googleBody.search_results,
          has_general: !!googleBody.general,
          all_keys: Object.keys(googleBody)
        });

        // Check multiple possible result fields for Google
        const organicResults = googleBody.organic || googleBody.results || googleBody.search_results || googleBody.items;

        if (organicResults && Array.isArray(organicResults)) {
          console.log(`✅ Found ${organicResults.length} Google results in field:`,
            googleBody.organic ? 'organic' :
            googleBody.results ? 'results' :
            googleBody.search_results ? 'search_results' : 'items');

          const parsedResults = organicResults.map((result: any) => ({
            type: 'organic' as const,
            position: result.rank || result.position,
            title: result.title,
            url: result.link || result.url,
            snippet: result.description || result.snippet,
            displayed_url: result.display_link || result.displayed_url || result.link || result.url
          }));

          console.log(`✅ Google parsed ${parsedResults.length} structured results from parsed format`);

          return {
            engine,
            query: googleBody.general?.query || '',
            results: parsedResults,
            total_results: googleBody.general?.results_cnt || parsedResults.length,
            time_taken: googleBody.general?.search_time,
            related_searches: [],
            knowledge_graph: null,
            ads: []
          };
        } else {
          console.warn(`⚠️ Google: No valid result arrays found in structured response`);
          console.log(`📋 Available fields in googleBody:`, Object.keys(googleBody));
        }
      }
    }


    // Handle HTML content - parse for supported engines (format: 'json' responses)
    if (data && data.body && typeof data.body === 'string' && data.body.includes('<html')) {
      console.log(`📄 ${engine} returned HTML content (${data.body.length} chars)`);

      switch (engine) {
        case 'baidu':
          console.log(`🔍 Parsing Baidu HTML content...`);
          return this.parseBaiduHtml(data.body, engine);

        case 'yandex':
          console.log(`🔍 Parsing Yandex HTML content...`);
          return this.parseYandexHtml(data.body, engine);


        default:
          console.warn(`⚠️ ${engine} HTML parsing not implemented - returning empty results`);
          return {
            engine,
            query: '',
            results: [],
            total_results: 0,
            time_taken: 0,
            related_searches: [],
            knowledge_graph: null,
            ads: []
          };
      }
    }

    // Fallback for other response types
    console.log(`⚠️ Unexpected response format for ${engine}:`, typeof data);
    return this.parseGenericResponse(engine, data);
  }

  private parseBaiduHtml(html: string, engine: SerpEngine): BrightDataSerpResponse {
    console.log(`🔍 Parsing Baidu HTML content (${html.length} chars)...`);

    try {
      const $ = cheerio.load(html);
      const results: any[] = [];

      // Baidu search results are typically in div elements with class "result"
      $('.result, .c-container').each((index, element) => {
        const $element = $(element);

        // Extract title (usually in h3 > a)
        const titleElement = $element.find('h3 a, .t a, .c-title a').first();
        const title = titleElement.text().trim();
        const url = titleElement.attr('href') || '';

        // Extract snippet (usually in class "c-abstract" or similar)
        const snippet = $element.find('.c-abstract, .c-span9, .c-span18').first().text().trim();

        // Only add if we have meaningful data
        if (title && url) {
          results.push({
            type: 'organic' as const,
            position: index + 1,
            title: title,
            url: url.startsWith('http') ? url : `https://www.baidu.com${url}`,
            snippet: snippet || '',
            displayed_url: url
          });
        }
      });

      // If no results with .result class, try alternative selectors
      if (results.length === 0) {
        $('#content_left > div').each((index, element) => {
          const $element = $(element);

          // Skip ads and unwanted content
          if ($element.hasClass('ad') || $element.find('.ec_wise_ad').length > 0) {
            return;
          }

          const titleElement = $element.find('h3 a').first();
          const title = titleElement.text().trim();
          const url = titleElement.attr('href') || '';

          if (title && url) {
            const snippet = $element.find('.c-abstract, .c-span18').first().text().trim();
            results.push({
              type: 'organic' as const,
              position: index + 1,
              title: title,
              url: url.startsWith('http') ? url : `https://www.baidu.com${url}`,
              snippet: snippet || '',
              displayed_url: url
            });
          }
        });
      }

      console.log(`✅ Baidu HTML parsing extracted ${results.length} results`);

      return {
        engine,
        query: '', // Query not easily extractable from HTML
        results: results,
        total_results: results.length,
        time_taken: 0,
        related_searches: [],
        knowledge_graph: null,
        ads: []
      };

    } catch (error) {
      console.error(`❌ Baidu HTML parsing failed:`, error);
      return {
        engine,
        query: '',
        results: [],
        total_results: 0,
        time_taken: 0,
        related_searches: [],
        knowledge_graph: null,
        ads: []
      };
    }
  }

  private parseYandexHtml(html: string, engine: SerpEngine): BrightDataSerpResponse {
    console.log(`🔍 Parsing Yandex HTML content (${html.length} chars)...`);

    try {
      const $ = cheerio.load(html);
      const results: any[] = [];

      // Yandex search results are typically in div elements with class "serp-item"
      $('.serp-item, .organic').each((index, element) => {
        const $element = $(element);

        // Extract title (usually in h2 > a or .organic__title-wrapper a)
        const titleElement = $element.find('h2 a, .organic__title-wrapper a, .organic__url a').first();
        const title = titleElement.text().trim();
        const url = titleElement.attr('href') || '';

        // Extract snippet (usually in .organic__text or .serp-item__text)
        const snippet = $element.find('.organic__text, .serp-item__text, .text-container').first().text().trim();

        // Only add if we have meaningful data
        if (title && url) {
          results.push({
            type: 'organic' as const,
            position: index + 1,
            title: title,
            url: url.startsWith('http') ? url : `https://yandex.com${url}`,
            snippet: snippet || '',
            displayed_url: url
          });
        }
      });

      // If no results with main selectors, try alternative approach
      if (results.length === 0) {
        $('li[data-cid], .serp-list__item').each((index, element) => {
          const $element = $(element);

          // Skip ads
          if ($element.find('.serp-adv__found').length > 0) {
            return;
          }

          const titleElement = $element.find('h2 a, .link').first();
          const title = titleElement.text().trim();
          const url = titleElement.attr('href') || '';

          if (title && url) {
            const snippet = $element.find('.text-container, .serp-item__text').first().text().trim();
            results.push({
              type: 'organic' as const,
              position: index + 1,
              title: title,
              url: url.startsWith('http') ? url : `https://yandex.com${url}`,
              snippet: snippet || '',
              displayed_url: url
            });
          }
        });
      }

      console.log(`✅ Yandex HTML parsing extracted ${results.length} results`);

      return {
        engine,
        query: '',
        results: results,
        total_results: results.length,
        time_taken: 0,
        related_searches: [],
        knowledge_graph: null,
        ads: []
      };

    } catch (error) {
      console.error(`❌ Yandex HTML parsing failed:`, error);
      return {
        engine,
        query: '',
        results: [],
        total_results: 0,
        time_taken: 0,
        related_searches: [],
        knowledge_graph: null,
        ads: []
      };
    }
  }


  private parseGenericResponse(engine: SerpEngine, data: any): BrightDataSerpResponse {
    // Generic parsing for other engines
    if (data.results && Array.isArray(data.results)) {
      return {
        engine,
        query: data.query || '',
        results: data.results.map((result: any, index: number) => ({
          type: result.type || 'organic',
          position: result.position || index + 1,
          title: result.title || '',
          url: result.url || '',
          snippet: result.snippet || result.description || '',
          displayed_url: result.displayed_url || result.display_url || result.url,
          date: result.date || result.published_date,
          thumbnail: result.thumbnail
        })),
        total_results: data.total_results || data.results.length,
        time_taken: data.time_taken,
        related_searches: data.related_searches,
        knowledge_graph: data.knowledge_graph,
        ads: data.ads
      };
    }

    console.warn(`⚠️ No results found in ${engine} response structure`);
    return {
      engine,
      query: data.query || '',
      results: [],
      total_results: 0
    };
  }

  async searchMultipleEngines(request: MultiEngineSearchRequest): Promise<MultiEngineSearchResponse> {
    const startTime = Date.now();

    // Extract queries (support both single query and multiple queries)
    const queries = request.queries || (request.query ? [request.query] : []);
    if (queries.length === 0) {
      throw new Error('At least one query must be provided (query or queries field)');
    }

    // Determine which engines to use
    const selectedEngines = request.engines || this.selectEngines(
      request.location || 'Global',
      'unknown',
      [request.language || 'en']
    ).engines;

    console.log(`🔍 Multi-engine SERP search: ${queries.length > 1 ? `${queries.length} queries` : `"${queries[0]}"`} using [${selectedEngines.join(', ')}]`);

    const resultsByEngine: Record<string, BrightDataSerpResponse> = {};
    const allResults: AggregatedResult[] = [];
    const searchPromises: Promise<void>[] = [];

    let totalQueries = 0;
    let successfulQueries = 0;
    let enginesFailed = 0;

    // Execute searches for each query across all engines
    for (const query of queries) {
      for (const engine of selectedEngines) {
        totalQueries++;
        const searchPromise = this.searchSingleEngine(engine, query, {
          location: request.location,
          language: request.language,
          country: request.country_code || request.country,
          num_results: request.max_results_per_query || request.results_per_engine || 10,
          time_filter: request.time_filter,
          safe_search: request.safe_search
        })
          .then(result => {
            const engineKey = `${engine}_${query.substring(0, 20)}`;
            resultsByEngine[engineKey] = result;

            // Add results to aggregated list
            result.results.forEach((item, index) => {
              allResults.push({
                title: item.title || 'No title',
                url: item.url || '',
                snippet: item.snippet || '',
                sources: [engine],
                confidence_score: 1.0 - (index * 0.1), // Higher score for earlier results
                position_avg: item.position || index + 1,
                date: item.date
              });
            });

            successfulQueries++;
            console.log(`✅ ${engine}: ${result.results.length} results for "${query.substring(0, 30)}..."`);
          })
          .catch(error => {
            console.error(`❌ ${engine} search failed for "${query.substring(0, 30)}...":`, error.message);
            enginesFailed++;
          });

        searchPromises.push(searchPromise);
      }
    }

    // Wait for all searches to complete
    await Promise.all(searchPromises);

    // Use the simplified aggregation or the traditional one
    const aggregatedResults = allResults.length > 0 ? allResults : this.aggregateResults(resultsByEngine);
    const totalTime = Date.now() - startTime;

    console.log(`🎯 Multi-engine SERP completed: ${successfulQueries}/${totalQueries} queries succeeded, ${aggregatedResults.length} total results`);

    return {
      query: queries.length === 1 ? queries[0] : undefined,
      queries: queries.length > 1 ? queries : undefined,
      engines_used: selectedEngines,
      results_by_engine: resultsByEngine,
      results: aggregatedResults,  // Primary results field
      aggregated_results: aggregatedResults,  // Backward compatibility
      metadata: {
        total_results: aggregatedResults.length,
        total_time: totalTime,
        engines_succeeded: Math.floor(successfulQueries / queries.length),
        engines_failed: Math.floor((totalQueries - successfulQueries) / queries.length),
        timestamp: new Date().toISOString()
      }
    };
  }

  private aggregateResults(resultsByEngine: Record<string, BrightDataSerpResponse>): AggregatedResult[] {
    const urlMap = new Map<string, AggregatedResult>();

    // Collect all results with scoring
    for (const [engineName, engineResult] of Object.entries(resultsByEngine)) {
      const engineWeight = this.getEngineWeight(engineName as SerpEngine);

      for (const [index, result] of engineResult.results.entries()) {
        const normalizedUrl = this.normalizeUrl(result.url);
        const positionScore = Math.max(0, 1 - (index * 0.1));
        const confidence = engineWeight * positionScore;

        if (urlMap.has(normalizedUrl)) {
          // Merge with existing result
          const existing = urlMap.get(normalizedUrl)!;
          existing.sources.push(engineName as SerpEngine);
          existing.confidence_score += confidence * 0.3; // Boost for multiple sources
          existing.position_avg = (existing.position_avg + result.position) / 2;
        } else {
          // Create new aggregated result
          urlMap.set(normalizedUrl, {
            title: result.title,
            url: result.url,
            snippet: result.snippet || '',
            sources: [engineName as SerpEngine],
            confidence_score: confidence,
            position_avg: result.position,
            date: result.date
          });
        }
      }
    }

    // Sort by confidence score (highest first)
    return Array.from(urlMap.values())
      .sort((a, b) => b.confidence_score - a.confidence_score);
  }

  private getEngineWeight(engine: SerpEngine): number {
    const weights: Record<SerpEngine, number> = {
      google: 1.0,
      baidu: 0.8,
      yandex: 0.8,
      yahoo: 0.6,
      naver: 0.6
    };
    return weights[engine] || 0.5;
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove common tracking parameters
      urlObj.searchParams.delete('utm_source');
      urlObj.searchParams.delete('utm_medium');
      urlObj.searchParams.delete('utm_campaign');
      urlObj.searchParams.delete('fbclid');
      urlObj.searchParams.delete('gclid');
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  // Health check for the service
  async healthCheck(): Promise<{ available: boolean; message: string; engines_configured: number }> {
    try {
      if (!this.apiKey || !this.zone) {
        return {
          available: false,
          message: 'Bright Data API key or zone not configured',
          engines_configured: 0
        };
      }

      return {
        available: true,
        message: `Bright Data SERP API configured with ${this.engineConfigs.size} engines`,
        engines_configured: this.engineConfigs.size
      };
    } catch (error: any) {
      return {
        available: false,
        message: `Health check failed: ${error.message}`,
        engines_configured: 0
      };
    }
  }

  getAvailableEngines(): SerpEngine[] {
    return Array.from(this.engineConfigs.keys());
  }

  getEngineConfigs(): Record<string, SearchEngineConfig> {
    const configs: Record<string, SearchEngineConfig> = {};
    for (const [engineName, config] of this.engineConfigs) {
      configs[engineName] = config;
    }
    return configs;
  }
}