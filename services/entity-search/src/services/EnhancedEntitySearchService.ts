import axios from 'axios';
import { EnhancedEntitySearchRequest, EnhancedEntitySearchResponse, BasicCompanyInfo } from '../types/enhanced-types';

/**
 * Enhanced Entity Search Service (Simplified)
 * 专注于基础公司信息搜索，使用 Gemini API
 *
 * 核心功能:
 * 1. 基础公司信息搜索
 * 专注于收集高质量的工商注册信息、官方网站数据、行业分类等基础企业信息
 */

export class EnhancedEntitySearchService {
  private apiKey: string;
  private geminiApiUrl: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY not configured.');
    }
  }

  /**
   * Main entry point: Enhanced entity search (simplified - basic info only)
   */
  async searchEntity(request: EnhancedEntitySearchRequest): Promise<EnhancedEntitySearchResponse> {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Company Information Search: ${request.company_name}`);
    console.log(`📍 Location: ${request.location || 'Not specified'}`);
    console.log(`${'='.repeat(70)}\n`);

    try {
      let basicInfo: BasicCompanyInfo | undefined;
      let totalSources = 0;
      let totalSearchQueries = 0;
      let apiCallsCount = 0;

      // Basic company information search
      console.log('📋 Fetching basic company information...');
      const basicInfoResult = await this.getBasicCompanyInfo(
        request.company_name,
        request.location
      );

      if (basicInfoResult.success && basicInfoResult.data) {
        basicInfo = basicInfoResult.data;
        totalSources += basicInfoResult.data.sources?.length || 0;
        totalSearchQueries += basicInfoResult.data.search_queries?.length || 0;
        apiCallsCount++;
        console.log(`✅ Basic info retrieved (${totalSources} sources)\n`);
      } else {
        console.log(`⚠️  Basic info retrieval failed: ${basicInfoResult.error}\n`);
      }

      const duration = Date.now() - startTime;

      console.log(`\n${'='.repeat(70)}`);
      console.log(`✅ Search completed in ${(duration / 1000).toFixed(2)}s`);
      console.log(`📊 Total sources: ${totalSources}`);
      console.log(`🔎 Total queries: ${totalSearchQueries}`);
      console.log(`📡 API calls: ${apiCallsCount}`);
      console.log(`${'='.repeat(70)}\n`);

      return {
        success: true,
        company: request.company_name,
        location: request.location,
        basic_info: basicInfo,
        metadata: {
          search_duration_ms: duration,
          total_sources: totalSources,
          search_queries_executed: totalSearchQueries,
          api_calls_made: apiCallsCount
        }
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ Company search failed after ${duration}ms:`, error.message);

      return {
        success: false,
        company: request.company_name,
        location: request.location,
        error: error.message,
        metadata: {
          search_duration_ms: duration,
          total_sources: 0,
          search_queries_executed: 0,
          api_calls_made: 0
        }
      };
    }
  }

  /**
   * Get basic company information using Gemini API
   */
  private async getBasicCompanyInfo(
    companyName: string,
    location?: string
  ): Promise<{
    success: boolean;
    data?: BasicCompanyInfo & { sources?: any[]; search_queries?: string[] };
    error?: string;
  }> {
    const systemPrompt = `You are a business intelligence analyst. Provide concise company information.

Focus on:
- Official registered name and English name
- Headquarters address
- Primary business sectors
- Brief description

Keep it concise. Return JSON format:
{
  "name": "Official name",
  "english_name": "English name",
  "headquarters": "Full address",
  "sectors": ["Sector 1", "Sector 2"],
  "description": "Brief description",
  "past_names": ["Previous name if any"]
}

Do NOT include sources array - handled automatically.`;

    const userPrompt = `Company: ${companyName}${location ? `\nLocation: ${location}` : ''}

Provide basic company information in JSON format.`;

    try {
      console.log('📋 [BASIC INFO] Starting basic company info search...');
      const response = await this.callGeminiAPI(systemPrompt, userPrompt);

      console.log('📝 [BASIC INFO] Extracting text content from response...');
      const textContent = this.extractTextFromResponse(response);
      if (!textContent) {
        console.error('❌ [BASIC INFO] No text content in response');
        console.log('   - Response structure:', JSON.stringify(response, null, 2));
        return { success: false, error: 'No text content in API response' };
      }

      console.log(`📄 [BASIC INFO] Extracted ${textContent.length} characters of text`);
      console.log('   - Content preview:', textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''));

      console.log('🔍 [BASIC INFO] Parsing JSON response...');
      const parsed = this.parseJsonResponse(textContent);
      if (!parsed) {
        console.error('❌ [BASIC INFO] Failed to parse JSON response');
        console.log('   - Raw text content:', textContent);
        return { success: false, error: 'Failed to parse JSON from API response - invalid format' };
      }

      console.log('✅ [BASIC INFO] Successfully parsed JSON:', Object.keys(parsed));

      // Extract grounding metadata
      console.log('🔗 [BASIC INFO] Extracting grounding metadata...');
      const groundingMetadata = this.extractGroundingMetadata(response);
      const sources = this.processGroundingChunks(groundingMetadata.grounding_chunks);

      console.log(`📚 [BASIC INFO] Processing complete:`);
      console.log(`   - Sources found: ${sources.length}`);
      console.log(`   - Search queries: ${groundingMetadata.web_search_queries?.length || 0}`);
      console.log(`   - Company name: ${parsed.name || 'Not found'}`);
      console.log(`   - English name: ${parsed.english_name || 'Not found'}`);

      return {
        success: true,
        data: {
          ...parsed,
          sources,
          search_queries: groundingMetadata.web_search_queries
        }
      };

    } catch (error: any) {
      console.error(`❌ [BASIC INFO] Company info search failed: ${error.message}`);
      console.error(`   - Error type: ${error.constructor.name}`);
      console.error(`   - Stack trace:`, error.stack);

      // Return more detailed error information
      const errorMessage = `Company info search failed: ${error.message}`;
      console.error(`   - Additional context:`);
      console.error(`     - Error type: ${error.constructor.name}`);
      console.error(`     - Company: ${companyName}`);
      console.error(`     - Location: ${location || 'Not specified'}`);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // ==================== Gemini API Helper Methods ====================

  private async callGeminiAPI(systemPrompt: string, userPrompt: string): Promise<any> {
    // Check API key configuration
    if (!this.apiKey || this.apiKey.length === 0) {
      throw new Error('Gemini API key not configured');
    }

    const requestBody = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        topP: 0.95,
        topK: 10
      },
      tools: [
        {
          google_search: {}
        }
      ]
    };

    console.log('🌐 [GEMINI API] Making API call...');
    console.log(`   - URL: ${this.geminiApiUrl}`);
    console.log(`   - API Key configured: ${this.apiKey ? 'Yes' : 'No'}`);
    console.log(`   - Request body size: ${JSON.stringify(requestBody).length} characters`);

    try {
      const response = await axios.post(
        this.geminiApiUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          params: {
            key: this.apiKey
          },
          timeout: 120000
        }
      );

      console.log(`✅ [GEMINI API] Response received:`);
      console.log(`   - Status: ${response.status} ${response.statusText}`);
      console.log(`   - Response size: ${JSON.stringify(response.data).length} characters`);

      // Check if response has candidates
      const candidates = response.data?.candidates;
      if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
        console.warn(`⚠️  [GEMINI API] No candidates in response`);
        console.log('   - Response structure:', JSON.stringify(response.data, null, 2));
      } else {
        console.log(`   - Candidates count: ${candidates.length}`);
        console.log(`   - First candidate finish reason: ${candidates[0]?.finishReason || 'Unknown'}`);
      }

      return response.data;

    } catch (error: any) {
      console.error(`❌ [GEMINI API] API call failed:`);
      console.error(`   - Error type: ${error.constructor.name}`);
      console.error(`   - Error message: ${error.message}`);

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(`   - Response status: ${error.response.status} ${error.response.statusText}`);
        console.error(`   - Response data:`, error.response.data);

        // Handle specific error codes
        if (error.response.status === 400) {
          throw new Error(`Gemini API bad request: ${error.response.data?.error?.message || 'Invalid request'}`);
        } else if (error.response.status === 401) {
          throw new Error('Gemini API authentication failed - check API key');
        } else if (error.response.status === 403) {
          throw new Error(`Gemini API access forbidden: ${error.response.data?.error?.message || 'Permission denied'}`);
        } else if (error.response.status === 429) {
          throw new Error('Gemini API rate limit exceeded - please try again later');
        } else if (error.response.status >= 500) {
          throw new Error(`Gemini API server error: ${error.response.status} - try again later`);
        } else {
          throw new Error(`Gemini API error: ${error.response.status} - ${error.response.data?.error?.message || error.response.statusText}`);
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error(`   - No response received - request timeout or network error`);
        throw new Error('Gemini API network error - no response received');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error(`   - Request setup error: ${error.message}`);
        throw new Error(`Gemini API request error: ${error.message}`);
      }
    }
  }

  private extractTextFromResponse(response: any): string | null {
    try {
      const candidates = response?.candidates;
      if (candidates && Array.isArray(candidates) && candidates.length > 0) {
        const content = candidates[0]?.content;
        if (content && content.parts && Array.isArray(content.parts)) {
          let allText = '';
          for (const part of content.parts) {
            if (part && part.text) {
              allText += part.text;
            }
          }
          return allText || null;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private parseJsonResponse(text: string): any | null {
    try {
      // Extract JSON from markdown
      const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
      const jsonContent = jsonMatch ? jsonMatch[1].trim() : text;

      // Clean JSON string
      const cleaned = jsonContent
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\\\\/g, '\\')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');

      return JSON.parse(cleaned);
    } catch (error) {
      return null;
    }
  }

  private extractGroundingMetadata(response: any): any {
    const candidate = response?.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;

    return {
      has_grounding: !!groundingMetadata,
      grounding_chunks: groundingMetadata?.groundingChunks || [],
      grounding_supports: groundingMetadata?.groundingSupports || [],
      web_search_queries: groundingMetadata?.webSearchQueries || []
    };
  }

  private processGroundingChunks(chunks: any[]): Array<{
    title: string;
    url: string;
    type: string;
  }> {
    return chunks.map((chunk: any) => ({
      title: chunk.web?.title || 'Unknown',
      url: chunk.web?.uri || '',
      type: this.categorizeUrl(chunk.web?.uri || '')
    }));
  }

  private categorizeUrl(url: string): string {
    if (url.includes('.edu')) return 'academic';
    if (url.includes('.gov')) return 'government';
    if (url.includes('.org')) return 'organization';
    if (url.includes('.mil')) return 'military';
    if (url.includes('news.') || url.includes('.news')) return 'news';
    return 'commercial';
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}