export interface EntitySearchRequest {
  company_name: string;
  location?: string;
  exclude_domains?: string[];
}

export interface EntitySearchResponse {
  success: boolean;
  data?: any[];
  error?: string;
  message?: string;
}

export interface LinkupAPIResponse {
  success: boolean;
  data?: {
    answer?: string;
    sources?: Array<{
      title: string;
      url: string;
      snippet?: string;
      description?: string;
    }>;
    company_info?: {
      // N8N prompt fields
      original_name: string;
      english_name?: string;
      past_names?: string[];
      description: string;
      headquarters: string;
      sectors: string[];
      similar_name_companies_exist?: boolean;
      vendors?: Array<{
        name: string;
        details: string;
        source_url: string;
      }>;
      partnerships?: Array<{
        partner: string;
        details: string;
        source_url: string;
      }>;
      "Research References"?: Array<{
        title: string;
        url: string;
        relevance: string;
      }>;
      // Enhanced fields for backward compatibility
      headquarters_structured?: {
        address: string;
        city: string;
        state?: string;
        country: string;
        coordinates?: { lat: number; lng: number };
      };
      founding_info?: {
        date?: string;
        jurisdiction?: string;
      };
      leadership?: {
        executives?: Array<{ name: string; title: string }>;
        board_members?: string[];
      };
      corporate_structure?: {
        parent_company?: string;
        subsidiaries?: string[];
        company_type?: string;
      };
      operations?: {
        employees?: string;
        revenue?: string;
        major_locations?: string[];
        website?: string;
      };
    };
    [key: string]: any;
  };
  error?: string;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  service: string;
  version: string;
}

export interface ServiceInfoResponse {
  service: string;
  version: string;
  description: string;
  endpoints: string[];
  status: string;
}
