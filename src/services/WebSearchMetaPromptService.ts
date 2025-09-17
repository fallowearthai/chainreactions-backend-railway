import { GeminiService } from './GeminiService';
import { SearchRequest } from '../types/gemini';

export interface MetaPromptResult {
  searchKeywords: string[];
  searchEngines: string[];
  searchStrategy: {
    primaryTerms: string[];
    secondaryTerms: string[];
    exclusionTerms: string[];
    timeRange?: string;
    languages: string[];
    regions: string[];
  };
  confidence: number;
}

export class WebSearchMetaPromptService {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  async generateSearchStrategy(request: SearchRequest): Promise<MetaPromptResult> {
    try {
      // Step 1: Verify entities using GoogleSearch-powered entity verification
      const entityVerificationData = await this.gatherWebSearchIntelligence(request);

      // Step 2: Use AI to analyze verified entity data and generate search strategy
      const searchStrategy = await this.analyzeAndGenerateStrategy(request, entityVerificationData);

      return searchStrategy;
    } catch (error) {
      console.error('Meta prompt generation failed:', error);
      return this.generateFallbackStrategy(request);
    }
  }

  private async gatherWebSearchIntelligence(request: SearchRequest): Promise<any[]> {
    const { Target_institution, Risk_Entity, Location } = request;
    const riskEntities = Risk_Entity.split(',').map(e => e.trim());

    const entityVerificationResults: any[] = [];

    try {
      // Step 1: Verify Target Institution
      console.log(`Verifying target institution: ${Target_institution}`);
      const targetInstitutionInfo = await this.performEntityVerification(Target_institution, Location);
      entityVerificationResults.push({
        type: 'target_institution',
        ...targetInstitutionInfo
      });

      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Verify Risk Entities (limit to first 2 to manage API costs)
      for (const riskEntity of riskEntities.slice(0, 2)) {
        console.log(`Verifying risk entity: ${riskEntity}`);
        const riskEntityInfo = await this.performEntityVerification(riskEntity, Location);
        entityVerificationResults.push({
          type: 'risk_entity',
          ...riskEntityInfo
        });

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error('Entity verification process failed:', error);
    }

    return entityVerificationResults;
  }

  private async performEntityVerification(entityName: string, location: string): Promise<any> {
    try {
      console.log(`Verifying entity: ${entityName} in ${location}`);

      const entityInfo = await this.geminiService.verifyCompanyEntity(entityName, location);

      return {
        entityName,
        location,
        verificationResult: entityInfo,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.warn(`Entity verification failed for ${entityName}:`, error);
      return {
        entityName,
        location,
        verificationResult: { error: 'Verification failed', original_name: entityName },
        timestamp: new Date().toISOString()
      };
    }
  }

  private async analyzeAndGenerateStrategy(
    request: SearchRequest,
    entityVerificationData: any[]
  ): Promise<MetaPromptResult> {

    const prompt = this.buildAnalysisPrompt(request, entityVerificationData);

    try {
      const response = await this.geminiService.generateContent(
        [{
          parts: [{ text: prompt }]
        }],
        undefined, // no system instruction
        undefined, // no tools
        {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      );

      const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!resultText) {
        throw new Error('No response text from Gemini API');
      }

      const result = JSON.parse(resultText);

      return {
        searchKeywords: result.searchKeywords || [],
        searchEngines: this.selectOptimalEngines(request.Location, result),
        searchStrategy: {
          primaryTerms: result.searchStrategy?.primaryTerms || [],
          secondaryTerms: result.searchStrategy?.secondaryTerms || [],
          exclusionTerms: result.searchStrategy?.exclusionTerms || [],
          timeRange: this.formatTimeRange(request),
          languages: result.searchStrategy?.languages || ['en'],
          regions: result.searchStrategy?.regions || []
        },
        confidence: result.confidence || 0.5
      };

    } catch (error) {
      console.warn('Failed to analyze WebSearch data with AI:', error);
      return this.generateFallbackStrategy(request);
    }
  }

  private buildAnalysisPrompt(request: SearchRequest, entityVerificationData: any[]): string {
    const { Target_institution, Risk_Entity, Location, Start_Date, End_Date } = request;

    const entitySummary = entityVerificationData.map(entity => {
      const result = entity.verificationResult;
      return `Entity Type: ${entity.type}
Entity Name: ${entity.entityName}
Verification Result:
- Original Name: ${result.original_name || 'N/A'}
- English Name: ${result.english_name || 'N/A'}
- Description: ${result.description || 'N/A'}
- Headquarters: ${result.headquarters || 'N/A'}
- Sectors: ${result.sectors ? result.sectors.join(', ') : 'N/A'}
- Similar Name Companies Exist: ${result.similar_name_companies_exist || false}
- Past Names: ${result.past_names ? result.past_names.join(', ') : 'N/A'}`;
    }).join('\n\n');

    return `You are an expert OSINT analyst. Based on the following verified entity information, generate optimized search keywords and strategy for SERP API execution to find relationships between these entities.

INVESTIGATION TARGET:
- Institution: ${Target_institution}
- Risk Entities: ${Risk_Entity}
- Location: ${Location}
- Time Range: ${Start_Date || 'N/A'} to ${End_Date || 'N/A'}

VERIFIED ENTITY INFORMATION:
${entitySummary}

TASK: Generate a comprehensive search strategy for SERP API execution that will find documented relationships, partnerships, or significant connections between the target institution and risk entities.

Return JSON with this exact structure:
{
  "searchKeywords": [
    "Precise keyword combinations optimized for SERP APIs",
    "Include entity names, product names, and relationship terms",
    "Consider both English and local language terms",
    "Maximum 15 keywords"
  ],
  "searchStrategy": {
    "primaryTerms": ["Most important search terms based on web intelligence"],
    "secondaryTerms": ["Alternative search approaches"],
    "exclusionTerms": ["Terms to exclude to avoid noise"],
    "languages": ["en", "zh", "etc - based on location"],
    "regions": ["Country codes for geo-targeting"]
  },
  "entityInsights": {
    "institutionType": "university|corporation|government|ngo|other",
    "riskCategory": "military|technology|academic|financial|other",
    "keyProducts": ["Products/services discovered from web search"],
    "keyPersonnel": ["Important people mentioned"],
    "subsidiaries": ["Related entities found"]
  },
  "confidence": 0.8
}

Focus on:
1. Use verified official entity names and past names from the verification results
2. Incorporate specific sectors, products, and business descriptions from verified data
3. Consider headquarters locations and regional presence from verified information
4. Generate search terms that combine entity names with their specific business activities
5. Use both English and local language terms based on the geographic location
6. Account for potential name variations and similar companies if they exist

Generate search terms that are:
- Specific enough to find real documented relationships
- Based on verified entity information rather than assumptions
- Comprehensive enough to capture direct partnerships, indirect connections, and significant mentions
- Optimized for the business sectors and geographic regions involved`;
  }

  private selectOptimalEngines(location: string, analysisResult: any): string[] {
    const loc = location.toLowerCase();

    // Start with default engines
    let engines = ['google', 'bing'];

    // Add region-specific engines based on location
    if (loc.includes('china') || loc.includes('中国')) {
      engines.push('baidu');
    }

    if (loc.includes('russia') || loc.includes('russian')) {
      engines.push('yandex');
    }

    // Always include DuckDuckGo for additional coverage
    engines.push('duckduckgo');

    return engines;
  }

  private formatTimeRange(request: SearchRequest): string | undefined {
    if (request.Start_Date && request.End_Date) {
      return `${request.Start_Date} to ${request.End_Date}`;
    }
    return undefined;
  }

  private generateFallbackStrategy(request: SearchRequest): MetaPromptResult {
    const { Target_institution, Risk_Entity, Location } = request;
    const riskEntities = Risk_Entity.split(',').map(e => e.trim());

    return {
      searchKeywords: [
        `"${Target_institution}" cooperation partnership`,
        `"${Target_institution}" collaboration joint`,
        ...riskEntities.map(entity => `"${Target_institution}" "${entity}"`),
        ...riskEntities.map(entity => `"${entity}" partnership ${Location}`),
        `${Target_institution} technology transfer`,
        `${Target_institution} research collaboration`
      ],
      searchEngines: this.selectOptimalEngines(Location, {}),
      searchStrategy: {
        primaryTerms: [
          `"${Target_institution}"`,
          ...riskEntities.map(entity => `"${entity}"`)
        ],
        secondaryTerms: [
          'cooperation', 'partnership', 'collaboration',
          'joint venture', 'agreement', 'contract'
        ],
        exclusionTerms: ['job', 'career', 'hiring', 'advertisement'],
        timeRange: this.formatTimeRange(request),
        languages: ['en'],
        regions: [this.getCountryCode(Location)]
      },
      confidence: 0.3 // Low confidence since this is fallback
    };
  }

  private getCountryCode(location: string): string {
    const loc = location.toLowerCase();

    if (loc.includes('china')) return 'cn';
    if (loc.includes('russia')) return 'ru';
    if (loc.includes('japan')) return 'jp';
    if (loc.includes('germany')) return 'de';
    if (loc.includes('uk') || loc.includes('britain')) return 'gb';
    if (loc.includes('france')) return 'fr';

    return 'us'; // Default
  }
}