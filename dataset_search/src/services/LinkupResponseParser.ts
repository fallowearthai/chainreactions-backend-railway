import { LinkupApiResponse, ParsedSearchResult, DatasetSearchError } from '../types/DatasetSearchTypes';

export class LinkupResponseParser {

  /**
   * Parse the Linkup API response - simplified approach like frontend
   */
  static parseResponse(response: LinkupApiResponse, riskEntity: string): ParsedSearchResult {
    if (!response || !response.answer) {
      throw new DatasetSearchError(
        'Invalid Linkup response: missing answer field',
        'INVALID_RESPONSE_FORMAT',
        422
      );
    }

    const answer = response.answer;
    const sources = response.sources || [];
    const sourceUrls = sources.map(source => source.url).filter(Boolean);

    try {
      // Simple parsing approach - prioritize direct extraction over complex JSON parsing
      return this.extractDirectFields(answer, riskEntity, sourceUrls, response);
    } catch (error) {
      console.error('Failed to parse Linkup response:', error);
      // Return simple fallback result
      return this.createSimpleResult(answer, riskEntity, sourceUrls, response);
    }
  }

  /**
   * Extract fields directly using simple patterns - like frontend approach
   */
  private static extractDirectFields(
    answer: string,
    riskEntity: string,
    sourceUrls: string[],
    rawResponse: LinkupApiResponse
  ): ParsedSearchResult {
    // Extract Risk Item - look for simple pattern first
    let riskItem = riskEntity;
    const riskItemMatch = answer.match(/Risk Item:\s*([^\n\r]+)/);
    if (riskItemMatch && riskItemMatch[1]) {
      riskItem = riskItemMatch[1].trim();
    } else {
      // Fallback to first meaningful line
      const lines = answer.split('\n').filter(line => line.trim().length > 10);
      if (lines.length > 0) {
        riskItem = lines[0].trim();
      }
    }

    // Extract Relationship Type - simple pattern matching
    let relationshipType: 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found' = 'Unknown';

    // Check for explicit relationship indicators
    const lowerAnswer = answer.toLowerCase();
    if (lowerAnswer.includes('no evidence') || lowerAnswer.includes('no relationship') ||
        lowerAnswer.includes('no connection') || lowerAnswer.includes('not found')) {
      relationshipType = 'No Evidence Found';
    } else if (lowerAnswer.includes('direct') && (lowerAnswer.includes('partnership') ||
        lowerAnswer.includes('collaboration') || lowerAnswer.includes('contract'))) {
      relationshipType = 'Direct';
    } else if (lowerAnswer.includes('indirect') || lowerAnswer.includes('through') ||
        lowerAnswer.includes('via') || lowerAnswer.includes('intermediary')) {
      relationshipType = 'Indirect';
    } else if (lowerAnswer.includes('mentioned') || lowerAnswer.includes('referenced') ||
        lowerAnswer.includes('associated')) {
      relationshipType = 'Significant Mention';
    }

    // Try to extract explicit relationship type
    const relationshipMatch = answer.match(/Relationship Type:\s*([^\n\r]+)/);
    if (relationshipMatch && relationshipMatch[1]) {
      const explicitType = relationshipMatch[1].trim();
      const validTypes = ['Direct', 'Indirect', 'Significant Mention', 'Unknown', 'No Evidence Found'];
      if (validTypes.includes(explicitType)) {
        relationshipType = explicitType as any;
      }
    }

    // Extract Finding Summary - simple approach
    let findingSummary = '';
    const summaryMatch = answer.match(/Finding Summary:\s*([\s\S]+?)(?=\n(?:Intermediary|Source:|$)|$)/);
    if (summaryMatch && summaryMatch[1]) {
      findingSummary = summaryMatch[1].trim();
    } else {
      // Fallback to first meaningful paragraph
      const paragraphs = answer.split('\n\n').filter(p => p.trim().length > 50);
      findingSummary = paragraphs[0]?.trim() || 'Analysis completed - see sources for details';
    }

    // Extract organizations - simple approach
    const intermediaryOrganizations: string[] = [];
    const orgPattern = /(?:Intermediary|Affiliated|Organization):\s*([^\n\r]+)/g;
    let orgMatch;
    while ((orgMatch = orgPattern.exec(answer)) !== null) {
      const org = orgMatch[1].trim();
      if (org && org.length > 2) {
        intermediaryOrganizations.push(org);
      }
    }

    return {
      risk_item: riskItem,
      relationship_type: relationshipType,
      finding_summary: findingSummary,
      intermediary_organizations: intermediaryOrganizations.slice(0, 10), // Limit to 10
      source_urls: sourceUrls.slice(0, 10), // Limit to 10
      processing_time_ms: 0,
      completed_at: new Date().toISOString(),
      raw_response: rawResponse
    };
  }

  /**
   * Create simple fallback result - minimal processing
   */
  private static createSimpleResult(
    answer: string,
    riskEntity: string,
    sourceUrls: string[],
    rawResponse: LinkupApiResponse
  ): ParsedSearchResult {
    // Very simple processing - just use what we have
    return {
      risk_item: riskEntity,
      relationship_type: 'Unknown',
      finding_summary: answer.length > 200 ? answer.substring(0, 200) + '...' : answer,
      intermediary_organizations: [],
      source_urls: sourceUrls,
      processing_time_ms: 0,
      completed_at: new Date().toISOString(),
      raw_response: rawResponse
    };
  }

  /**
   * Batch parse multiple responses
   */
  static parseMultipleResponses(
    responses: LinkupApiResponse[],
    riskEntities: string[]
  ): ParsedSearchResult[] {
    const results: ParsedSearchResult[] = [];

    responses.forEach((response, index) => {
      try {
        const riskEntity = riskEntities[index] || `Entity_${index}`;
        const parsed = this.parseResponse(response, riskEntity);
        results.push(parsed);
      } catch (error) {
        console.error(`Failed to parse response ${index}:`, error);
        // Add simple fallback result for failed parsing
        results.push({
          risk_item: riskEntities[index] || `Entity_${index}`,
          relationship_type: 'Unknown',
          finding_summary: 'Failed to parse response',
          intermediary_organizations: [],
          source_urls: response.sources?.map(s => s.url).filter(Boolean) || [],
          processing_time_ms: 0,
          completed_at: new Date().toISOString(),
          raw_response: response
        });
      }
    });

    return results;
  }
}