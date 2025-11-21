import axios from 'axios';
import {
  RiskKeywordAnalysisRequest,
  RiskAnalysisResult,
  RiskAnalysisResponse
} from '../types/risk-types';

/**
 * Risk Keyword Analysis Service
 * Analyzes relationships between companies and specific risk keywords using Gemini AI
 * Based on the enhanced GeminiNormalSearchService architecture
 */
export class RiskKeywordAnalysisService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in RiskKeywordAnalysisService');
    }
  }

  /**
   * Build system instruction for risk keyword analysis
   * Based on the enhanced OSINT prompt but specialized for risk assessment
   */
  private buildRiskAnalysisSystemInstruction(): string {
    return `**ROLE**
You are an expert risk assessment analyst specializing in corporate risk analysis and due diligence investigations.

**MISSION**
Using web search capabilities, investigate potential connections between Company A and specific Risk Keyword C. Focus on verifiable, evidence-based relationships that indicate risk exposure or involvement.

**SEARCH STRATEGY**

1. **Multi-language Search Requirements:**
   - Search in BOTH English AND the native language of the location
   - Example: For China, search using English terms AND Chinese terms
   - Example: For Germany, search using English terms AND German terms
   - Example: For worldwide locations, search using English terms

2. **Evidence Quality Standards:**
   - Require specific, verifiable connections with clear attribution
   - Prioritize official sources: .gov, .edu, established news organizations
   - Avoid general background information unless directly relevant

3. **Exact Match Search Protocol:**
   - ALWAYS use the exact company name as primary search target
   - Use quotation marks around complete company names in search queries
   - Combine with risk keyword for targeted investigation

**CONNECTION TYPES TO IDENTIFY**

- **Direct**: Clear direct involvement, partnerships, contracts, or documented relationships with the risk keyword domain
- **Indirect**: Connection through intermediaries (suppliers, partners, subsidiaries) with documented risk keyword involvement
- **Significant Mention**: Company is significantly discussed in risk-related contexts, even without direct involvement
- **No Evidence Found**: Thorough search yields no verifiable connections to the risk keyword

**RISK SEVERITY ASSESSMENT**

For each connection found, assess:
- **High**: Direct involvement in illegal/unethical activities, sanctions, or severe regulatory violations
- **Medium**: Indirect connections through partners, regulatory concerns, controversial contracts
- **Low**: Minor mentions, peripheral connections, historical involvement
- **None**: No evidence or only tangential mentions

**OUTPUT REQUIREMENTS**

Return ONLY a JSON object with the following structure:

\`\`\`json
{
  "risk_keyword": "exact risk keyword from input",
  "company": "exact company name from input",
  "relationship_type": "Direct|Indirect|Significant Mention|Unknown|No Evidence Found",
  "finding_summary": "comprehensive analysis with specific evidence and risk context",
  "potential_intermediary_B": ["intermediary names or null"],
  "severity_assessment": {
    "severity": "high|medium|low|none",
    "confidence": 0.0-1.0,
    "key_factors": ["factor1", "factor2"]
  }
}
\`\`\`

**CRITICAL REQUIREMENTS:**

1. **Language Accuracy**: Search in both English and native languages
2. **Evidence Quality**: Provide specific evidence for all claims
3. **Risk Context**: Focus on risk-related implications
4. **Source Attribution**: Reference specific sources for claims
5. **Professional Tone**: Objective, evidence-based analysis

**QUALITY STANDARDS:**
- If connection claimed: provide specific evidence and risk context
- If no evidence found: clearly state "No Evidence Found"
- Avoid speculation or assumptions
- Focus on documented relationships and verifiable facts
- Provide clear risk assessment based on evidence quality and type`;
  }

  /**
   * Build user prompt for risk keyword analysis
   */
  private buildRiskAnalysisUserPrompt(request: RiskKeywordAnalysisRequest): string {
    const locationText = request.location
      ? `**Location:** ${request.location}`
      : '**Location:** Not specified';

    return `I need you to investigate potential connections between the following company and risk keyword:

**Company A:** ${request.company}
**Risk Keyword C:** ${request.keyword}
**${locationText}**

**SEARCH INSTRUCTIONS:**

1. **Investigate Direct Connections:**
   - Company's direct involvement in activities related to the risk keyword
   - Partnerships, contracts, or collaborations with risk-related entities
   - Official statements, press releases, or announcements

2. **Investigate Indirect Connections:**
   - Relationships through subsidiaries, suppliers, or partners
   - Supply chain connections to risk-related activities
   - Investments or funding in risk-related domains

3. **Investigate Significant Mentions:**
   - Company discussed in risk-related contexts
   - Regulatory filings or legal proceedings
   - Media coverage linking company to risk keyword

4. **Evidence Quality Assessment:**
   - Prioritize official sources: government documents, regulatory filings
   - Established news organizations with editorial standards
   - Academic or research institution reports
   - Company official communications

**ANALYSIS REQUIREMENTS:**

For each potential connection found:
- Assess the strength and nature of the relationship
- Evaluate the credibility and reliability of sources
- Determine the risk level based on evidence quality
- Provide specific, verifiable examples
- Include relevant context for risk assessment

**RISK ASSESSMENT FOCUS:**

- **Regulatory Risk**: Potential violations, sanctions, compliance issues
- **Reputational Risk**: Public perception, brand impact, stakeholder concerns
- **Operational Risk**: Business continuity, supply chain implications
- **Financial Risk**: Potential fines, penalties, market impact

**OUTPUT REQUIREMENTS:**

Provide a comprehensive analysis in the specified JSON format, focusing on evidence-based risk assessment with clear source attribution.`;
  }

  /**
   * Get language-specific search instructions (reuse from enhanced service)
   */
  private getLanguageSearchInstruction(location?: string): string {
    if (!location) {
      return 'Search in ENGLISH only.';
    }

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
   * Build Gemini API request body
   */
  private buildRiskAnalysisRequestBody(request: RiskKeywordAnalysisRequest): any {
    return {
      system_instruction: {
        parts: [
          {
            text: this.buildRiskAnalysisSystemInstruction()
          }
        ]
      },
      contents: [
        {
          parts: [
            {
              text: this.buildRiskAnalysisUserPrompt(request)
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
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
  }

  /**
   * Extract grounding metadata from Gemini response
   */
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

  /**
   * Process grounding chunks into sources
   */
  private processGroundingChunks(groundingChunks: any[]): Array<{
    title: string;
    url: string;
    type: string;
  }> {
    return groundingChunks.map((chunk: any) => ({
      title: chunk.web?.title || 'Unknown Source',
      url: chunk.web?.uri || '',
      type: this.getSourceType(chunk.web?.uri || '')
    }));
  }

  /**
   * Determine source type based on URL
   */
  private getSourceType(url: string): string {
    if (!url) return 'unknown';

    const domain = new URL(url).hostname.toLowerCase();

    if (domain.includes('.gov')) return 'government';
    if (domain.includes('.edu')) return 'academic';
    if (domain.includes('.org')) return 'organization';
    if (this.isNewsDomain(domain)) return 'news';
    if (domain.includes('wikipedia')) return 'reference';

    return 'website';
  }

  /**
   * Check if domain is a news organization
   */
  private isNewsDomain(domain: string): boolean {
    const newsDomains = [
      'reuters', 'bloomberg', 'bbc', 'cnn', 'wsj', 'ft.com',
      'ap.org', 'npr.org', 'nbcnews.com', 'cbsnews.com',
      'abcnews.go.com', 'foxnews.com', 'theguardian.com',
      'washingtonpost.com', 'nytimes.com', 'latimes.com'
    ];

    return newsDomains.some(newsDomain => domain.includes(newsDomain));
  }

  /**
   * Extract text content from Gemini response
   */
  private extractTextFromResponse(response: any): string | null {
    try {
      const candidates = response?.candidates;
      if (candidates && Array.isArray(candidates) && candidates.length > 0) {
        const content = candidates[0]?.content;
        if (content && content.parts && Array.isArray(content.parts)) {
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
   * Extract JSON from response text
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

    // Try to find direct JSON object
    const directJsonMatch = text.match(/(\{[\s\S]*\})/);
    if (directJsonMatch && directJsonMatch[1]) {
      return directJsonMatch[1].trim();
    }

    return null;
  }

  /**
   * Parse JSON response with error handling
   */
  private parseRiskAnalysisResponse(textContent: string): any {
    try {
      const jsonContent = this.extractJsonFromText(textContent);
      if (!jsonContent) {
        throw new Error('No JSON content found in risk analysis response');
      }

      return JSON.parse(jsonContent);
    } catch (error) {
      console.error('Risk analysis JSON parsing error:', error);
      console.error('Text content:', textContent.substring(0, 500));
      throw new Error(`Failed to parse risk analysis response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map evidence to sources using grounding supports
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
        // Convert from 0-based to 1-based indexing
        source_indices: support.groundingChunkIndices.map((index: number) => index + 1)
      }));
  }

  /**
   * Calculate severity based on relationship type and evidence quality
   */
  private calculateSeverity(
    relationshipType: string,
    evidenceCount: number,
    sourceQuality: number
  ): 'high' | 'medium' | 'low' | 'none' {
    if (relationshipType === 'No Evidence Found') {
      return 'none';
    }

    if (relationshipType === 'Direct') {
      return evidenceCount > 2 && sourceQuality > 0.7 ? 'high' : 'medium';
    }

    if (relationshipType === 'Indirect') {
      return evidenceCount > 1 && sourceQuality > 0.5 ? 'medium' : 'low';
    }

    if (relationshipType === 'Significant Mention') {
      return evidenceCount > 0 ? 'low' : 'none';
    }

    return 'low';
  }

  /**
   * Calculate confidence score based on evidence quality
   */
  private calculateConfidenceScore(
    evidenceCount: number,
    sourceCount: number,
    authoritativeSources: number
  ): number {
    if (evidenceCount === 0) return 0.0;

    let confidence = 0.3; // Base confidence

    // More evidence increases confidence
    confidence += Math.min(evidenceCount * 0.1, 0.3);

    // More sources increases confidence
    confidence += Math.min(sourceCount * 0.05, 0.2);

    // Authoritative sources significantly increase confidence
    confidence += Math.min(authoritativeSources * 0.15, 0.2);

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate finding summary with citations
   */
  private generateFindingSummaryWithCitations(
    findingSummary: string,
    _keyEvidence: any[],
    _sources: any[]
  ): string {
    if (!findingSummary || findingSummary === 'No analysis available') {
      return 'No analysis available';
    }

    // For now, return the original finding summary
    // This can be enhanced later to include proper citation formatting
    return findingSummary;
  }

  /**
   * Convert risk analysis result to frontend format
   */
  private convertToFrontendFormat(
    analysis: any,
    groundingMetadata: any,
    sources: any[],
    searchQueries: string[]
  ): RiskAnalysisResult {
    const evidenceCount = groundingMetadata.grounding_supports.length;
    const sourceCount = sources.length;
    const authoritativeSources = sources.filter(s =>
      s.type === 'government' || s.type === 'academic'
    ).length;

    const severity = this.calculateSeverity(
      analysis.relationship_type,
      evidenceCount,
      authoritativeSources / sourceCount
    );

    const confidenceScore = this.calculateConfidenceScore(
      evidenceCount,
      sourceCount,
      authoritativeSources
    );

    // Map evidence to sources
    const relevantChunkIndices = new Set<number>();
    groundingMetadata.grounding_chunks.forEach((_: any, index: number) => {
      relevantChunkIndices.add(index);
    });

    const keyEvidence = this.mapEvidenceToSources(
      groundingMetadata.grounding_supports,
      relevantChunkIndices
    );

    return {
      risk_keyword: analysis.risk_keyword || 'unknown',
      relationship_type: analysis.relationship_type || 'Unknown',
      finding_summary: analysis.finding_summary || 'No analysis available',
      finding_summary_with_citations: this.generateFindingSummaryWithCitations(
        analysis.finding_summary,
        keyEvidence,
        sources
      ),
      potential_intermediary_B: Array.isArray(analysis.potential_intermediary_B)
        ? analysis.potential_intermediary_B
        : [],
      key_evidence: keyEvidence,
      sources: sources,
      citations: [], // Empty array for now, can be enhanced later
      search_queries: searchQueries,
      severity,
      confidence_score: confidenceScore
    };
  }

  /**
   * Main method to analyze risk keyword for a company
   */
  async analyzeRiskKeyword(request: RiskKeywordAnalysisRequest): Promise<RiskAnalysisResponse> {
    const startTime = Date.now();

    try {
      console.log(`Starting risk analysis for ${request.company} - ${request.keyword}`);

      const requestBody = this.buildRiskAnalysisRequestBody(request);

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

      console.log(`Extracted risk analysis content (${textContent.length} chars)`);

      // Extract grounding metadata
      const groundingMetadata = this.extractGroundingMetadata(response.data);

      // Process sources
      const sources = this.processGroundingChunks(groundingMetadata.grounding_chunks);

      // Parse risk analysis result
      const analysis = this.parseRiskAnalysisResponse(textContent);

      // Convert to frontend format
      const result = this.convertToFrontendFormat(
        analysis,
        groundingMetadata,
        sources,
        groundingMetadata.web_search_queries
      );

      console.log(`Risk analysis completed for ${request.company} - ${request.keyword}`);

      return {
        success: true,
        data: result,
        metadata: {
          analysis_duration_ms: executionTime,
          api_calls_made: 1,
          sources_considered: sources.length,
          search_queries_used: groundingMetadata.web_search_queries
        }
      };

    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;
      console.error(`Risk analysis failed for ${request.company} - ${request.keyword} after ${executionTime}ms:`, error);

      if (axios.isAxiosError(error)) {
        console.error('Gemini API Error:', {
          status: error.response?.status,
          data: error.response?.data
        });
        throw new Error(`Gemini API request failed: ${error.message}`);
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Unknown error occurred during risk analysis');
    }
  }
}