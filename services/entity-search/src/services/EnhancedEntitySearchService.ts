import axios from 'axios';

/**
 * Enhanced Entity Search Service
 * 专注于 Research Security Analyst 的垂直化需求
 *
 * 核心功能:
 * 1. 基础公司信息搜索(简化)
 * 2. 自动风险关键词关联分析(8个敏感关键词)
 */

// ==================== Configuration ====================

const RISK_KEYWORDS = [
  'military',
  'defense',
  'civil-military fusion',
  'human rights violations',
  'sanctions',
  'police technology',
  'weapons',
  'terrorist connections'
] as const;

type RiskKeyword = typeof RISK_KEYWORDS[number];
type RelationshipType = 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found';
type SeverityLevel = 'high' | 'medium' | 'low' | 'none';

// ==================== Type Definitions ====================

export interface EnhancedEntitySearchRequest {
  company_name: string;
  location?: string;
  include_risk_analysis?: boolean;  // 默认 true
  custom_risk_keywords?: string[];  // 可选: 用户自定义关键词
}

export interface BasicCompanyInfo {
  name: string;
  english_name?: string;
  headquarters?: string;
  sectors?: string[];
  description?: string;
  past_names?: string[];
}

export interface RiskAnalysisResult {
  risk_keyword: RiskKeyword | string;
  relationship_type: RelationshipType;
  finding_summary: string;
  potential_intermediary_B: string[];
  key_evidence: Array<{
    text: string;
    source_indices: number[];
  }>;
  sources: Array<{
    title: string;
    url: string;
    type: string;
  }>;
  search_queries: string[];
  severity: SeverityLevel;
  confidence_score?: number;
}

export interface RiskSummary {
  total_risks_found: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  overall_risk_level: SeverityLevel;
  flagged_keywords: string[];
  clean_keywords: string[];
}

export interface EnhancedEntitySearchResponse {
  success: boolean;
  company: string;
  location?: string;
  basic_info?: BasicCompanyInfo;
  risk_analysis?: RiskAnalysisResult[];
  risk_summary?: RiskSummary;
  metadata: {
    search_duration_ms: number;
    total_sources: number;
    search_queries_executed: number;
    api_calls_made: number;
  };
  error?: string;
}

// ==================== Enhanced Entity Search Service ====================

export class EnhancedEntitySearchService {
  private apiKey: string;
  private geminiApiUrl: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY not configured.');
      console.warn('   AI-enhanced search features will be disabled.');
      console.warn('   Basic search will still work through Linkup API.');
      console.warn('   To enable AI features, set GEMINI_API_KEY environment variable.');
    } else {
      console.log('✅ GEMINI_API_KEY configured - AI-enhanced search available');
    }
  }

  /**
   * Main entry point: Enhanced entity search
   */
  async searchEntity(request: EnhancedEntitySearchRequest): Promise<EnhancedEntitySearchResponse> {
    const startTime = Date.now();
    const includeRiskAnalysis = request.include_risk_analysis !== false;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Enhanced Entity Search: ${request.company_name}`);
    console.log(`📍 Location: ${request.location || 'Not specified'}`);
    console.log(`⚠️  Risk Analysis: ${includeRiskAnalysis ? 'Enabled' : 'Disabled'}`);
    console.log(`${'='.repeat(70)}\n`);

    try {
      let basicInfo: BasicCompanyInfo | undefined;
      let riskAnalysis: RiskAnalysisResult[] | undefined;
      let totalSources = 0;
      let totalSearchQueries = 0;
      let apiCallsCount = 0;

      // Layer 1: Basic company information (simplified)
      console.log('📋 Layer 1: Fetching basic company information...');
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

      // Layer 2: Risk keyword analysis (core value)
      if (includeRiskAnalysis) {
        console.log('⚠️  Layer 2: Risk keyword analysis (8 keywords)...\n');

        const riskKeywords = request.custom_risk_keywords || RISK_KEYWORDS;
        const riskResults = await this.analyzeRiskKeywords(
          request.company_name,
          request.location || 'Worldwide',
          riskKeywords
        );

        riskAnalysis = riskResults.results;
        totalSources += riskResults.totalSources;
        totalSearchQueries += riskResults.totalQueries;
        apiCallsCount += riskResults.apiCalls;

        console.log(`\n✅ Risk analysis completed (${riskResults.results.length} keywords analyzed)`);
      }

      // Generate risk summary
      const riskSummary = riskAnalysis
        ? this.generateRiskSummary(riskAnalysis)
        : undefined;

      const duration = Date.now() - startTime;

      console.log(`\n${'='.repeat(70)}`);
      console.log(`✅ Search completed in ${(duration / 1000).toFixed(2)}s`);
      console.log(`📊 Total sources: ${totalSources}`);
      console.log(`🔎 Total queries: ${totalSearchQueries}`);
      console.log(`📡 API calls: ${apiCallsCount}`);
      if (riskSummary) {
        console.log(`⚠️  Overall risk level: ${riskSummary.overall_risk_level.toUpperCase()}`);
        console.log(`🚩 Flagged keywords: ${riskSummary.flagged_keywords.length}`);
      }
      console.log(`${'='.repeat(70)}\n`);

      return {
        success: true,
        company: request.company_name,
        location: request.location,
        basic_info: basicInfo,
        risk_analysis: riskAnalysis,
        risk_summary: riskSummary,
        metadata: {
          search_duration_ms: duration,
          total_sources: totalSources,
          search_queries_executed: totalSearchQueries,
          api_calls_made: apiCallsCount
        }
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`❌ Enhanced search failed after ${duration}ms:`, error.message);

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
   * Layer 1: Get basic company information (simplified)
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
      const response = await this.callGeminiAPI(systemPrompt, userPrompt);

      const textContent = this.extractTextFromResponse(response);
      if (!textContent) {
        return { success: false, error: 'No text content in response' };
      }

      const parsed = this.parseJsonResponse(textContent);
      if (!parsed) {
        return { success: false, error: 'Failed to parse JSON response' };
      }

      // Extract grounding metadata
      const groundingMetadata = this.extractGroundingMetadata(response);
      const sources = this.processGroundingChunks(groundingMetadata.grounding_chunks);

      return {
        success: true,
        data: {
          ...parsed,
          sources,
          search_queries: groundingMetadata.web_search_queries
        }
      };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Layer 2: Analyze risk keywords in parallel
   */
  private async analyzeRiskKeywords(
    companyName: string,
    location: string,
    riskKeywords: readonly string[] | string[]
  ): Promise<{
    results: RiskAnalysisResult[];
    totalSources: number;
    totalQueries: number;
    apiCalls: number;
  }> {
    console.log(`   Analyzing ${riskKeywords.length} risk keywords in parallel...\n`);

    // Execute all risk keyword analyses in parallel
    const analysisPromises = riskKeywords.map((keyword, index) =>
      this.analyzeSingleRiskKeyword(companyName, keyword, location, index + 1)
    );

    const results = await Promise.all(analysisPromises);

    // Filter out failed results
    const successfulResults = results.filter(r => r !== null) as RiskAnalysisResult[];

    // Calculate totals
    const totalSources = successfulResults.reduce(
      (sum, r) => sum + r.sources.length,
      0
    );
    const totalQueries = successfulResults.reduce(
      (sum, r) => sum + r.search_queries.length,
      0
    );

    return {
      results: successfulResults,
      totalSources,
      totalQueries,
      apiCalls: riskKeywords.length
    };
  }

  /**
   * Analyze single risk keyword (based on entity-relations NormalSearch)
   */
  private async analyzeSingleRiskKeyword(
    companyName: string,
    riskKeyword: string,
    location: string,
    index: number
  ): Promise<RiskAnalysisResult | null> {
    console.log(`   [${index}] Analyzing: "${riskKeyword}"...`);

    const systemPrompt = this.buildRiskAnalysisSystemPrompt();
    const userPrompt = this.buildRiskAnalysisUserPrompt(companyName, riskKeyword, location);

    try {
      const response = await this.callGeminiAPI(systemPrompt, userPrompt);

      const textContent = this.extractTextFromResponse(response);
      if (!textContent) {
        console.log(`   [${index}] ⚠️  No text content for "${riskKeyword}"`);
        return null;
      }

      const parsed = this.parseJsonResponse(textContent);
      if (!parsed) {
        console.log(`   [${index}] ⚠️  Failed to parse response for "${riskKeyword}"`);
        return null;
      }

      // Extract grounding metadata
      const groundingMetadata = this.extractGroundingMetadata(response);
      const sources = this.processGroundingChunks(groundingMetadata.grounding_chunks);
      const keyEvidence = this.mapEvidenceToSources(groundingMetadata.grounding_supports);

      // Assess severity
      const severity = this.assessSeverity(
        parsed.relationship_type,
        parsed.finding_summary,
        sources.length
      );

      const result: RiskAnalysisResult = {
        risk_keyword: riskKeyword,
        relationship_type: parsed.relationship_type,
        finding_summary: parsed.finding_summary,
        potential_intermediary_B: Array.isArray(parsed.potential_intermediary_B)
          ? parsed.potential_intermediary_B
          : parsed.potential_intermediary_B
          ? [parsed.potential_intermediary_B]
          : [],
        key_evidence: keyEvidence,
        sources,
        search_queries: groundingMetadata.web_search_queries,
        severity
      };

      const emoji = severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : severity === 'low' ? '🟢' : '⚪';
      console.log(`   [${index}] ${emoji} "${riskKeyword}": ${parsed.relationship_type} (${severity})`);

      return result;

    } catch (error: any) {
      console.log(`   [${index}] ❌ Error analyzing "${riskKeyword}": ${error.message}`);
      return null;
    }
  }

  /**
   * Build system prompt for risk analysis (based on entity-relations, optimized)
   */
  private buildRiskAnalysisSystemPrompt(): string {
    return `## Role: Research Security Analyst

**You are deepdiver**, conducting OSINT research to identify potential security risks and connections.

---

### <Goal>

Investigate connections between a company/institution and a specific risk keyword (e.g., military, defense, sanctions).

---

### <Relationship Type Definition>

You MUST select EXACTLY ONE relationship type. **Do NOT use combinations like "Direct | Indirect".**

* **Direct**: Clear, documented collaboration, contracts, joint projects, or funding relationships
  - Example: "University signed a research contract with Department of Defense"
  - Example: "Company is a direct supplier to the military"

* **Indirect**: Connection exists through an explicitly named intermediary organization
  - Example: "University partners with X, which has defense contracts with Y"
  - **CRITICAL**: Intermediary B must be explicitly named and the connection must be documented

* **Significant Mention**: Joint discussion in a risk-related context without direct cooperation
  - Example: "University and military both mentioned in the same technology conference"
  - This is for CONTEXTUAL mentions only, not actual partnerships

* **Unknown**: Insufficient information to determine the relationship type

* **No Evidence Found**: No credible evidence of any connection found after thorough search

**CRITICAL RULE**: Select ONLY ONE type. If multiple types of connections exist, choose the STRONGEST one (Direct > Indirect > Significant Mention).

---

### <Information Gathering Strategy>

* Formulate search queries combining the institution name and location with the specific risk keyword
* Analyze results from authoritative sources:
  - **Prioritize**: .gov > .edu > official organization sites > reputable news
  - **Avoid**: Wikipedia, Reddit, unverified blogs (unless no other sources available)

* Focus on **specific, verifiable connections** directly related to the risk keyword
* **Avoid** irrelevant general information like rankings or institutional background unless it directly supports a finding

For **Potential Intermediary B**, ensure:
* It is explicitly cited as facilitating the connection between the institution and risk keyword
* Mere co-membership in alliances or general funding is **not sufficient** unless a specific project is described

---

### <Evidence Requirements>

Provide detailed analysis including:
* **Specific Details**: Names of people, organizations, or projects involved
* **Timeframes**: Dates or periods (e.g., "2018-2020", "Since 2015", "Ongoing")
* **Financial Details**: Contract values if available (e.g., "$5M contract")
* **Relevance**: Evidence must DIRECTLY relate to the risk keyword
  - Example BAD: "University has research programs" (too vague)
  - Example GOOD: "University signed 3-year defense research contract in 2020 with DoD"

---

### <Output Format>

Return a single JSON object:
\`\`\`json
{
  "risk_item": "the risk keyword",
  "institution_A": "company/institution name",
  "relationship_type": "ONE OF: Direct | Indirect | Significant Mention | Unknown | No Evidence Found",
  "finding_summary": "Detailed analysis with specific evidence, dates, names, and details",
  "potential_intermediary_B": ["Intermediary 1", "Intermediary 2"] or null
}
\`\`\`

**IMPORTANT**:
1. Use ONLY ONE relationship type (no combinations)
2. Do NOT include sources array - this will be handled automatically via grounding metadata
3. Ensure finding_summary is detailed with specific facts and evidence`;
  }

  /**
   * Build language instruction based on location
   */
  private buildLanguageInstruction(
    location: string,
    companyName: string,
    riskKeyword: string
  ): string {
    const locationLower = location.toLowerCase();

    // China - Chinese
    if (locationLower.includes('china') || locationLower.includes('中国')) {
      return `\n\n**IMPORTANT LANGUAGE INSTRUCTION:**
You MUST search in BOTH English AND Chinese (中文):
- English queries: "${companyName} ${riskKeyword}"
- Chinese queries: Use Chinese translations of company name and risk keyword
  Examples: "${companyName} 军事", "${companyName} 国防", "${companyName} 武器", etc.

Ensure you search Chinese government sites (.gov.cn), Chinese news sources, and Chinese academic sources (.edu.cn).`;
    }

    // Japan - Japanese
    if (locationLower.includes('japan') || locationLower.includes('日本')) {
      return `\n\n**IMPORTANT LANGUAGE INSTRUCTION:**
You MUST search in BOTH English AND Japanese (日本語):
- English queries: "${companyName} ${riskKeyword}"
- Japanese queries: Use Japanese translations of company name and risk keyword

Search Japanese government sites (.go.jp), Japanese news, and academic sources (.ac.jp).`;
    }

    // South Korea - Korean
    if (locationLower.includes('korea') || locationLower.includes('한국')) {
      return `\n\n**IMPORTANT LANGUAGE INSTRUCTION:**
You MUST search in BOTH English AND Korean (한국어):
- English queries: "${companyName} ${riskKeyword}"
- Korean queries: Use Korean translations of company name and risk keyword

Search Korean government sites (.go.kr), Korean news, and academic sources (.ac.kr).`;
    }

    // Germany - German
    if (locationLower.includes('germany') || locationLower.includes('deutschland')) {
      return `\n\n**IMPORTANT LANGUAGE INSTRUCTION:**
You MUST search in BOTH English AND German (Deutsch):
- English queries: "${companyName} ${riskKeyword}"
- German queries: Use German translations of company name and risk keyword`;
    }

    // France - French
    if (locationLower.includes('france') || locationLower.includes('français')) {
      return `\n\n**IMPORTANT LANGUAGE INSTRUCTION:**
You MUST search in BOTH English AND French (Français):
- English queries: "${companyName} ${riskKeyword}"
- French queries: Use French translations of company name and risk keyword`;
    }

    // Russia - Russian
    if (locationLower.includes('russia') || locationLower.includes('россия')) {
      return `\n\n**IMPORTANT LANGUAGE INSTRUCTION:**
You MUST search in BOTH English AND Russian (Русский):
- English queries: "${companyName} ${riskKeyword}"
- Russian queries: Use Russian translations of company name and risk keyword`;
    }

    // Arabic-speaking countries
    if (locationLower.includes('saudi') || locationLower.includes('uae') ||
        locationLower.includes('egypt') || locationLower.includes('arab')) {
      return `\n\n**IMPORTANT LANGUAGE INSTRUCTION:**
You MUST search in BOTH English AND Arabic (العربية):
- English queries: "${companyName} ${riskKeyword}"
- Arabic queries: Use Arabic translations of company name and risk keyword`;
    }

    // Spanish-speaking countries
    if (locationLower.includes('spain') || locationLower.includes('mexico') ||
        locationLower.includes('argentina') || locationLower.includes('colombia')) {
      return `\n\n**IMPORTANT LANGUAGE INSTRUCTION:**
You MUST search in BOTH English AND Spanish (Español):
- English queries: "${companyName} ${riskKeyword}"
- Spanish queries: Use Spanish translations of company name and risk keyword`;
    }

    // Default: English only
    return '';
  }

  /**
   * Build user prompt for risk analysis
   */
  private buildRiskAnalysisUserPrompt(
    companyName: string,
    riskKeyword: string,
    location: string
  ): string {
    const languageInstruction = this.buildLanguageInstruction(location, companyName, riskKeyword);

    return `Investigate potential connections between:

Company: ${companyName}
Location: ${location}
Risk Keyword: ${riskKeyword}

Analyze any direct or indirect connections, or significant mentions linking the company with this risk keyword.

Provide detailed analysis with specific evidence from authoritative sources.${languageInstruction}`;
  }

  /**
   * Assess severity level based on relationship type and evidence
   */
  private assessSeverity(
    relationshipType: RelationshipType,
    findingSummary: string,
    sourceCount: number
  ): SeverityLevel {
    if (relationshipType === 'No Evidence Found' || relationshipType === 'Unknown') {
      return 'none';
    }

    // Direct relationships are higher severity
    if (relationshipType === 'Direct') {
      // Check for high-risk indicators in summary
      const highRiskIndicators = [
        'weapon',
        'military contract',
        'defense contract',
        'sanctions violation',
        'human rights abuse',
        'terrorist'
      ];

      const hasHighRiskIndicator = highRiskIndicators.some(indicator =>
        findingSummary.toLowerCase().includes(indicator)
      );

      return hasHighRiskIndicator ? 'high' : 'medium';
    }

    // Indirect or Significant Mention
    if (sourceCount >= 3) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate risk summary from analysis results
   */
  private generateRiskSummary(riskAnalysis: RiskAnalysisResult[]): RiskSummary {
    const flaggedKeywords: string[] = [];
    const cleanKeywords: string[] = [];
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const result of riskAnalysis) {
      if (result.severity === 'high') {
        highCount++;
        flaggedKeywords.push(result.risk_keyword);
      } else if (result.severity === 'medium') {
        mediumCount++;
        flaggedKeywords.push(result.risk_keyword);
      } else if (result.severity === 'low') {
        lowCount++;
        flaggedKeywords.push(result.risk_keyword);
      } else {
        cleanKeywords.push(result.risk_keyword);
      }
    }

    // Determine overall risk level
    let overallRiskLevel: SeverityLevel;
    if (highCount > 0) {
      overallRiskLevel = 'high';
    } else if (mediumCount > 0) {
      overallRiskLevel = 'medium';
    } else if (lowCount > 0) {
      overallRiskLevel = 'low';
    } else {
      overallRiskLevel = 'none';
    }

    return {
      total_risks_found: highCount + mediumCount + lowCount,
      high_severity_count: highCount,
      medium_severity_count: mediumCount,
      low_severity_count: lowCount,
      overall_risk_level: overallRiskLevel,
      flagged_keywords: flaggedKeywords,
      clean_keywords: cleanKeywords
    };
  }

  // ==================== Gemini API Helper Methods ====================

  private async callGeminiAPI(systemPrompt: string, userPrompt: string): Promise<any> {
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

    return response.data;
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

  private mapEvidenceToSources(supports: any[]): Array<{
    text: string;
    source_indices: number[];
  }> {
    return supports.map((support: any) => ({
      text: support.segment?.text || '',
      source_indices: support.groundingChunkIndices || []
    }));
  }

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}
