import axios from 'axios';
import {
  NormalSearchRequest,
  GeminiRequestBody,
  GeminiResponse,
  NormalSearchResult,
  GroundingMetadata,
  EnhancedSource,
  EnhancedNormalSearchResult,
  EnhancedSearchResponse
} from '../types/gemini';
import { FeatureFlags, GroundingMetrics } from '../utils/FeatureFlags';

export class GeminiNormalSearchService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
  }

  /**
   * Build optimized system instruction prompt for enhanced grounding
   * BALANCED VERSION with Multi-Dimension OSINT Guidance
   */
  private buildOptimizedSystemInstruction(): string {
    return `**ROLE**
You are an expert OSINT analyst specializing in institutional risk assessment and relationship mapping for security professionals.

**MISSION**
Investigate connections between Institution A and Risk Entity C using comprehensive, multi-dimensional approach. Security analysts require thorough evidence coverage - missed connections could be critical.

**SEARCH DIMENSIONS TO EXPLORE**

Search broadly across these key dimensions when investigating relationships:

1. **Personnel (人员)**: Researchers, professors, alumni, visiting scholars, shared staff
2. **Projects (项目)**: Joint research, collaborations, contracts, grants
3. **Publications (论文)**: Co-authored papers, joint patents, conference proceedings
4. **Events (活动)**: Conferences, symposiums, workshops, joint participation
5. **Funding (资金)**: Grants, contracts, procurement, financial ties
6. **Media (媒体)**: News reports, investigative journalism, intelligence analysis
7. **Organizations (组织)**: Joint labs, formal agreements, sister institutions

**SEARCH STRATEGY**

1. **Multi-language Search Requirements:**
   - Search in BOTH English AND the native language of the location
   - Example: For China, search using English terms AND Chinese terms
   - Use quotation marks for exact institution names: "完整机构名称" "exact name"

2. **Advanced Search Techniques:**
   - Use site: for specific domains (site:edu.cn, site:gov.cn, site:.edu, site:.gov)
   - Use filetype: for documents (filetype:pdf, filetype:doc)
   - Use before: and after: for time filtering when dates specified
   - Prioritize official sources: .gov, .edu, established news organizations

3. **Time Range Compliance:**
   - When dates are provided, use Google's before: and after: filters
   - ONLY include information from within the exact specified time period
   - Events outside the range must be completely excluded

4. **Evidence Quality Standards:**
   - **STRONG**: Official documents, contracts, co-authored publications, government records
   - **MODERATE**: Reputable news reports, conference participation, announcements
   - **WEAK**: General mentions, indirect associations, secondary sources

**CONNECTION TYPES TO IDENTIFY**

- **Direct**: Clear collaboration, joint funding, projects, or documented relationships
- **Indirect**: Both explicitly linked through intermediary B in documented shared outcome
- **Significant Mention**: Jointly discussed in risk-related context
- **No Evidence Found**: Thorough search yields no verifiable connections

**INTERMEDIARY REQUIREMENTS**
- Must be explicitly cited as facilitating the A-C connection
- General funding or membership is insufficient without specific A-C linkage
- Must have documented evidence of the specific intermediary role

**OUTPUT REQUIREMENTS**

Return ONLY a JSON array. Each risk entity must be a separate object:

\`\`\`json
[
  {
    "risk_item": "exact risk entity name from the input list",
    "institution_A": "exact institution name from input",
    "relationship_type": "Direct|Indirect|Significant Mention|Unknown|No Evidence Found",
    "finding_summary": "Comprehensive analysis organized by evidence types: (1) Personnel connections with names/roles/dates, (2) Joint projects with descriptions/dates, (3) Publications with titles/authors, (4) Events with dates/locations, (5) Funding details with amounts/sources, (6) Media reports with outlets/dates, (7) Organizational ties. Present chronologically. Classify each evidence piece as STRONG/MODERATE/WEAK.",
    "potential_intermediary_B": "intermediary name(s) or null"
  }
]
\`\`\`

**CRITICAL REQUIREMENTS:**

1. **Language Accuracy**: Search in both English and native languages
2. **Time Compliance**: Strictly adhere to specified time ranges
3. **Exact Match Priority**: Use exact institution names in quotation marks
4. **Evidence Classification**: Label evidence strength (STRONG/MODERATE/WEAK)
5. **Chronological Timeline**: Present findings in time order
6. **Source Quality**: Prioritize official and reputable sources

**QUALITY STANDARDS for Security Analysts:**
- Thorough search across multiple dimensions
- Provide specific evidence with dates, names, and sources
- If no evidence found: clearly state "No Evidence Found"
- Avoid speculation or assumptions
- Focus on documented, verifiable relationships
- Include both recent and historical connections`;
  }


  /**
   * Build optimized user prompt with enhanced clarity
   */
  private buildUserPrompt(request: NormalSearchRequest): string {
    const timeRangeText = request.Start_Date && request.End_Date
      ? `Time Range: STRICTLY ${request.Start_Date} to ${request.End_Date}. Only include information from within this exact period.`
      : 'Time Range: No specific time constraints - include recent and historical connections.';

    const languageInstruction = this.getLanguageSearchInstruction(request.Location);

    return `I need you to investigate potential connections between the following institution and risk items:

**Institution A:** ${request.Target_institution}
**Location:** ${request.Location}
**Risk List C:** ${request.Risk_Entity}
**${timeRangeText}**

**SEARCH INSTRUCTIONS:**
${languageInstruction}

**ANALYSIS REQUIREMENTS:**
For risk item in Risk List C, investigate:
1. Direct connections (cooperation, projects, formal relationships)
2. Indirect connections (through intermediaries with specific A-C linkage)
3. Significant mentions (joint discussion in risk contexts)
4. Evidence quality and source reliability

**OUTPUT FORMAT:**
Return a JSON array with one object per risk entity. Each object must contain:
- risk_item: exact name from input list
- institution_A: exact institution name
- relationship_type: "Direct", "Indirect", "Significant Mention", "Unknown", or "No Evidence Found"
- finding_summary: detailed evidence-based analysis
- potential_intermediary_B: intermediary name(s) or null

**CRITICAL:**
- Search in both English AND native languages
- Focus search queries on the exact institution name provided
- Prioritize official sources: .gov, .edu, established news organizations
- Provide specific evidence for all claims
- If no evidence found: state "No Evidence Found"
- Exclude speculation and general background`;
  }

  /**
   * Get language-specific search instructions
   */
  private getLanguageSearchInstruction(location: string): string {
    const locationLower = location.toLowerCase();

    // Map locations to their native languages
    const languageMap: { [key: string]: string[] } = {
      'china': ['Chinese (中文)'],
      'germany': ['German (Deutsch)'],
      'france': ['French (Français)'],
      'japan': ['Japanese (日本語)'],
      'south korea': ['Korean (한국어)'],
      'russia': ['Russian (Русский)'],
      'spain': ['Spanish (Español)'],
      'italy': ['Italian (Italiano)'],
      'brazil': ['Portuguese (Português)'],
      'india': ['Hindi (हिन्दी)'],
      'israel': ['Hebrew (עברית)'],
      'saudi arabia': ['Arabic (العربية)'],
      'egypt': ['Arabic (العربية)'],
      'mexico': ['Spanish (Español)'],
      'argentina': ['Spanish (Español)'],
      'netherlands': ['Dutch (Nederlands)'],
      'sweden': ['Swedish (Svenska)'],
      'norway': ['Norwegian (Norsk)'],
      'denmark': ['Danish (Dansk)'],
      'finland': ['Finnish (Suomi)'],
      'poland': ['Polish (Polski)'],
      'turkey': ['Turkish (Türkçe)'],
      'iran': ['Persian (فارسی)'],
      'pakistan': ['Urdu (اردو)'],
      'bangladesh': ['Bengali (বাংলা)'],
      'vietnam': ['Vietnamese (Tiếng Việt)'],
      'thailand': ['Thai (ไทย)'],
      'indonesia': ['Indonesian (Bahasa Indonesia)'],
      'malaysia': ['Malay (Bahasa Melayu)'],
      'philippines': ['Filipino (Filipino)']
    };

    // Check for exact matches first
    for (const [country, languages] of Object.entries(languageMap)) {
      if (locationLower === country) {
        return `Search in ENGLISH and ${languages.join(' and ')}. Use search terms in both languages for comprehensive coverage.`;
      }
    }

    // Check for partial matches
    for (const [country, languages] of Object.entries(languageMap)) {
      if (locationLower.includes(country)) {
        return `Search in ENGLISH and ${languages.join(' and ')}. Use search terms in both languages for comprehensive coverage.`;
      }
    }

    // Default for worldwide or unrecognized locations
    return locationLower.includes('worldwide') || locationLower.includes('global')
      ? 'Search in ENGLISH only.'
      : 'Search in ENGLISH and the local language of the region. Research the primary language(s) spoken in this location and include search terms in those languages.';
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
   * Clean JSON content from grounding support text
   */
  private cleanGroundingSupportText(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    // Check if text starts with JSON pattern
    const trimmedText = text.trim();

    // If it starts with "{" and contains "finding_summary", extract the finding_summary
    if (trimmedText.startsWith('{') && trimmedText.includes('"finding_summary"')) {
      try {
        // Try to parse as JSON
        const jsonData = JSON.parse(trimmedText);

        if (jsonData.finding_summary) {
          console.log('🧹 [CLEAN] Extracted finding_summary from JSON:', {
            originalLength: text.length,
            extractedLength: jsonData.finding_summary.length,
            preview: jsonData.finding_summary.substring(0, 100) + '...'
          });
          return jsonData.finding_summary;
        }
      } catch (error) {
        // If JSON parsing fails, check if it's a malformed JSON with finding_summary
        const findingSummaryMatch = trimmedText.match(/"finding_summary"\s*:\s*"([^"]+)"/);
        if (findingSummaryMatch && findingSummaryMatch[1]) {
          console.log('🧹 [CLEAN] Extracted finding_summary from malformed JSON:', {
            originalLength: text.length,
            extractedLength: findingSummaryMatch[1].length,
            preview: findingSummaryMatch[1].substring(0, 100) + '...'
          });
          return findingSummaryMatch[1];
        }

        console.warn('⚠️ [CLEAN] Failed to parse JSON, returning original text:', {
          textPreview: text.substring(0, 100) + '...',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return text;
  }

  /**
   * Clean only the first grounding support from JSON contamination
   * DISABLED: Temporarily disabled for performance testing
   */
  private cleanFirstGroundingSupport(groundingSupports: any[]): any[] {
    // DISABLED: Direct return without any JSON processing to test performance
    return groundingSupports;

    /*
    if (!groundingSupports || !Array.isArray(groundingSupports) || groundingSupports.length === 0) {
      return groundingSupports;
    }

    console.log('🧹 [CLEAN] Processing first grounding support for JSON cleanup:', {
      totalSupports: groundingSupports.length
    });

    // Only process the first support for JSON cleanup
    const firstSupport = groundingSupports[0];
    if (firstSupport?.segment?.text) {
      const originalText = firstSupport.segment.text;
      const cleanedText = this.cleanGroundingSupportText(originalText);

      const wasCleaned = originalText !== cleanedText;
      if (wasCleaned) {
        console.log('🧹 [CLEAN] Cleaned first support:', {
          originalLength: originalText.length,
          cleanedLength: cleanedText.length,
          lengthReduction: originalText.length - cleanedText.length,
          originalPreview: originalText.substring(0, 50) + '...',
          cleanedPreview: cleanedText.substring(0, 50) + '...'
        });

        // Return array with cleaned first support and unchanged others
        return [
          {
            ...firstSupport,
            segment: {
              ...firstSupport.segment,
              text: cleanedText
            }
          },
          ...groundingSupports.slice(1)
        ];
      }
    }

    // If no cleaning needed, return original array
    return groundingSupports;
    */
  }

  /**
   * Extract grounding metadata from Gemini response
   */
  private extractGroundingMetadata(response: any): GroundingMetadata {
    const candidate = response?.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;

    const rawSupports = groundingMetadata?.groundingSupports || [];
    const cleanedSupports = this.cleanFirstGroundingSupport(rawSupports);

    return {
      has_grounding: !!groundingMetadata,
      grounding_chunks: groundingMetadata?.groundingChunks || [],
      grounding_supports: cleanedSupports,
      web_search_queries: groundingMetadata?.webSearchQueries || []
    };
  }

  /**
   * Process grounding chunks into sources
   */
  private processGroundingChunks(groundingChunks: any[]): Array<{
    title: string;
    url: string;
    chunk_index: number;
  }> {
    return groundingChunks.map((chunk: any, index: number) => ({
      title: chunk.web?.title || 'Unknown Source',
      url: chunk.web?.uri || '',
      chunk_index: index
    }));
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
   * Optimized: Skip key_evidence and sources processing (frontend no longer uses these)
   */
  private buildEnhancedResponse(
    parsedFindings: any[],
    groundingMetadata: GroundingMetadata,
    searchQueries: string[],
    executionTimeMs: number
  ): EnhancedNormalSearchResult[] {
    // Build enhanced findings without redundant key_evidence and sources
    const enhancedFindings = parsedFindings.map((finding, findingIndex) => {
      return {
        ...finding,
        // Skip key_evidence processing - frontend uses inline citations instead
        key_evidence: [],
        // Skip sources processing - frontend uses grounding metadata instead
        sources: [],
        search_queries: searchQueries,
        quality_metrics: {
          evidence_count: 0,
          source_count: 0,
          coverage_percentage: 0
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
   * Apply formatting to finding summary for better frontend display
   */
  private formatFindingSummaryForDisplay(findingSummary: string): string {
    try {
      if (!findingSummary || typeof findingSummary !== 'string') {
        return findingSummary;
      }

      // Define patterns for the 7 standard categories (both standard and alternative formats)
      const categoryPatterns = [
        /\(\d+\) \*\*Personnel.*?\*\*:/g,
        /\(\d+\) \*\*Projects.*?\*\*:/g,
        /\(\d+\) \*\*Publications.*?\*\*:/g,
        /\(\d+\) \*\*Events.*?\*\*:/g,
        /\(\d+\) \*\*Funding.*?\*\*:/g,
        /\(\d+\) \*\*Media.*?\*\*:/g,
        /\(\d+\) \*\*Organizations.*?\*\*:/g,
        /\(\d+\) Personnel Connections:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
        /\(\d+\) Joint Projects & Organizational Ties:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
        /\(\d+\) Publications:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
        /\(\d+\) Events:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
        /\(\d+\) Funding:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
        /\(\d+\) Media & Significant Mentions:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
        /\(\d+\) Organizations:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g
      ];

      // Add line breaks before each category
      let formattedSummary = findingSummary;
      categoryPatterns.forEach(pattern => {
        formattedSummary = formattedSummary.replace(pattern, '\n\n$&');
      });

      return formattedSummary;

    } catch (error) {
      console.error('Error formatting finding summary:', error);
      return findingSummary;
    }
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

      let results: NormalSearchResult[];

      if (Array.isArray(parsed)) {
        results = parsed as NormalSearchResult[];
      } else if (typeof parsed === 'object' && parsed !== null) {
        results = [parsed] as NormalSearchResult[];
      } else {
        return null;
      }

      // Apply formatting to finding summaries for better display
      results.forEach(result => {
        if (result.finding_summary) {
          result.finding_summary = this.formatFindingSummaryForDisplay(result.finding_summary);
        }
      });

      return results;

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

      // Enhanced debugging for grounding metadata
      FeatureFlags.log('Grounding metadata analysis', 'debug', {
        hasGrounding: groundingMetadata.has_grounding,
        chunksCount: groundingMetadata.grounding_chunks.length,
        supportsCount: groundingMetadata.grounding_supports.length,
        searchQueriesCount: groundingMetadata.web_search_queries.length,
        chunksSample: groundingMetadata.grounding_chunks.slice(0, 2),
        supportsSample: groundingMetadata.grounding_supports.slice(0, 2)
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

      // Validate parsed findings
      const validationResult = this.validateParsedFindings(parsedFindings, request);
      FeatureFlags.log('Findings validation result', validationResult.isValid ? 'info' : 'warn', validationResult);

      if (!validationResult.isValid) {
        FeatureFlags.log('Invalid findings detected, attempting recovery', 'warn');
        // Try to recover or fix common issues
        const recoveredFindings = this.recoverFindings(parsedFindings, validationResult.errors);
        if (recoveredFindings.length > 0) {
          parsedFindings.length = 0;
          parsedFindings.push(...recoveredFindings);
          FeatureFlags.log('Successfully recovered findings', 'info', { recoveredCount: recoveredFindings.length });
        }
      }

      // Build enhanced response with grounding
      const enhancedResults = this.buildEnhancedResponse(
        parsedFindings,
        groundingMetadata,
        groundingMetadata.web_search_queries,
        executionTime
      );

      // Validate enhanced results
      const enhancedValidation = this.validateEnhancedResults(enhancedResults, groundingMetadata);
      FeatureFlags.log('Enhanced results validation', enhancedValidation.isValid ? 'info' : 'warn', enhancedValidation);

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
   * Execute search (main entry point) - uses enhanced grounding mode
   */
  async executeSearch(request: NormalSearchRequest): Promise<{
    results: NormalSearchResult[];
  }> {
    const enhancedResponse = await this.executeEnhancedNormalSearch(request);

    // Convert enhanced response format to include all grounding data
    return {
      results: enhancedResponse.results.map(result => ({
        risk_item: result.risk_item,
        institution_A: result.institution_A,
        relationship_type: result.relationship_type,
        finding_summary: result.finding_summary,
        potential_intermediary_B: result.potential_intermediary_B,
        sources: result.sources?.map(s => s.url) || [],
        // Include enhanced data
        key_evidence: result.key_evidence,
        enhanced_sources: result.sources,
        search_queries: result.search_queries,
        quality_metrics: result.quality_metrics,
        // Include grounding metadata for positional citations
        grounding_metadata: enhancedResponse.grounding_metadata
      }))
    };
  }

  
  /**
   * Extract ALL evidence for a specific finding from grounding supports
   * Following "complete trust in Gemini" strategy - preserve all original data
   */
  private findRelevantEvidenceForFinding(
    finding: any,
    groundingSupports: any[],
    chunkIndexToSourceIndex: Map<number, number>,
    sources: any[]
  ): Array<{ text: string; source_indices: number[] }> {
    const allEvidence: Array<{ text: string; source_indices: number[] }> = [];

    groundingSupports.forEach((support, supportIndex) => {
      if (!support.segment?.text || !support.groundingChunkIndices?.length) {
        return;
      }

      // NO FILTERING - preserve all groundingSupports as provided by Gemini
      const evidenceText = support.segment.text;

      // Convert chunk indices to source indices (1-based for frontend)
      const sourceIndices = support.groundingChunkIndices
        .map((chunkIndex: number) => chunkIndexToSourceIndex.get(chunkIndex))
        .filter((index: number | undefined) => index !== undefined)
        .map((index: number) => index + 1); // Convert to 1-based indexing

      if (sourceIndices.length > 0) {
        allEvidence.push({
          text: evidenceText,
          source_indices: sourceIndices
        });
      }
    });

    // NO SORTING, NO LIMITING - return all evidence in original order
    return allEvidence;
  }

  /**
   * Find sources that are relevant to a specific finding
   */
  private findRelevantSourcesForFinding(
    finding: any,
    findingEvidence: Array<{ text: string; source_indices: number[] }>,
    sources: any[]
  ): any[] {
    // Get unique source indices from evidence
    const relevantSourceIndices = new Set<number>();
    findingEvidence.forEach(evidence => {
      evidence.source_indices.forEach(index => {
        relevantSourceIndices.add(index - 1); // Convert back to 0-based for internal use
      });
    });

    // Return only sources that are referenced in evidence
    return sources.filter((source, index) =>
      relevantSourceIndices.has(index)
    );
  }

  
  /**
   * Calculate coverage percentage
   */
  private calculateCoveragePercentage(
    findingEvidence: Array<{ text: string; source_indices: number[] }>,
    groundingSupports: any[]
  ): number {
    if (groundingSupports.length === 0) return 0;

    const evidenceTexts = new Set(findingEvidence.map(e => e.text));
    const totalSupports = groundingSupports.length;

    return totalSupports > 0 ? (evidenceTexts.size / totalSupports) * 100 : 0;
  }

  
  /**
   * Validate parsed findings for common issues
   */
  private validateParsedFindings(findings: any[], request: NormalSearchRequest): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(findings)) {
      errors.push('Findings is not an array');
      return { isValid: false, errors, warnings };
    }

    findings.forEach((finding, index) => {
      // Check required fields
      if (!finding.risk_item || typeof finding.risk_item !== 'string') {
        errors.push(`Finding ${index}: Missing or invalid risk_item`);
      }

      if (!finding.institution_A || typeof finding.institution_A !== 'string') {
        errors.push(`Finding ${index}: Missing or invalid institution_A`);
      }

      if (!finding.relationship_type || typeof finding.relationship_type !== 'string') {
        errors.push(`Finding ${index}: Missing or invalid relationship_type`);
      } else {
        const validTypes = ['Direct', 'Indirect', 'Significant Mention', 'Unknown', 'No Evidence Found'];
        if (!validTypes.includes(finding.relationship_type)) {
          errors.push(`Finding ${index}: Invalid relationship_type: ${finding.relationship_type}`);
        }
      }

      if (!finding.finding_summary || typeof finding.finding_summary !== 'string') {
        errors.push(`Finding ${index}: Missing or invalid finding_summary`);
      }

      // Check for quality issues
      if (finding.finding_summary && finding.finding_summary.length < 50) {
        warnings.push(`Finding ${index}: Very short finding_summary (${finding.finding_summary.length} characters)`);
      }

      if (finding.finding_summary && finding.finding_summary.length > 2000) {
        warnings.push(`Finding ${index}: Very long finding_summary (${finding.finding_summary.length} characters)`);
      }

      // Check for placeholder text
      const placeholderPatterns = [
        /not specified/i,
        /no information/i,
        /unknown/i,
        /to be determined/i,
        /N\/A/i,
        /null/i
      ];

      placeholderPatterns.forEach(pattern => {
        if (finding.finding_summary && pattern.test(finding.finding_summary)) {
          warnings.push(`Finding ${index}: Contains placeholder text: ${pattern.source}`);
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Recover findings from common parsing issues
   */
  private recoverFindings(findings: any[], errors: string[]): any[] {
    const recovered: any[] = [];

    findings.forEach((finding, index) => {
      try {
        // Create a clean copy
        const cleanFinding = { ...finding };

        // Fix common issues
        if (!cleanFinding.risk_item && errors.some(e => e.includes(`Finding ${index}: Missing or invalid risk_item`))) {
          cleanFinding.risk_item = 'Unknown Risk Item';
        }

        if (!cleanFinding.institution_A && errors.some(e => e.includes(`Finding ${index}: Missing or invalid institution_A`))) {
          cleanFinding.institution_A = 'Unknown Institution';
        }

        if (!cleanFinding.relationship_type && errors.some(e => e.includes(`Finding ${index}: Missing or invalid relationship_type`))) {
          cleanFinding.relationship_type = 'Unknown';
        }

        if (!cleanFinding.finding_summary && errors.some(e => e.includes(`Finding ${index}: Missing or invalid finding_summary`))) {
          cleanFinding.finding_summary = 'No detailed analysis available due to parsing issues.';
        }

        // Fix relationship_type values
        const validTypes = ['Direct', 'Indirect', 'Significant Mention', 'Unknown', 'No Evidence Found'];
        if (!validTypes.includes(cleanFinding.relationship_type)) {
          cleanFinding.relationship_type = 'Unknown';
        }

        // Only add if it has minimal required fields
        if (cleanFinding.risk_item && cleanFinding.institution_A && cleanFinding.finding_summary) {
          recovered.push(cleanFinding);
        }
      } catch (error) {
        // Skip this finding if recovery fails
        console.warn(`Failed to recover finding ${index}:`, error);
      }
    });

    return recovered;
  }

  /**
   * Validate enhanced results for consistency and quality
   * Optimized: Simplified validation for streamlined data structure
   */
  private validateEnhancedResults(results: EnhancedNormalSearchResult[], groundingMetadata: GroundingMetadata): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    metrics: any;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let metrics: any = {};

    // Basic validation
    if (!Array.isArray(results) || results.length === 0) {
      errors.push('No enhanced results to validate');
      return { isValid: false, errors, warnings, metrics };
    }

    // Check grounding metadata availability (key for inline citations)
    const groundingChunksCount = groundingMetadata.grounding_chunks.length;
    const groundingSupportsCount = groundingMetadata.grounding_supports.length;

    // Validate finding summary content
    results.forEach((result, index) => {
      if (!result.finding_summary || result.finding_summary.trim().length === 0) {
        errors.push(`Result ${index}: Empty finding summary`);
      }

      // Check for valid relationship type
      if (!result.relationship_type || result.relationship_type.trim().length === 0) {
        warnings.push(`Result ${index}: Missing relationship type`);
      }
    });

    metrics = {
      totalResults: results.length,
      groundingChunksCount,
      groundingSupportsCount,
      evidenceCoverage: groundingSupportsCount > 0 && groundingChunksCount > 0 ?
        (groundingSupportsCount / groundingChunksCount) * 100 : 0
    };

    // Check grounding metadata quality
    if (groundingChunksCount === 0) {
      warnings.push('No grounding chunks available for citations');
    }

    if (groundingSupportsCount === 0) {
      warnings.push('No grounding supports available for citations');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics
    };
  }
}
