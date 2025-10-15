// Multi-mode JSON parsing utility based on N8N workflow logic

export interface ParsedResponse {
  success: boolean;
  data: {
    company_info: any | null;
    sources: any[];
    metadata: {
      search_query: string;
      timestamp: string;
      parsing_success: boolean;
    };
  };
  raw_answer: string;
}

export class ResponseParser {
  /**
   * Parse company data from Linkup API response using multiple parsing strategies
   * Based on N8N workflow: "Parse Company Response" node
   */
  static parseCompanyData(answer: string): any | null {
    if (!answer) return null;

    let companyData = null;

    // Strategy 1: ```json ... ```
    let match = answer.match(/```json\s*(\{[\s\S]*?\})\s*```/i);
    if (match) {
      try {
        companyData = JSON.parse(match[1]);
        console.log('✅ JSON parsed using strategy 1 (```json)');
        return companyData;
      } catch (e) {
        console.log('⚠️ Strategy 1 failed, trying next...');
      }
    }

    // Strategy 2: ``` ... ```
    if (!companyData) {
      match = answer.match(/```\s*(\{[\s\S]*?\})\s*```/);
      if (match) {
        try {
          companyData = JSON.parse(match[1]);
          console.log('✅ JSON parsed using strategy 2 (```)');
          return companyData;
        } catch (e) {
          console.log('⚠️ Strategy 2 failed, trying next...');
        }
      }
    }

    // Strategy 3: Direct JSON parse
    if (!companyData) {
      try {
        companyData = JSON.parse(answer);
        console.log('✅ JSON parsed using strategy 3 (direct)');
        return companyData;
      } catch (e) {
        console.log('⚠️ Strategy 3 failed, trying next...');
      }
    }

    // Strategy 4: Find first complete JSON object
    if (!companyData) {
      match = answer.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          companyData = JSON.parse(match[0]);
          console.log('✅ JSON parsed using strategy 4 (first match)');
          return companyData;
        } catch (e) {
          console.log('⚠️ Strategy 4 failed, no more strategies available');
        }
      }
    }

    console.log('❌ All JSON parsing strategies failed');
    return null;
  }

  /**
   * Process Linkup API response and format it according to N8N output structure
   */
  static processLinkupResponse(linkupResponse: any): ParsedResponse {
    const rawAnswer = linkupResponse.answer || '';
    const sourcesData = linkupResponse.sources || [];
    const searchQuery = linkupResponse.query || '';

    console.log('🔄 Processing Linkup response:', {
      hasAnswer: !!rawAnswer,
      answerLength: rawAnswer.length,
      sourcesCount: sourcesData.length,
      hasQuery: !!searchQuery
    });

    // Parse company data using multi-strategy approach
    const companyData = this.parseCompanyData(rawAnswer);

    const result: ParsedResponse = {
      success: companyData !== null,
      data: {
        company_info: companyData,
        sources: sourcesData,
        metadata: {
          search_query: searchQuery,
          timestamp: new Date().toISOString(),
          parsing_success: companyData !== null
        }
      },
      raw_answer: rawAnswer
    };

    console.log('📊 Processing result:', {
      success: result.success,
      hasCompanyInfo: !!result.data.company_info,
      parsingSuccess: result.data.metadata.parsing_success
    });

    return result;
  }

  /**
   * Validate parsed company data structure
   */
  static validateCompanyData(companyData: any): boolean {
    if (!companyData || typeof companyData !== 'object') {
      return false;
    }

    // Check for essential fields that should be present
    const essentialFields = ['original_name', 'english_name', 'description'];
    const hasEssentialFields = essentialFields.some(field =>
      companyData.hasOwnProperty(field) && companyData[field]
    );

    return hasEssentialFields;
  }

  /**
   * Extract clean company data for frontend compatibility
   */
  static extractCleanData(parsedResponse: ParsedResponse): any[] {
    // Return N8N-compatible format with data.company_info structure
    if (parsedResponse.success && parsedResponse.data.company_info) {
      return [{
        data: {
          company_info: parsedResponse.data.company_info,
          sources: parsedResponse.data.sources
        }
      }];
    }

    // Return empty array for failed parsing to match N8N behavior
    return [];
  }
}
