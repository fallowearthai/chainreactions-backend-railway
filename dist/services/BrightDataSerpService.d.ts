import { BrightDataSerpResponse, MultiEngineSearchRequest, MultiEngineSearchResponse, SerpEngine, SearchEngineConfig, EngineSelectionStrategy } from '../types/brightDataSerpApi';
export declare class BrightDataSerpService implements EngineSelectionStrategy {
    private apiClient;
    private apiKey;
    private zone;
    private engineConfigs;
    constructor();
    private initializeEngineConfigs;
    selectEngines(location: string, riskCategory: string, _languages: string[]): {
        engines: SerpEngine[];
        reasoning: string;
    };
    searchSingleEngine(engine: SerpEngine, query: string, options?: {
        location?: string;
        language?: string;
        country?: string;
        num_results?: number;
        time_filter?: string;
        safe_search?: string;
        start_date?: string;
        end_date?: string;
    }): Promise<BrightDataSerpResponse>;
    private buildEngineSpecificRequest;
    /**
     * Convert YYYY-MM format to Google date format MM/DD/YYYY
     */
    private convertToGoogleDateFormat;
    private buildSearchUrl;
    private parseEngineResponse;
    private parseBaiduHtml;
    private parseYandexHtml;
    private parseGenericResponse;
    searchMultipleEngines(request: MultiEngineSearchRequest): Promise<MultiEngineSearchResponse>;
    private aggregateResults;
    private getEngineWeight;
    private normalizeUrl;
    healthCheck(): Promise<{
        available: boolean;
        message: string;
        engines_configured: number;
    }>;
    getAvailableEngines(): SerpEngine[];
    getEngineConfigs(): Record<string, SearchEngineConfig>;
}
//# sourceMappingURL=BrightDataSerpService.d.ts.map