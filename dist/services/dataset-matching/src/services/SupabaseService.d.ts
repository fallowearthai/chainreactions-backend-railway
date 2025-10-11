import { DatasetEntry, Dataset, DatasetMatch, ServiceResponse } from '../types/DatasetMatchTypes';
export declare class SupabaseService {
    private client;
    private static instance;
    private constructor();
    static getInstance(): SupabaseService;
    testConnection(): Promise<ServiceResponse<{
        status: string;
        tables: string[];
    }>>;
    getDatasetsVersion(): Promise<ServiceResponse<string>>;
    findDatasetMatches(searchText: string, searchLocation?: string, options?: {
        prioritizeLocal?: boolean;
        maxResults?: number;
    }): Promise<ServiceResponse<DatasetMatch[]>>;
    private findDatasetMatchesWithLocation;
    private processMatchEntry;
    private findDatasetMatchesOptimized;
    private removeDuplicateMatches;
    private findDatasetMatchesFallback;
    private determineMatchType;
    getActiveDatasets(): Promise<ServiceResponse<Dataset[]>>;
    getDatasetEntries(datasetId: string, limit?: number): Promise<ServiceResponse<DatasetEntry[]>>;
    findDatasetMatchesBatch(searchTexts: string[]): Promise<ServiceResponse<Record<string, DatasetMatch[]>>>;
    private getProcessingTime;
    getDatabaseStats(): Promise<ServiceResponse<any>>;
}
//# sourceMappingURL=SupabaseService.d.ts.map