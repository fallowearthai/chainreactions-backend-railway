import { GeminiService } from './GeminiService';
import { SearchRequest } from '../types/gemini';
import {
  MetaPromptResponse,
  EntityAnalysis,
  SearchStrategy,
  SearchTerms,
  ToolSelection,
  AvailableTools,
  ToolConfig
} from '../types/strategy';
import { PromptBuilder } from '../utils/promptBuilder';

export class MetaPromptService {
  private geminiService: GeminiService;
  private availableTools: AvailableTools;

  constructor() {
    this.geminiService = new GeminiService();
    this.availableTools = this.initializeAvailableTools();
  }

  private initializeAvailableTools(): AvailableTools {
    return {
      google_search: {
        name: 'google_search',
        enabled: true,
        priority_score: 10,
        geographic_strengths: ['Worldwide'],
        category_strengths: ['all']
      },
      newsapi: {
        name: 'newsapi',
        enabled: !!process.env.NEWSAPI_KEY,
        api_key: process.env.NEWSAPI_KEY,
        rate_limit: { requests_per_minute: 60, requests_per_day: 1000 },
        priority_score: 8,
        geographic_strengths: ['China', 'Russia', 'Iran', 'Global'],
        category_strengths: ['government', 'military', 'organization']
      },
      gdelt: {
        name: 'gdelt',
        enabled: true, // Free API
        priority_score: 7,
        geographic_strengths: ['China', 'Russia', 'Iran', 'Middle East', 'Asia'],
        category_strengths: ['government', 'military', 'organization']
      },
      arxiv: {
        name: 'arxiv',
        enabled: true, // Free API
        priority_score: 9,
        geographic_strengths: ['Worldwide'],
        category_strengths: ['academic', 'technology']
      },
      semantic_scholar: {
        name: 'semantic_scholar',
        enabled: !!process.env.SEMANTIC_SCHOLAR_KEY,
        api_key: process.env.SEMANTIC_SCHOLAR_KEY,
        rate_limit: { requests_per_minute: 100, requests_per_day: 100000 },
        priority_score: 8,
        geographic_strengths: ['Worldwide'],
        category_strengths: ['academic', 'technology']
      },
      opencorporates: {
        name: 'opencorporates',
        enabled: !!process.env.OPENCORPORATES_KEY,
        api_key: process.env.OPENCORPORATES_KEY,
        rate_limit: { requests_per_minute: 10, requests_per_day: 500 },
        priority_score: 7,
        geographic_strengths: ['UK', 'US', 'EU', 'China'],
        category_strengths: ['organization', 'financial']
      },
      wikidata: {
        name: 'wikidata',
        enabled: true, // Free SPARQL endpoint
        priority_score: 6,
        geographic_strengths: ['Worldwide'],
        category_strengths: ['academic', 'organization', 'government']
      },
      github: {
        name: 'github',
        enabled: !!process.env.GITHUB_TOKEN,
        api_key: process.env.GITHUB_TOKEN,
        rate_limit: { requests_per_minute: 300, requests_per_day: 5000 },
        priority_score: 7,
        geographic_strengths: ['Worldwide'],
        category_strengths: ['technology']
      }
    };
  }

  async generateSearchStrategy(request: SearchRequest): Promise<MetaPromptResponse> {
    try {
      const metaPrompt = this.buildMetaPrompt(request);
      const response = await this.geminiService.generateContent(
        [{ role: 'user', parts: [{ text: metaPrompt }] }],
        {
          parts: [{
            text: "You are a Search Strategy Generator specialized in OSINT research. Your task is to analyze institution and risk entity pairs and generate optimized search strategies for finding connections between them."
          }]
        },
        undefined, // no tools needed for meta analysis
        {
          temperature: 0.1,
          maxOutputTokens: 2048,
          topP: 0.8,
          topK: 10
        }
      );

      return this.parseMetaPromptResponse(response.candidates[0]?.content?.parts?.[0]?.text || '');

    } catch (error) {
      console.error('Meta prompt generation failed:', error);
      return this.generateFallbackStrategy(request);
    }
  }

  private buildMetaPrompt(request: SearchRequest): string {
    const { Target_institution, Risk_Entity, Location, Start_Date, End_Date } = request;
    const riskEntities = Risk_Entity.split(',').map(entity => entity.trim());

    let timeRange = '';
    if (Start_Date && End_Date) {
      timeRange = `${Start_Date} to ${End_Date}`;
    }

    return `Analyze the following inputs and generate an optimized search strategy:

Institution A: ${Target_institution}
Risk Entity: ${riskEntities.join(', ')}
Location: ${Location}
Time Range: ${timeRange || 'No time constraints'}

Based on this analysis, provide a JSON response with the following structure:

{
  "entity_analysis": {
    "institution_type": "string", // One of: "university", "government", "corporation", "ngo", "military", "unknown"
    "risk_category": "string", // One of: "government", "military", "technology", "organization", "academic", "financial", "unknown"
    "geographic_focus": "string", // primary country/region
    "relationship_likelihood": "string" // "high", "medium", "low"
  },
  "search_strategy": {
    "primary_keywords": ["string"], // 3-5 most relevant keyword combinations
    "secondary_keywords": ["string"], // 3-5 alternative keyword combinations
    "languages": ["string"], // languages to search in based on location
    "source_priorities": ["string"], // preferred source types (news, academic, official, etc.)
    "search_operators": ["string"], // Google search operators to use
    "time_focus": "string" // how to approach time-based searching
  },
  "search_terms": {
    "english": ["string"], // English search terms
    "local_language": ["string"] // Local language terms (if applicable)
  }
}

Generate specific, actionable search strategies that will help find documented connections, collaborations, or significant mentions between the institution and risk entity. Consider the geographic and cultural context when suggesting search terms and sources.

Important: Focus on the relationship between "${Target_institution}" and each of these entities: ${riskEntities.join(', ')}. Consider that this is an OSINT investigation looking for verifiable connections.`;
  }

  private parseMetaPromptResponse(responseText: string): MetaPromptResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/```json\s*\n([\s\S]*?)\n```/) ||
                       responseText.match(/(\{[\s\S]*\})/);

      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[1].trim());

      // Validate and ensure all required fields exist
      const entityAnalysis: EntityAnalysis = {
        institution_type: parsed.entity_analysis?.institution_type || 'unknown',
        risk_category: parsed.entity_analysis?.risk_category || 'unknown',
        geographic_focus: parsed.entity_analysis?.geographic_focus || 'global',
        relationship_likelihood: parsed.entity_analysis?.relationship_likelihood || 'medium'
      };

      const searchStrategy: SearchStrategy = {
        primary_keywords: parsed.search_strategy?.primary_keywords || ['cooperation', 'collaboration'],
        secondary_keywords: parsed.search_strategy?.secondary_keywords || ['partnership', 'agreement'],
        languages: parsed.search_strategy?.languages || ['english'],
        source_priorities: parsed.search_strategy?.source_priorities || ['news', 'official'],
        search_operators: parsed.search_strategy?.search_operators || [],
        time_focus: parsed.search_strategy?.time_focus || 'recent_years'
      };

      const searchTerms: SearchTerms = {
        english: parsed.search_terms?.english || [],
        local_language: parsed.search_terms?.local_language || []
      };

      // Generate tool selection based on analysis
      const toolSelection = this.selectOptimalTools(entityAnalysis);

      return {
        entity_analysis: entityAnalysis,
        search_strategy: searchStrategy,
        search_terms: searchTerms,
        tool_selection: toolSelection,
        fallback_used: false
      };

    } catch (error) {
      console.error('Failed to parse meta prompt response:', error);
      return {
        entity_analysis: {
          institution_type: 'unknown',
          risk_category: 'unknown',
          geographic_focus: 'global',
          relationship_likelihood: 'medium'
        },
        search_strategy: {
          primary_keywords: ['cooperation', 'collaboration', 'partnership'],
          secondary_keywords: ['agreement', 'joint project', 'funding'],
          languages: ['english'],
          source_priorities: ['news', 'official', 'academic'],
          search_operators: [],
          time_focus: 'recent_years'
        },
        search_terms: {
          english: ['cooperation', 'partnership'],
          local_language: []
        },
        fallback_used: true,
        parse_error: (error as Error).message,
        raw_content: responseText.substring(0, 200)
      };
    }
  }

  private selectOptimalTools(entityAnalysis: EntityAnalysis): ToolSelection {
    const selectedTools: string[] = ['google_search']; // Always include base search
    const toolPriorities: Record<string, number> = { google_search: 10 };
    let reasoning = 'Selected tools based on entity analysis: ';

    // Geographic-based selection
    const geoFocus = entityAnalysis.geographic_focus.toLowerCase();
    if (geoFocus.includes('china') || geoFocus.includes('iran') || geoFocus.includes('russia')) {
      if (this.availableTools.newsapi?.enabled) {
        selectedTools.push('newsapi');
        toolPriorities.newsapi = 8;
        reasoning += 'NewsAPI for regional news coverage, ';
      }
      if (this.availableTools.gdelt?.enabled) {
        selectedTools.push('gdelt');
        toolPriorities.gdelt = 7;
        reasoning += 'GDELT for geopolitical events, ';
      }
    }

    // Category-based selection
    if (entityAnalysis.risk_category === 'academic' || entityAnalysis.risk_category === 'technology') {
      if (this.availableTools.arxiv?.enabled) {
        selectedTools.push('arxiv');
        toolPriorities.arxiv = 9;
        reasoning += 'ArXiv for academic research, ';
      }
      if (this.availableTools.semantic_scholar?.enabled) {
        selectedTools.push('semantic_scholar');
        toolPriorities.semantic_scholar = 8;
        reasoning += 'Semantic Scholar for academic citations, ';
      }
    }

    if (entityAnalysis.risk_category === 'organization' || entityAnalysis.institution_type === 'corporation') {
      if (this.availableTools.opencorporates?.enabled) {
        selectedTools.push('opencorporates');
        toolPriorities.opencorporates = 7;
        reasoning += 'OpenCorporates for corporate data, ';
      }
    }

    if (entityAnalysis.risk_category === 'technology') {
      if (this.availableTools.github?.enabled) {
        selectedTools.push('github');
        toolPriorities.github = 7;
        reasoning += 'GitHub for tech collaborations, ';
      }
    }

    // Always include Wikidata for structured entity relationships
    if (this.availableTools.wikidata?.enabled) {
      selectedTools.push('wikidata');
      toolPriorities.wikidata = 6;
      reasoning += 'Wikidata for entity relationships';
    }

    return {
      selected_tools: selectedTools,
      tool_priorities: toolPriorities,
      reasoning: reasoning.replace(/, $/, '')
    };
  }

  private generateFallbackStrategy(request: SearchRequest): MetaPromptResponse {
    const location = request.Location.toLowerCase();
    const nativeLanguage = PromptBuilder.getLocationLanguage(request.Location);

    return {
      entity_analysis: {
        institution_type: 'unknown',
        risk_category: 'unknown',
        geographic_focus: request.Location,
        relationship_likelihood: 'medium'
      },
      search_strategy: {
        primary_keywords: ['cooperation', 'collaboration', 'partnership', 'joint project'],
        secondary_keywords: ['agreement', 'funding', 'investment', 'exchange', 'alliance'],
        languages: ['english', nativeLanguage.toLowerCase()],
        source_priorities: ['news', 'official', 'academic', 'corporate'],
        search_operators: ['site:edu', 'site:gov', 'filetype:pdf'],
        time_focus: 'comprehensive_timerange'
      },
      search_terms: {
        english: ['cooperation', 'partnership', 'collaboration', 'joint venture'],
        local_language: [] // Would need translation service for this
      },
      tool_selection: {
        selected_tools: ['google_search'],
        tool_priorities: { google_search: 10 },
        reasoning: 'Fallback strategy using basic search only'
      },
      fallback_used: true
    };
  }

  // Helper method to get available tool names
  getAvailableToolNames(): string[] {
    return Object.keys(this.availableTools).filter(
      toolName => this.availableTools[toolName as keyof AvailableTools]?.enabled
    );
  }

  // Helper method to get tool configuration
  getToolConfig(toolName: string): ToolConfig | undefined {
    const tool = this.availableTools[toolName as keyof AvailableTools];
    return tool as ToolConfig | undefined;
  }
}