import { SearchRequest } from '../../types/gemini';
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
    Start_Date?: string;
    End_Date?: string;
    Custom_Keyword?: string;
    Original_Risk_Entity?: string;
}
export declare class WebSearchMetaPromptService {
    private geminiService;
    constructor();
    generateSearchStrategy(request: SearchRequest): Promise<MetaPromptResult>;
    private validateApiResponse;
    private getCountryCodeForLocation;
}
//# sourceMappingURL=WebSearchMetaPromptService.d.ts.map