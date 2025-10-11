export interface NROOrganization {
    id: string;
    organization_name: string;
    countries: string[];
    aliases?: string[];
    category?: string;
    metadata?: any;
    dataset_source: string;
}
export interface SupabaseNROServiceConfig {
    supabaseUrl?: string;
    supabaseKey?: string;
}
export declare class SupabaseNROService {
    private supabase;
    constructor(config?: SupabaseNROServiceConfig);
    /**
     * 获取所有Canadian NRO组织数据
     * @param testMode 测试模式：如果为true，只返回前6个实体以节省token
     * @returns Promise<NROOrganization[]> Canadian NRO组织列表
     */
    getCanadianNRO(testMode?: boolean): Promise<NROOrganization[]>;
    /**
     * 根据组织名称搜索NRO组织（支持模糊匹配）
     * @param searchTerm 搜索词
     * @returns Promise<NROOrganization[]> 匹配的组织列表
     */
    searchNROByName(searchTerm: string): Promise<NROOrganization[]>;
    /**
     * 获取NRO数据统计信息
     * @returns Promise<{total: number, byCountry: Record<string, number>}>
     */
    getNROStatistics(): Promise<{
        total: number;
        byCountry: Record<string, number>;
        categories: Record<string, number>;
    }>;
    /**
     * 测试数据库连接
     * @returns Promise<boolean> 连接是否成功
     */
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=SupabaseNROService.d.ts.map