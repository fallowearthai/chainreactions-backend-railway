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
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
  }

  /**
   * Build optimized system instruction prompt for enhanced grounding
   */
  private buildOptimizedSystemInstruction(): string {
    return `**ROLE**
You are an expert OSINT analyst specializing in institutional risk assessment and relationship mapping.

**MISSION**
Using web search capabilities, investigate potential connections (e.g., documented cooperation, funding, joint projects, shared personnel, significant mentions linking them between Institution A and Risk List C. Focus on verifiable, evidence-based connections within the specified time range.

**SEARCH STRATEGY**

1. **Multi-language Search Requirements:**
   - Search in BOTH English AND the native language of the location
   - Example: For China, search using English terms AND Chinese terms
   - Example: For Germany, search using English terms AND German terms
   - Example: For worldwide locations, search using English terms

2. **Time Range Compliance:**
   - When dates are provided, use Google's before: and after: filters
   - ONLY include information from within the exact specified time period
   - Events outside the range must be completely excluded

3. **Evidence Quality Standards:**
   - Require specific, verifiable connections with clear attribution
   - Prioritize official sources: .gov, .edu, established news organizations
   - Avoid general background information unless directly relevant

4.**Exact Match Search Protocol:**
     - ALWAYS use the exact input text as primary search target
     - Use quotation marks around complete institution names in search queries

**CONNECTION TYPES TO IDENTIFY**

- **Direct**: Clear collaboration, joint funding, projects, or documented relationships.
- **Indirect**: A and C are both explicitly linked through intermediary B in a documented shared outcome.
- **Significant Mention**: A and C are jointly discussed in a risk-related context, even without direct cooperation.
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
    "finding_summary": "comprehensive analysis with specific evidence",
    "potential_intermediary_B": "intermediary name(s) or null"
  }
]
\`\`\`

**CRITICAL REQUIREMENTS:**

1. **Language Accuracy**: Search in both English and native languages
2. **Time Compliance**: Strictly adhere to specified time ranges
3. Search queries must prioritize exact matches to input text
4. Preserve the scope and specificity of the original input

**QUALITY STANDARDS:**
- If connection claimed: provide specific evidence
- If no evidence found: clearly state "No Evidence Found"
- Avoid speculation or assumptions
- Exclude irrelevant institutional background
- Focus on documented relationships and verifiable facts`;
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
   */
  private buildEnhancedResponse(
    parsedFindings: any[],
    groundingMetadata: GroundingMetadata,
    searchQueries: string[],
    executionTimeMs: number
  ): EnhancedNormalSearchResult[] {
    // Process grounding chunks - trust Gemini's quality judgment
    const sources = this.processGroundingChunks(groundingMetadata.grounding_chunks);

    // Create chunk index to source index mapping
    const chunkIndexToSourceIndex = new Map<number, number>();
    sources.forEach((source, index) => {
      chunkIndexToSourceIndex.set(source.chunk_index, index);
    });

    // Build enhanced findings with improved evidence mapping
    const enhancedFindings = parsedFindings.map((finding, findingIndex) => {
      // Find evidence supports that match this finding's content
      const findingEvidence = this.findRelevantEvidenceForFinding(
        finding,
        groundingMetadata.grounding_supports,
        chunkIndexToSourceIndex,
        sources
      );

      // Filter sources to only include those relevant to this finding
      const relevantSources = this.findRelevantSourcesForFinding(finding, findingEvidence, sources);

      return {
        ...finding,
        key_evidence: findingEvidence,
        sources: relevantSources,
        search_queries: searchQueries,
        quality_metrics: {
          evidence_count: findingEvidence.length,
          source_count: relevantSources.length,
          coverage_percentage: this.calculateCoveragePercentage(findingEvidence, groundingMetadata.grounding_supports)
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
        quality_metrics: result.quality_metrics
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

    // Check evidence-source consistency
    let totalEvidence = 0;
    let evidenceWithValidSources = 0;
    let totalSources = 0;

    results.forEach((result, index) => {
      if (result.key_evidence) {
        totalEvidence += result.key_evidence.length;
        result.key_evidence.forEach(evidence => {
          if (evidence.source_indices && evidence.source_indices.length > 0) {
            evidenceWithValidSources++;
          }
        });
      }

      if (result.sources) {
        totalSources += result.sources.length;
      }

      // Check quality metrics
      if (result.quality_metrics) {
        if (result.quality_metrics.evidence_count === 0 && result.relationship_type !== 'No Evidence Found') {
          warnings.push(`Result ${index}: No evidence despite claiming relationship type: ${result.relationship_type}`);
        }
      }
    });

    metrics = {
      totalResults: results.length,
      totalEvidence,
      evidenceWithValidSources,
      totalSources,
      evidenceCoverage: totalEvidence > 0 ? (evidenceWithValidSources / totalEvidence) * 100 : 0,
      avgSourcesPerResult: results.length > 0 ? totalSources / results.length : 0
    };

    // Check for inconsistencies
    if (metrics.evidenceCoverage < 50) {
      warnings.push(`Low evidence coverage: ${metrics.evidenceCoverage.toFixed(1)}%`);
    }

    if (metrics.avgSourcesPerResult < 1) {
      warnings.push(`Low average sources per result: ${metrics.avgSourcesPerResult.toFixed(1)}`);
    }

    // Check grounding metadata consistency
    const groundingSourcesCount = groundingMetadata.grounding_chunks.length;
    const totalEnhancedSources = results.reduce((sum, r) => sum + (r.sources?.length || 0), 0);

    if (groundingSourcesCount > 0 && totalEnhancedSources === 0) {
      warnings.push('Grounding metadata available but no enhanced sources in results');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics
    };
  }
}
