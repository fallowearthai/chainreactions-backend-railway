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
      // Step 1: Verify Target Institution (with context about risk entities)
      console.log(`Verifying target institution: ${Target_institution}`);
      const targetInstitutionInfo = await this.performEntityVerification(
        Target_institution,
        Location,
        `Risk entities to investigate: ${Risk_Entity}`
      );
      entityVerificationResults.push({
        type: 'target_institution',
        ...targetInstitutionInfo
      });

      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Verify Risk Entities (with context about target institution)
      for (const riskEntity of riskEntities.slice(0, 2)) {
        console.log(`Verifying risk entity: ${riskEntity}`);
        const riskEntityInfo = await this.performEntityVerification(
          riskEntity,
          Location,
          Target_institution
        );
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

  private async performEntityVerification(
    entityName: string,
    location: string,
    targetInstitution?: string
  ): Promise<any> {
    try {
      console.log(`Verifying entity: ${entityName} in ${location}`);

      const entityInfo = await this.geminiService.verifyCompanyEntity(entityName, location, targetInstitution);

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

    try {
      console.log('Extracting keywords from entity verification results...');

      // Extract all keywords from entity verification results
      const allKeywords = this.extractKeywordsFromEntities(entityVerificationData);
      const combinedKeywords = this.combineKeywords(request, allKeywords);

      // Calculate confidence based on AI analysis and entity verification quality
      const confidence = this.calculateConfidence(entityVerificationData, allKeywords.relationship_likelihood);

      return {
        searchKeywords: combinedKeywords.searchKeywords,
        searchEngines: combinedKeywords.searchEngines,
        searchStrategy: {
          primaryTerms: combinedKeywords.primaryTerms,
          secondaryTerms: combinedKeywords.secondaryTerms,
          exclusionTerms: combinedKeywords.exclusionTerms,
          timeRange: this.formatTimeRange(request),
          languages: combinedKeywords.languages,
          regions: [this.getCountryCode(request.Location)]
        },
        confidence: confidence
      };

    } catch (error) {
      console.warn('Failed to extract keywords from entity verification data:', error);
      return this.generateFallbackStrategy(request);
    }
  }

  private extractKeywordsFromEntities(entityVerificationData: any[]): any {
    const extractedKeywords = {
      search_keywords: [] as string[],
      languages: [] as string[],
      source_engines: [] as string[],
      relationship_likelihood: 'low' as string
    };

    for (const entity of entityVerificationData) {
      const verificationResult = entity.verificationResult;

      if (verificationResult && !verificationResult.error) {
        // Extract from new JSON structure
        if (verificationResult.search_strategy) {
          const strategy = verificationResult.search_strategy;

          if (strategy.search_keywords) {
            extractedKeywords.search_keywords.push(...strategy.search_keywords);
          }
          if (strategy.languages) {
            extractedKeywords.languages.push(...strategy.languages);
          }
          if (strategy.source_engine) {
            extractedKeywords.source_engines.push(...strategy.source_engine);
          }
          if (strategy.relationship_likelihood) {
            // Use the highest likelihood found
            const currentLikelihood = extractedKeywords.relationship_likelihood;
            const newLikelihood = strategy.relationship_likelihood;

            if (newLikelihood === 'high' ||
                (newLikelihood === 'medium' && currentLikelihood === 'low')) {
              extractedKeywords.relationship_likelihood = newLikelihood;
            }
          }
        }
      }
    }

    return extractedKeywords;
  }

  private combineKeywords(request: SearchRequest, extractedKeywords: any): any {
    const { Target_institution, Risk_Entity } = request;
    const riskEntities = Risk_Entity.split(',').map(e => e.trim());

    // Use AI-generated keywords as primary source
    let searchKeywords = [...new Set(extractedKeywords.search_keywords || [])];

    // If no AI keywords available, generate fallback keywords
    if (searchKeywords.length === 0) {
      searchKeywords = [
        // Direct institution + risk entity combinations
        ...riskEntities.map(entity => `"${Target_institution}" "${entity}"`),
        ...riskEntities.map(entity => `"${Target_institution}" ${entity} partnership`),
        ...riskEntities.map(entity => `"${Target_institution}" ${entity} collaboration`),
        `${Target_institution} technology transfer`,
        `${Target_institution} research collaboration`
      ];
    }

    // Determine search engines based on AI recommendation or fallback
    const searchEngines = extractedKeywords.source_engines.length > 0
      ? this.mapToSupportedEngines(extractedKeywords.source_engines)
      : this.selectOptimalEngines(request.Location);

    // Get languages from AI or fallback
    const languages = extractedKeywords.languages.length > 0
      ? extractedKeywords.languages
      : this.getLanguagesForLocation(request.Location);

    return {
      searchKeywords: searchKeywords.slice(0, 15), // Limit to 15 keywords
      primaryTerms: searchKeywords.slice(0, 8),
      secondaryTerms: [], // Simplified structure
      exclusionTerms: ['job', 'career', 'hiring', 'recruitment', 'advertisement'],
      searchEngines: searchEngines,
      languages: languages,
      relationship_likelihood: extractedKeywords.relationship_likelihood
    };
  }

  private mapToSupportedEngines(aiEngines: string[]): string[] {
    const engineMap: { [key: string]: string } = {
      'google': 'google',
      'baidu': 'baidu',
      'yandex': 'yandex',
      'bing': 'bing',
      'duckduckgo': 'duckduckgo',
      'duoduogo': 'duckduckgo' // Map to supported engine
    };

    const mappedEngines = aiEngines
      .map(engine => engineMap[engine.toLowerCase()])
      .filter(engine => engine);

    // Ensure we have at least Google as fallback
    if (mappedEngines.length === 0) {
      return ['google', 'bing'];
    }

    return [...new Set(mappedEngines)];
  }

  private calculateConfidence(entityVerificationData: any[], relationshipLikelihood?: string): number {
    // Primary confidence based on relationship likelihood from AI analysis
    let baseConfidence = 0.3; // Default low confidence

    if (relationshipLikelihood) {
      switch (relationshipLikelihood.toLowerCase()) {
        case 'high':
          baseConfidence = 0.85;
          break;
        case 'medium':
          baseConfidence = 0.65;
          break;
        case 'low':
          baseConfidence = 0.35;
          break;
      }
    }

    // Adjust based on entity verification quality
    let validEntities = 0;
    let verificationBonus = 0;

    for (const entity of entityVerificationData) {
      const result = entity.verificationResult;
      if (result && !result.error) {
        validEntities++;
        // Bonus for having search strategy data
        if (result.search_strategy && result.search_strategy.search_keywords) {
          verificationBonus += 0.1;
        }
      }
    }

    // Apply verification bonus (max 0.2)
    const finalConfidence = Math.min(baseConfidence + Math.min(verificationBonus, 0.2), 0.95);

    return validEntities > 0 ? finalConfidence : 0.3;
  }

  private getLanguagesForLocation(location: string): string[] {
    const loc = location.toLowerCase();

    if (loc.includes('china') || loc.includes('中国')) return ['en', 'zh'];
    if (loc.includes('russia') || loc.includes('russian')) return ['en', 'ru'];
    if (loc.includes('japan')) return ['en', 'ja'];
    if (loc.includes('france')) return ['en', 'fr'];
    if (loc.includes('germany')) return ['en', 'de'];

    return ['en'];
  }


  private selectOptimalEngines(location: string): string[] {
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
      searchEngines: this.selectOptimalEngines(Location),
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