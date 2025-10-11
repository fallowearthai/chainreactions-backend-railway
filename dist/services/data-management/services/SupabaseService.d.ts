import { Dataset, DatasetEntry, CreateDatasetRequest, UpdateDatasetRequest } from '../types/DataTypes';
export declare class SupabaseService {
    private static instance;
    private client;
    private constructor();
    static getInstance(): SupabaseService;
    private parseDatasetPublisher;
    private parseDatasets;
    getDatasets(page?: number, limit?: number): Promise<{
        datasets: Dataset[];
        total: number;
    }>;
    getDatasetById(id: string): Promise<Dataset | null>;
    findDatasetByName(name: string): Promise<Dataset | null>;
    createDataset(dataset: CreateDatasetRequest): Promise<Dataset>;
    updateDataset(id: string, updates: UpdateDatasetRequest): Promise<Dataset>;
    deleteDataset(id: string): Promise<void>;
    getDatasetEntries(datasetId: string, page?: number, limit?: number): Promise<{
        entries: DatasetEntry[];
        total: number;
    }>;
    findEntryByExternalId(externalId: string): Promise<DatasetEntry | null>;
    createDatasetEntry(entry: Partial<DatasetEntry>): Promise<DatasetEntry>;
    createDatasetEntries(entries: Partial<DatasetEntry>[]): Promise<DatasetEntry[]>;
    updateDatasetEntry(id: string, updates: Partial<DatasetEntry>): Promise<DatasetEntry>;
    deleteDatasetEntry(id: string): Promise<void>;
    deleteDatasetEntries(datasetId: string): Promise<void>;
    searchDatasetEntries(datasetId: string, query: string, page?: number, limit?: number): Promise<{
        entries: DatasetEntry[];
        total: number;
    }>;
    getDatasetStats(datasetId: string): Promise<{
        total_entries: number;
        entries_with_aliases: number;
        countries: string[];
        country_distribution: {
            [country: string]: {
                count: number;
                percentage: number;
            };
        };
        entity_types: {
            [type: string]: {
                count: number;
                percentage: number;
            };
        };
        last_updated: string;
    }>;
}
//# sourceMappingURL=SupabaseService.d.ts.map