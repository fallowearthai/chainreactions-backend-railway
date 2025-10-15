import axios from 'axios';
import {
  NormalSearchRequest,
  GeminiRequestBody,
  GeminiResponse,
  NormalSearchResult,
  GroundingMetadata,
  EnhancedNormalSearchResult,
  EnhancedSearchResponse
} from '../types/gemini';
import { FeatureFlags, GroundingMetrics } from '../utils/FeatureFlags';

export class GeminiNormalSearchService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
  }

  /**
   * Build optimized system instruction prompt for enhanced grounding (matches successful test)
   */
  private buildOptimizedSystemInstruction(): string {
    return `## Prompt: OSINT Research on Institutional Risk Links

**Role**
You are deepdiver, a Research Security Analyst conducting initial open-source intelligence (OSINT) gathering.

---

### <Goal>

Using web search capabilities, investigate potential connections (e.g., documented cooperation, funding, joint projects, shared personnel, significant mentions linking them) between **Institution A** and each item in **Risk List C** within a specified time range.

Summarize key findings, identify any **potential intermediary organizations (B)** explicitly mentioned as linking **A** and **C**, and provide specific evidence from sources.
Treat **each item in List C individually** for investigation.

---

### <Information Gathering Strategy>

For each item in **Risk List C**:

* Formulate search queries combining **Institution A** (\`{Institution A}\`, \`{Location A}\`) with the specific risk item from List C.
* If \`time_range_start\` and \`time_range_end\` are provided, incorporate this date range into your search using Google's \`before:\` and \`after:\` filters or equivalent. **CRITICAL: When time range is specified, you MUST ONLY include information from within this exact time period. Events, publications, or relationships outside this range MUST BE EXCLUDED entirely from your analysis.**

Analyze results from:

* Reports, news, official sites, academic publications, or other public documents within the timeframe.
* Focus on **specific, verifiable connections**, not general background info.

Look for evidence of:

* **Direct Links**: Clear collaboration, joint funding, projects, or documented relationships.
* **Indirect Links**: A and C are both explicitly linked through **intermediary B** in a documented shared outcome.
* **Significant Mentions**: A and C are jointly discussed in a risk-related context, even without direct cooperation.

For **Potential B**, ensure:

* It is explicitly cited as facilitating the A–C connection.
* Mere co-membership in alliances or general funding from B is **not sufficient** unless a specific A–C project via B is described and sourced.

If credible evidence is found:

* Summarize the connection and assess reliability.
* **Avoid** irrelevant info like rankings or general institution pages unless they directly support a finding.

If no evidence is found:

* Clearly note that after thorough search within the range.

---

### <Input>

* **Institution A**: \`{Institution A}\`
* **Location A**: \`{Location A}\`
* **Risk List C**: \`{List C}\`  // Example: ["Military", "Specific Org X", "Technology Y"]
* **Time Range Start**: \`{time_range_start}\`  // Optional, format: "YYYY-MM"
* **Time Range End**: \`{time_range_end}\`  // Optional, format: "YYYY-MM"

---

### <Output Instructions>

Output **only** a JSON list.

Each item in **Risk List C** must be a separate JSON object containing:

\`\`\`json
{
  "risk_item": "string",
  "institution_A": "string",
  "relationship_type": "string", // One of: "Direct", "Indirect", "Significant Mention", "Unknown", "No Evidence Found"
  "finding_summary": "string", // Detailed analysis without manual citations
  "potential_intermediary_B": ["string"] | null, // Only if clearly described and cited.
}
\`\`\`

**CRITICAL REQUIREMENTS:**
1. Focus on detailed, comprehensive analysis
2. Provide specific evidence and facts in your analysis
3. Do NOT include a sources array - this will be handled automatically
4. Ensure each finding is supported by verifiable information from search results`;
  }

  /**
   * Build original system instruction prompt for OSINT research (legacy mode)
   */
  private buildSystemInstruction(): string {
    return `## Prompt: OSINT Research on Institutional Risk Links

**Role**
You are deepdiver, a Research Security Analyst conducting initial open-source intelligence (OSINT) gathering.

---

### <Goal>

Using web search capabilities, investigate potential connections (e.g., documented cooperation, funding, joint projects, shared personnel, significant mentions linking them) between **Institution A** and each item in **Risk List C** within a specified time range.

Summarize key findings, identify any **potential intermediary organizations (B)** explicitly mentioned as linking **A** and **C**, and provide **source URLs**.
Treat **each item in List C individually** for investigation.

---

### <Information Gathering Strategy>

For each item in **Risk List C**:

* Formulate search queries combining **Institution A** (\`{Institution A}\`, \`{Location A}\`) with the specific risk item from List C.
* If \`time_range_start\` and \`time_range_end\` are provided, incorporate this date range into your search using Google's \`before:\` and \`after:\` filters or equivalent. **CRITICAL: When time range is specified, you MUST ONLY include information from within this exact time period. Events, publications, or relationships outside this range MUST BE EXCLUDED entirely from your analysis.**

Analyze results from:

* Reports, news, official sites, academic publications, or other public documents within the timeframe.
* Focus on **specific, verifiable connections**, not general background info.

Look for evidence of:

* **Direct Links**: Clear collaboration, joint funding, projects, or documented relationships.
* **Indirect Links**: A and C are both explicitly linked through **intermediary B** in a documented shared outcome.
* **Significant Mentions**: A and C are jointly discussed in a risk-related context, even without direct cooperation.

For **Potential B**, ensure:

* It is explicitly cited as facilitating the A–C connection.
* Mere co-membership in alliances or general funding from B is **not sufficient** unless a specific A–C project via B is described and sourced.

If credible evidence is found:

* Summarize the connection and assess reliability.
* **Avoid** irrelevant info like rankings or general institution pages unless they directly support a finding.

If no evidence is found:

* Clearly note that after thorough search within the range.

---

### <Input>

* **Institution A**: \`{Institution A}\`
* **Location A**: \`{Location A}\`
* **Risk List C**: \`{List C}\`  // Example: ["Military", "Specific Org X", "Technology Y"]
* **Time Range Start**: \`{time_range_start}\`  // Optional, format: "YYYY-MM"
* **Time Range End**: \`{time_range_end}\`  // Optional, format: "YYYY-MM"

---

### <Output Instructions>

Output **only** a JSON list.

Each item in **Risk List C** must be a separate JSON object containing:

\`\`\`json
{
  "risk_item": "string",
  "institution_A": "string",
  "relationship_type": "string", // One of: "Direct", "Indirect", "Significant Mention", "Unknown", "No Evidence Found"
  "finding_summary": "string", // CRITICAL: Citations MUST match exactly with sources array positions
  "potential_intermediary_B": ["string"] | null, // Only if clearly described and cited.
  "sources": ["string"] // CRITICAL: Must contain exactly the same number of URLs as citations in finding_summary
}
\`\`\``;
  }

  /**
   * Build optimized user prompt (matches successful test)
   */
  private buildUserPrompt(request: NormalSearchRequest): string {
    const timeRangeText = request.Start_Date && request.End_Date
      ? `focusing STRICTLY on information within the specified time range ${request.Start_Date} to ${request.End_Date}`
      : '';

    return `I need you to investigate potential connections between the following institution and risk items: Institution A: ${request.Target_institution} Location: ${request.Location} Risk List C: ${request.Risk_Entity}. For each risk item, please analyze any direct or indirect connections, or significant mentions linking them with the institution.IMPORTANT INSTRUCTION:  You MUST search for each item in BOTH English AND the native language of ${request.Location}. For example, if the country is "China", search using both English terms AND Chinese terms. If the country is "Germany", search using both English terms AND German terms. If the country is "Worldwide", search using English terms. ${timeRangeText}.

CRITICAL OUTPUT REQUIREMENTS:
1. Provide detailed, comprehensive analysis
2. Include specific evidence and facts from search results
3. DO NOT include sources array in your output
4. Focus on verifiable connections and specific evidence`;
  }

  /**
   * Build optimized Gemini API request body for enhanced grounding
   */
  private buildOptimizedRequestBody(request: NormalSearchRequest): GeminiRequestBody {
    return {
      system_instruction: {
        parts: [
          {
            text: this.buildOptimizedSystemInstruction()
          }
        ]
      },
      contents: [
        {
          parts: [
            {
              text: this.buildUserPrompt(request)
            }
          ]
        }
      ],
      generationConfig: {
        // CRITICAL: NO thinkingConfig - this enables grounding chunks
        temperature: 0.2,
        maxOutputTokens: 65536,
        topP: 0.95,
        topK: 10
      },
      tools: [
        {
          google_search: {}  // Latest tool format (underscore version)
        }
      ]
    };
  }

  /**
   * Build original Gemini API request body (legacy mode)
   */
  private buildRequestBody(request: NormalSearchRequest): GeminiRequestBody {
    return {
      system_instruction: {
        parts: [
          {
            text: this.buildSystemInstruction()
          }
        ]
      },
      contents: [
        {
          parts: [
            {
              text: this.buildUserPrompt(request)
            }
          ]
        }
      ],
      generationConfig: {
        thinkingConfig: {
          thinkingBudget: 6000  // Reduced for faster processing (was 12000)
        },
        temperature: 0.2,
        maxOutputTokens: 65536,
        topP: 0.95,
        topK: 10
      },
      tools: [
        {
          codeExecution: {}
        },
        {
          googleSearch: {}  // Legacy tool format
        }
      ]
    };
  }

  /**
   * Extract grounding metadata from Gemini response
   */
  private extractGroundingMetadata(response: any): GroundingMetadata {
    const candidate = response?.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;

    return {
      has_grounding: !!groundingMetadata,
      grounding_chunks: groundingMetadata?.groundingChunks || [],
      grounding_supports: groundingMetadata?.groundingSupports || [],
      web_search_queries: groundingMetadata?.webSearchQueries || []
    };
  }

  /**
   * Process grounding chunks into high-quality sources
   */
  private processGroundingChunks(groundingChunks: any[]): Array<{
    title: string;
    url: string;
    type: string;
    chunk_index: number;
  }> {
    return groundingChunks.map((chunk: any, index: number) => ({
      title: chunk.web?.title || 'Unknown Source',
      url: chunk.web?.uri || '',
      type: this.categorizeUrl(chunk.web?.uri || ''),
      chunk_index: index
    }));
  }

  /**
   * Categorize URL types for source classification
   */
  private categorizeUrl(url: string): string {
    if (url.includes('.edu')) return 'academic';
    if (url.includes('.gov')) return 'government';
    if (url.includes('.org')) return 'organization';
    if (url.includes('news.') || url.includes('.news')) return 'news';
    if (url.includes('.com')) return 'commercial';
    return 'other';
  }

  /**
   * Map evidence to sources using groundingChunkIndices
   */
  private mapEvidenceToSources(
    groundingSupports: any[],
    relevantChunkIndices: Set<number>
  ): Array<{ text: string; source_indices: number[] }> {
    return groundingSupports
      .filter((support: any) =>
        support.groundingChunkIndices?.some((index: number) => relevantChunkIndices.has(index))
      )
      .map((support: any) => ({
        text: support.segment.text,
        source_indices: support.groundingChunkIndices || []
      }));
  }

  /**
   * Build enhanced response with grounding metadata
   */
  private buildEnhancedResponse(
    parsedFindings: any[],
    groundingMetadata: GroundingMetadata,
    searchQueries: string[],
    executionTimeMs: number
  ): EnhancedNormalSearchResult[] {
    // Process grounding chunks into sources
    const sources = this.processGroundingChunks(groundingMetadata.grounding_chunks);

    // Get relevant chunk indices for filtering
    const relevantChunkIndices = new Set(
      groundingMetadata.grounding_supports.flatMap(support => support.groundingChunkIndices || [])
    );

    // Map evidence to sources using groundingChunkIndices
    const evidenceMapping = this.mapEvidenceToSources(
      groundingMetadata.grounding_supports,
      relevantChunkIndices
    );

    // Build enhanced findings
    const enhancedFindings = parsedFindings.map((finding, index) => {
      // Find relevant evidence for this finding
      const findingEvidence = evidenceMapping.slice(index * 3, (index + 1) * 3);

      return {
        ...finding,
        key_evidence: findingEvidence.length > 0 ? findingEvidence : [],
        sources: sources,
        search_queries: searchQueries,
        quality_metrics: {
          evidence_count: findingEvidence.length,
          source_count: sources.length,
          coverage_percentage: groundingMetadata.grounding_supports.length > 0 ? 100 : 0
        }
      };
    });

    return enhancedFindings;
  }

  /**
   * Extract text content from Gemini response
   */
  private extractTextFromResponse(response: GeminiResponse): string | null {
    try {
      const candidates = response?.candidates;
      if (candidates && Array.isArray(candidates) && candidates.length > 0) {
        const content = candidates[0]?.content;
        if (content && content.parts && Array.isArray(content.parts)) {
          // Merge all text fields
          let allTextContent = '';
          for (const part of content.parts) {
            if (part && part.text) {
              allTextContent += part.text;
            }
          }

          if (allTextContent) {
            return allTextContent;
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error extracting text from response:', error);
      return null;
    }
  }

  /**
   * Extract JSON from markdown or raw text
   */
  private extractJsonFromText(text: string): string | null {
    if (typeof text !== 'string') {
      return null;
    }

    // Find content between ```json and ```
    const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1].trim();
    }

    // Try to find direct JSON array or object
    const directJsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (directJsonMatch && directJsonMatch[1]) {
      return directJsonMatch[1].trim();
    }

    return text;
  }

  /**
   * Clean JSON string from control characters and formatting issues
   */
  private cleanJsonString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    return str
      // Remove control characters (ASCII 0-31, except \t \n \r)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Clean extra backslashes
      .replace(/\\\\/g, '\\')
      // Fix line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove zero-width characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Remove other invisible characters
      .replace(/[\u2028\u2029]/g, '');
  }

  /**
   * Parse JSON response with error handling
   */
  private parseJsonResponse(textContent: string): NormalSearchResult[] | null {
    try {
      const jsonContent = this.extractJsonFromText(textContent);
      if (!jsonContent) {
        console.error('No JSON content found in text');
        return null;
      }

      const cleanedString = this.cleanJsonString(jsonContent);
      const parsed = JSON.parse(cleanedString);

      if (Array.isArray(parsed)) {
        return parsed as NormalSearchResult[];
      } else if (typeof parsed === 'object' && parsed !== null) {
        return [parsed] as NormalSearchResult[];
      }

      return null;
    } catch (error) {
      console.error('JSON parsing error:', error);
      console.error('Text content:', textContent.substring(0, 500));
      return null;
    }
  }

  
  /**
   * Execute enhanced normal search with grounding metadata
   */
  async executeEnhancedNormalSearch(request: NormalSearchRequest): Promise<EnhancedSearchResponse> {
    const startTime = Date.now();
    FeatureFlags.setCurrentRequest(request);

    FeatureFlags.log('Starting enhanced normal search', 'info', {
      institution: request.Target_institution,
      riskEntity: request.Risk_Entity,
      location: request.Location
    });

    try {
      const requestBody = this.buildOptimizedRequestBody(request);

      FeatureFlags.log('Built optimized API request', 'debug', {
        system_instruction: 'optimized_grounding',
        tool_format: 'google_search',
        thinking_config: 'disabled'
      });

      const response = await axios.post(
        this.apiUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          params: {
            key: this.apiKey
          },
          timeout: 180000 // 3 minutes timeout
        }
      );

      const executionTime = Date.now() - startTime;
      const textContent = this.extractTextFromResponse(response.data);
      if (!textContent) {
        throw new Error('Failed to extract text content from Gemini response');
      }

      FeatureFlags.log('Extracted text content', 'debug', {
        contentLength: textContent.length,
        executionTime: executionTime
      });

      // Extract grounding metadata
      const groundingMetadata = this.extractGroundingMetadata(response.data);

      // Debug: Log full API response structure
      FeatureFlags.log('Full API response structure', 'debug', {
        candidatesCount: response.data.candidates?.length || 0,
        hasGroundingMetadata: !!response.data.candidates?.[0]?.groundingMetadata,
        groundingMetadataKeys: response.data.candidates?.[0]?.groundingMetadata ?
          Object.keys(response.data.candidates[0].groundingMetadata) : [],
        fullResponse: response.data
      });

      FeatureFlags.log('Extracted grounding metadata', 'info', {
        hasGrounding: groundingMetadata.has_grounding,
        chunksCount: groundingMetadata.grounding_chunks.length,
        supportsCount: groundingMetadata.grounding_supports.length,
        searchQueriesCount: groundingMetadata.web_search_queries.length
      });

      // Parse findings from JSON
      const parsedFindings = this.parseJsonResponse(textContent);
      if (!parsedFindings || parsedFindings.length === 0) {
        FeatureFlags.log('No results parsed from Gemini response', 'warn');
        return {
          results: [],
          enhanced_mode: true
        };
      }

      // Build enhanced response with grounding
      const enhancedResults = this.buildEnhancedResponse(
        parsedFindings,
        groundingMetadata,
        groundingMetadata.web_search_queries,
        executionTime
      );

      // Calculate grounding metrics
      const groundingMetrics = FeatureFlags.calculateGroundingMetrics(
        groundingMetadata.grounding_chunks,
        groundingMetadata.grounding_supports,
        executionTime
      );

      FeatureFlags.logGroundingMetrics(groundingMetrics, request);

      // Check if metrics meet quality thresholds
      const meetsThresholds = FeatureFlags.meetsQualityThresholds(groundingMetrics);
      FeatureFlags.log('Quality threshold check', meetsThresholds ? 'info' : 'warn', {
        meetsThresholds,
        metrics: groundingMetrics
      });

      FeatureFlags.log('Enhanced search completed successfully', 'info', {
        resultsCount: enhancedResults.length,
        sourcesCount: groundingMetadata.grounding_chunks.length,
        evidenceCount: groundingMetadata.grounding_supports.length,
        executionTime
      });

      return {
        results: enhancedResults,
        grounding_metadata: groundingMetadata,
        grounding_metrics: groundingMetrics,
        enhanced_mode: true
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      FeatureFlags.log('Enhanced search failed', 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      });

      if (axios.isAxiosError(error)) {
        FeatureFlags.log('Gemini API Error', 'error', {
          status: error.response?.status,
          data: error.response?.data
        });
        throw new Error(`Gemini API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Execute normal search using Gemini API with Google Search tools (legacy mode)
   */
  async executeNormalSearch(request: NormalSearchRequest): Promise<{
    results: NormalSearchResult[];
  }> {
    try {
      const requestBody = this.buildRequestBody(request);

      console.log('🔍 Executing Gemini Normal Search...');
      console.log('Target Institution:', request.Target_institution);
      console.log('Risk Entity:', request.Risk_Entity);
      console.log('Location:', request.Location);

      const response = await axios.post<GeminiResponse>(
        this.apiUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          params: {
            key: this.apiKey
          },
          timeout: 180000 // 3 minutes timeout (increased for complex searches)
        }
      );

      const textContent = this.extractTextFromResponse(response.data);
      if (!textContent) {
        throw new Error('Failed to extract text content from Gemini response');
      }

      console.log('📝 Extracted text content length:', textContent.length);

      const results = this.parseJsonResponse(textContent);
      if (!results || results.length === 0) {
        console.warn('⚠️ No results parsed from Gemini response');
        return {
          results: []
        };
      }

      console.log('✅ Successfully parsed', results.length, 'search results');

      return {
        results
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Gemini API Error:', error.response?.data || error.message);
        throw new Error(`Gemini API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Execute search with feature flag support (main entry point)
   */
  async executeSearch(request: NormalSearchRequest): Promise<{
    results: NormalSearchResult[];
  }> {
    FeatureFlags.setCurrentRequest(request);

    // Check if enhanced grounding should be used
    if (FeatureFlags.shouldUseEnhancedGrounding()) {
      FeatureFlags.log('Using enhanced grounding mode', 'info');
      const enhancedResponse = await this.executeEnhancedNormalSearch(request);

      // Convert enhanced response to legacy format for backward compatibility
      return {
        results: enhancedResponse.results.map(result => ({
          risk_item: result.risk_item,
          institution_A: result.institution_A,
          relationship_type: result.relationship_type,
          finding_summary: result.finding_summary,
          potential_intermediary_B: result.potential_intermediary_B,
          sources: result.sources?.map(s => s.url) || [],
          // Add enhanced data as optional fields
          ...(process.env.NODE_ENV === 'development' && {
            key_evidence: result.key_evidence,
            enhanced_sources: result.sources,
            search_queries: result.search_queries,
            quality_metrics: result.quality_metrics
          })
        }))
      };
    } else {
      FeatureFlags.log('Using legacy search mode', 'info');
      return this.executeNormalSearch(request);
    }
  }
}
