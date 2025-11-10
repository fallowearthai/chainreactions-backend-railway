import axios from 'axios';

/**
 * Enhanced Entity Search Types
 * 基于Gemini API的公司信息搜索服务
 */

export interface EnhancedEntitySearchRequest {
  company_name: string;
  location?: string;
  // 移除 include_risk_analysis 和 custom_risk_keywords - 专注于基础公司信息
}

export interface BasicCompanyInfo {
  name: string;
  english_name?: string;
  headquarters?: string;
  sectors?: string[];
  description?: string;
  past_names?: string[];
  website?: string;
  founded_date?: string;
  company_type?: string;
  employees?: string;
}

export interface EnhancedEntitySearchResponse {
  success: boolean;
  company: string;
  location?: string;
  basic_info?: BasicCompanyInfo;
  // 移除 risk_analysis 和 risk_summary - 专注于基础公司信息
  metadata: {
    search_duration_ms: number;
    total_sources: number;
    search_queries_executed: number;
    api_calls_made: number;
  };
  error?: string;
}