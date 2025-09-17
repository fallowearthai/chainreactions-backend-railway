import { GeminiService } from './GeminiService';
import { SearchRequest } from '../types/gemini';

export interface MetaPromptResult {
  entity_a: {
    original_name: string;
    description: string;
    sectors: string[];
  };
  entity_b: {
    original_name: string;
    description: string;
    sectors: string[];
  };
  search_strategy: {
    search_keywords: string[];
    languages: string[];
    country_code: string;
    source_engine: string[];
    search_operators: string[];
    relationship_likelihood: string;
  };
}

export class WebSearchMetaPromptService {
  private geminiService: GeminiService;

  constructor() {
    this.geminiService = new GeminiService();
  }

  async generateSearchStrategy(request: SearchRequest): Promise<MetaPromptResult> {
    const startTime = Date.now();
    try {
      const { Target_institution, Risk_Entity, Location } = request;

      console.log(`🎯 Stage 1 Starting: ${Target_institution} vs ${Risk_Entity} in ${Location}`);
      console.log(`📋 Request details:`, {
        Target_institution,
        Risk_Entity,
        Location,
        Start_Date: request.Start_Date,
        End_Date: request.End_Date
      });

      // Single API call to get entity verification and search strategy
      console.log(`🤖 Calling Gemini API for entity analysis...`);
      const result = await this.geminiService.verifyCompanyEntity(
        Target_institution,
        Location,
        Risk_Entity
      );

      console.log(`✅ Gemini API response received in ${Date.now() - startTime}ms`);

      // Validate the response structure with detailed checks
      console.log(`🔍 Validating API response structure...`);
      const validationResult = this.validateApiResponse(result);

      if (validationResult.isValid) {
        console.log(`✅ Response validation passed`);

        // Add country_code if missing from AI response
        if (!result.search_strategy.country_code) {
          result.search_strategy.country_code = this.getCountryCodeForLocation(Location);
          console.log(`🌍 Added fallback country_code: ${result.search_strategy.country_code}`);
        }

        // Log structured results
        console.log(`📊 Stage 1 Results Summary:`);
        console.log(`   Entity A: ${result.entity_a.original_name} (${result.entity_a.sectors.length} sectors)`);
        console.log(`   Entity B: ${result.entity_b.original_name} (${result.entity_b.sectors.length} sectors)`);
        console.log(`   Keywords: ${result.search_strategy.search_keywords.length} generated`);
        console.log(`   Languages: ${result.search_strategy.languages.join(', ')}`);
        console.log(`   Country: ${result.search_strategy.country_code}`);
        console.log(`   Engines: ${result.search_strategy.source_engine.join(', ')}`);
        console.log(`   Likelihood: ${result.search_strategy.relationship_likelihood}`);
        console.log(`🎯 Stage 1 completed successfully in ${Date.now() - startTime}ms`);

        return result as MetaPromptResult;
      } else {
        console.error(`❌ Gemini API response validation failed:`);
        validationResult.errors.forEach((error, index) => {
          console.error(`   ${index + 1}. ${error}`);
        });
        throw new Error(`Gemini API response validation failed: ${validationResult.errors.join('; ')}`);
      }

    } catch (error) {
      console.error(`❌ Stage 1 Failed after ${Date.now() - startTime}ms`);
      console.error(`🔍 Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
      });
      throw error;
    }
  }


  private validateApiResponse(result: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check top-level structure
    if (!result || typeof result !== 'object') {
      errors.push('Response is not a valid object');
      return { isValid: false, errors };
    }

    // Validate entity_a
    if (!result.entity_a) {
      errors.push('Missing entity_a');
    } else {
      if (!result.entity_a.original_name || typeof result.entity_a.original_name !== 'string') {
        errors.push('entity_a.original_name missing or invalid');
      }
      if (!result.entity_a.description || typeof result.entity_a.description !== 'string') {
        errors.push('entity_a.description missing or invalid');
      }
      if (!Array.isArray(result.entity_a.sectors)) {
        errors.push('entity_a.sectors must be an array');
      }
    }

    // Validate entity_b
    if (!result.entity_b) {
      errors.push('Missing entity_b');
    } else {
      if (!result.entity_b.original_name || typeof result.entity_b.original_name !== 'string') {
        errors.push('entity_b.original_name missing or invalid');
      }
      if (!result.entity_b.description || typeof result.entity_b.description !== 'string') {
        errors.push('entity_b.description missing or invalid');
      }
      if (!Array.isArray(result.entity_b.sectors)) {
        errors.push('entity_b.sectors must be an array');
      }
    }

    // Validate search_strategy
    if (!result.search_strategy) {
      errors.push('Missing search_strategy');
    } else {
      const strategy = result.search_strategy;

      if (!Array.isArray(strategy.search_keywords) || strategy.search_keywords.length === 0) {
        errors.push('search_strategy.search_keywords must be a non-empty array');
      }

      if (!Array.isArray(strategy.languages) || strategy.languages.length === 0) {
        errors.push('search_strategy.languages must be a non-empty array');
      }

      if (!Array.isArray(strategy.source_engine) || strategy.source_engine.length === 0) {
        errors.push('search_strategy.source_engine must be a non-empty array');
      }

      if (!Array.isArray(strategy.search_operators)) {
        errors.push('search_strategy.search_operators must be an array');
      }

      if (!strategy.relationship_likelihood ||
          !['high', 'medium', 'low'].includes(strategy.relationship_likelihood)) {
        errors.push('search_strategy.relationship_likelihood must be one of: high, medium, low');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  private getCountryCodeForLocation(location: string): string {
    const loc = location.toLowerCase();

    if (loc.includes('china') || loc.includes('中国')) return 'cn';
    if (loc.includes('russia') || loc.includes('russian')) return 'ru';
    if (loc.includes('japan')) return 'jp';
    if (loc.includes('france')) return 'fr';
    if (loc.includes('germany')) return 'de';
    if (loc.includes('uk') || loc.includes('united kingdom') || loc.includes('britain')) return 'uk';

    return 'us';
  }
}