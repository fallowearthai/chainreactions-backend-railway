import { CountryNormalizer } from '../utils/CountryNormalizer';
import { ConfigManager } from '../utils/ConfigManager';

interface GeographicContext {
  searchLocation?: string;
  entityCountries?: string[];
  searchRadius?: 'local' | 'regional' | 'global';
  prioritizeLocal?: boolean;
}

interface GeographicScore {
  relevance_score: number;
  boost_factor: number;
  relationship: 'same_country' | 'same_region' | 'different_region' | 'unknown';
  matched_countries: string[];
  explanation: string;
}

export class GeographicMatching {
  private static instance: GeographicMatching;
  private countryNormalizer: CountryNormalizer;
  private configManager: ConfigManager;

  private constructor() {
    this.countryNormalizer = CountryNormalizer.getInstance();
    this.configManager = ConfigManager.getInstance();
  }

  public static getInstance(): GeographicMatching {
    if (!GeographicMatching.instance) {
      GeographicMatching.instance = new GeographicMatching();
    }
    return GeographicMatching.instance;
  }

  /**
   * Calculate geographic relevance score
   */
  public calculateGeographicScore(context: GeographicContext): GeographicScore {
    const config = this.configManager.getGeographicConfig();

    // Return neutral score if geographic matching is disabled
    if (!config.enable_location_boost) {
      return {
        relevance_score: 1.0,
        boost_factor: 1.0,
        relationship: 'unknown',
        matched_countries: [],
        explanation: 'Geographic matching disabled'
      };
    }

    // Return neutral score if no geographic context
    if (!context.searchLocation || !context.entityCountries || context.entityCountries.length === 0) {
      return {
        relevance_score: 1.0,
        boost_factor: 1.0,
        relationship: 'unknown',
        matched_countries: [],
        explanation: 'No geographic context provided'
      };
    }

    const searchCountry = this.countryNormalizer.normalizeCountry(context.searchLocation);
    if (!searchCountry) {
      return {
        relevance_score: 1.0,
        boost_factor: 1.0,
        relationship: 'unknown',
        matched_countries: [],
        explanation: `Unrecognized location: ${context.searchLocation}`
      };
    }

    // Normalize entity countries
    const normalizedEntityCountries = context.entityCountries
      .map(country => this.countryNormalizer.normalizeCountry(country))
      .filter(match => match !== null)
      .map(match => match!.canonical);

    if (normalizedEntityCountries.length === 0) {
      return {
        relevance_score: 0.8,
        boost_factor: config.location_penalty_factor,
        relationship: 'unknown',
        matched_countries: [],
        explanation: 'Entity has no valid country information'
      };
    }

    // Calculate best relationship among all entity countries
    let bestScore = this.calculateCountryRelationship(searchCountry.canonical, normalizedEntityCountries);

    // Apply search radius modifiers
    if (context.searchRadius) {
      bestScore = this.applySearchRadiusModifier(bestScore, context.searchRadius);
    }

    // Apply priority country boost
    if (context.prioritizeLocal && this.countryNormalizer.isPriorityCountry(searchCountry.canonical)) {
      bestScore.boost_factor *= 1.1;
      bestScore.explanation += ' (Priority country boost applied)';
    }

    bestScore.matched_countries = normalizedEntityCountries;
    return bestScore;
  }

  /**
   * Calculate relationship between search country and entity countries
   */
  private calculateCountryRelationship(searchCountry: string, entityCountries: string[]): GeographicScore {
    const config = this.configManager.getSimilarityWeights().context_adjustments.geographic_boost;

    // Check for exact country match
    if (entityCountries.includes(searchCountry)) {
      return {
        relevance_score: 1.0,
        boost_factor: config.same_country || 1.2,
        relationship: 'same_country',
        matched_countries: [],
        explanation: `Exact country match: ${searchCountry}`
      };
    }

    // Check for regional matches
    const searchRegionalCountries = this.countryNormalizer.getRegionalCountries(searchCountry);
    const hasRegionalMatch = entityCountries.some(country =>
      searchRegionalCountries.includes(country)
    );

    if (hasRegionalMatch) {
      const matchedRegionalCountries = entityCountries.filter(country =>
        searchRegionalCountries.includes(country)
      );

      return {
        relevance_score: 0.8,
        boost_factor: config.same_region || 1.1,
        relationship: 'same_region',
        matched_countries: [],
        explanation: `Regional match: ${matchedRegionalCountries.join(', ')} in same region as ${searchCountry}`
      };
    }

    // Different region
    return {
      relevance_score: 0.6,
      boost_factor: config.different_region || 0.9,
      relationship: 'different_region',
      matched_countries: [],
      explanation: `Different region: ${entityCountries.join(', ')} vs ${searchCountry}`
    };
  }

  /**
   * Apply search radius modifiers
   */
  private applySearchRadiusModifier(score: GeographicScore, radius: 'local' | 'regional' | 'global'): GeographicScore {
    const modifiedScore = { ...score };

    switch (radius) {
      case 'local':
        // Strongly prefer same country
        if (score.relationship === 'same_country') {
          modifiedScore.boost_factor *= 1.3;
          modifiedScore.explanation += ' (Local search boost)';
        } else if (score.relationship === 'same_region') {
          modifiedScore.boost_factor *= 1.1;
        } else {
          modifiedScore.boost_factor *= 0.7;
          modifiedScore.explanation += ' (Local search penalty)';
        }
        break;

      case 'regional':
        // Prefer same region
        if (score.relationship === 'same_country' || score.relationship === 'same_region') {
          modifiedScore.boost_factor *= 1.2;
          modifiedScore.explanation += ' (Regional search boost)';
        } else {
          modifiedScore.boost_factor *= 0.8;
        }
        break;

      case 'global':
        // Minimal geographic preference
        if (score.relationship === 'different_region') {
          modifiedScore.boost_factor = Math.max(0.95, modifiedScore.boost_factor);
          modifiedScore.explanation += ' (Global search - minimal penalty)';
        }
        break;
    }

    return modifiedScore;
  }

  /**
   * Filter and rank entities by geographic relevance
   */
  public filterByGeographicRelevance<T extends { countries?: string[] }>(
    entities: T[],
    context: GeographicContext,
    minRelevanceScore: number = 0.5
  ): Array<T & { geographic_score: GeographicScore }> {
    return entities
      .map(entity => {
        const geographicScore = this.calculateGeographicScore({
          ...context,
          entityCountries: entity.countries || []
        });

        return {
          ...entity,
          geographic_score: geographicScore
        };
      })
      .filter(item => item.geographic_score.relevance_score >= minRelevanceScore)
      .sort((a, b) => {
        // Sort by boost factor (higher is better), then by relevance score
        const boostDiff = b.geographic_score.boost_factor - a.geographic_score.boost_factor;
        if (Math.abs(boostDiff) > 0.01) {
          return boostDiff;
        }
        return b.geographic_score.relevance_score - a.geographic_score.relevance_score;
      });
  }

  /**
   * Get geographic suggestions for a location
   */
  public getGeographicSuggestions(location: string, entityCountries: string[]): {
    suggested_countries: string[];
    regional_alternatives: string[];
    explanation: string;
  } {
    const normalizedLocation = this.countryNormalizer.normalizeCountry(location);

    if (!normalizedLocation) {
      // Suggest countries based on entity data
      const suggestions = this.countryNormalizer.getCountrySuggestions(location, 5);
      return {
        suggested_countries: suggestions.map(s => s.canonical),
        regional_alternatives: [],
        explanation: `Location "${location}" not recognized. Suggestions based on similarity.`
      };
    }

    const regionalCountries = this.countryNormalizer.getRegionalCountries(normalizedLocation.canonical);
    const entityCountrySet = new Set(entityCountries);

    // Find entities in same region
    const regionalMatches = regionalCountries.filter(country => entityCountrySet.has(country));

    return {
      suggested_countries: [normalizedLocation.canonical],
      regional_alternatives: regionalMatches,
      explanation: `Location "${location}" normalized to "${normalizedLocation.canonical}". Found ${regionalMatches.length} entities in same region.`
    };
  }

  /**
   * Calculate geographic diversity score for a set of results
   */
  public calculateDiversityScore(results: Array<{ countries?: string[] }>): {
    diversity_score: number;
    unique_countries: number;
    unique_regions: number;
    geographic_distribution: Record<string, number>;
  } {
    const countrySet = new Set<string>();
    const regionSet = new Set<string>();
    const countryCount: Record<string, number> = {};

    for (const result of results) {
      if (result.countries) {
        for (const country of result.countries) {
          const normalized = this.countryNormalizer.normalizeCountry(country);
          if (normalized) {
            countrySet.add(normalized.canonical);
            countryCount[normalized.canonical] = (countryCount[normalized.canonical] || 0) + 1;

            // Add regions
            const regionalCountries = this.countryNormalizer.getRegionalCountries(normalized.canonical);
            const mappings = this.configManager.getCountryMappings().regional_groups;
            for (const [region, countries] of Object.entries(mappings)) {
              if (countries.includes(normalized.canonical)) {
                regionSet.add(region);
              }
            }
          }
        }
      }
    }

    // Calculate diversity score (0-1, where 1 is most diverse)
    const totalResults = results.length;
    const uniqueCountries = countrySet.size;
    const maxPossibleCountries = Math.min(totalResults, this.countryNormalizer.getAllSupportedCountries().length);

    const diversityScore = maxPossibleCountries > 0 ? uniqueCountries / maxPossibleCountries : 0;

    return {
      diversity_score: diversityScore,
      unique_countries: uniqueCountries,
      unique_regions: regionSet.size,
      geographic_distribution: countryCount
    };
  }

  /**
   * Apply geographic deduplication to results
   */
  public applyGeographicDeduplication<T extends { organization_name: string; countries?: string[] }>(
    results: T[],
    maxPerCountry: number = 3
  ): T[] {
    const countryBuckets: Record<string, T[]> = {};

    // Group results by country
    for (const result of results) {
      if (result.countries && result.countries.length > 0) {
        const primaryCountry = result.countries[0];
        if (primaryCountry) {
          const normalized = this.countryNormalizer.normalizeCountry(primaryCountry);
          const key = normalized ? normalized.canonical : 'unknown';

          if (!countryBuckets[key]) {
            countryBuckets[key] = [];
          }
          countryBuckets[key].push(result);
        }
      } else {
        if (!countryBuckets['unknown']) {
          countryBuckets['unknown'] = [];
        }
        countryBuckets['unknown'].push(result);
      }
    }

    // Take top results from each country bucket
    const deduplicated: T[] = [];
    for (const [country, bucket] of Object.entries(countryBuckets)) {
      deduplicated.push(...bucket.slice(0, maxPerCountry));
    }

    return deduplicated;
  }

  /**
   * Get geographic matching statistics
   */
  public getGeographicStats() {
    return {
      supported_countries: this.countryNormalizer.getAllSupportedCountries().length,
      priority_countries: this.configManager.getCountryMappings().priority_countries.length,
      regional_groups: Object.keys(this.configManager.getCountryMappings().regional_groups).length,
      geographic_boost_enabled: this.configManager.getGeographicConfig().enable_location_boost,
      cache_stats: this.countryNormalizer.getCacheStats()
    };
  }
}