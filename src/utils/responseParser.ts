import { GeminiResponse, SearchResult, FormattedSearchResult } from '../types/gemini';

export class ResponseParser {
  static parseGeminiResponse(response: GeminiResponse): SearchResult[] {
    try {
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates found in Gemini response');
      }

      const candidate = candidates[0];
      const content = candidate.content;

      if (!content.parts || content.parts.length === 0) {
        throw new Error('No content parts found in Gemini response');
      }

      // Extract text from all parts and concatenate
      let fullText = '';
      for (const part of content.parts) {
        if (part.text) {
          fullText += part.text;
        }
      }

      if (!fullText.trim()) {
        throw new Error('No text content found in Gemini response');
      }

      // Try to extract JSON from the text
      const jsonContent = this.extractJsonFromText(fullText);

      if (!jsonContent) {
        throw new Error('No JSON content found in Gemini response');
      }

      // Parse and clean the JSON
      const cleanedJson = this.cleanJsonString(jsonContent);

      try {
        const parsed = JSON.parse(cleanedJson);

        // Ensure we have an array
        if (Array.isArray(parsed)) {
          return parsed.map(item => this.validateAndCleanSearchResult(item));
        } else if (typeof parsed === 'object' && parsed !== null) {
          // If it's a single object, wrap it in an array
          return [this.validateAndCleanSearchResult(parsed)];
        } else {
          throw new Error('Expected JSON array or object, got ' + typeof parsed);
        }
      } catch (parseError: any) {
        console.error('JSON parsing failed:', parseError);
        throw new Error(`Failed to parse JSON: ${parseError.message}`);
      }
    } catch (error) {
      console.error('Response parsing error:', error);
      throw error;
    }
  }

  private static extractJsonFromText(text: string): string | null {
    if (typeof text !== 'string') {
      return null;
    }

    // Try to find ```json ... ``` blocks first
    const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1].trim();
    }

    // Try to find ``` ... ``` blocks without json specifier
    const codeMatch = text.match(/```\s*\n([\s\S]*?)\n```/);
    if (codeMatch && codeMatch[1]) {
      return codeMatch[1].trim();
    }

    // Try to find JSON arrays directly
    const arrayMatch = text.match(/(\[[\s\S]*?\])/);
    if (arrayMatch && arrayMatch[1]) {
      return arrayMatch[1].trim();
    }

    // Try to find JSON objects directly
    const objectMatch = text.match(/(\{[\s\S]*?\})/);
    if (objectMatch && objectMatch[1]) {
      return objectMatch[1].trim();
    }

    return null;
  }

  private static cleanJsonString(jsonStr: string): string {
    if (typeof jsonStr !== 'string') {
      return jsonStr;
    }

    return jsonStr
      // Remove control characters (ASCII 0-31, except \t \n \r)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Fix backslash escaping
      .replace(/\\\\/g, '\\')
      // Fix newline issues
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove zero-width characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Remove other invisible characters
      .replace(/[\u2028\u2029]/g, '')
      // Fix quotes that might be broken
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static validateAndCleanSearchResult(item: any): SearchResult {
    const result: SearchResult = {
      risk_item: '',
      institution_A: '',
      relationship_type: 'Unknown',
      finding_summary: '',
      potential_intermediary_B: null,
      sources: []
    };

    // Clean and validate each field
    result.risk_item = this.cleanString(item.risk_item || '');
    result.institution_A = this.cleanString(item.institution_A || '');

    // Validate relationship_type
    const validRelationshipTypes = ['Direct', 'Indirect', 'Significant Mention', 'Unknown', 'No Evidence Found'];
    result.relationship_type = validRelationshipTypes.includes(item.relationship_type)
      ? item.relationship_type
      : 'Unknown';

    result.finding_summary = this.cleanString(item.finding_summary || '');

    // Handle potential_intermediary_B
    if (Array.isArray(item.potential_intermediary_B)) {
      result.potential_intermediary_B = item.potential_intermediary_B
        .filter((b: any) => b && typeof b === 'string')
        .map((b: string) => this.cleanString(b));
    } else if (item.potential_intermediary_B === null || item.potential_intermediary_B === undefined) {
      result.potential_intermediary_B = null;
    } else {
      result.potential_intermediary_B = null;
    }

    // Handle sources
    if (Array.isArray(item.sources)) {
      result.sources = item.sources
        .filter((source: any) => source && typeof source === 'string' && this.isValidUrl(source))
        .map((source: string) => this.cleanString(source));
    } else {
      result.sources = [];
    }

    return result;
  }

  private static cleanString(str: string): string {
    if (typeof str !== 'string') {
      return '';
    }

    return str.trim()
      .replace(/\s+/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF\u2028\u2029]/g, '');
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static formatSearchResults(
    results: SearchResult[],
    renderedContent?: string,
    webSearchQueries?: string[]
  ): FormattedSearchResult[] {
    return results.map(result => {
      // Create intermediary string
      let intermediaryString = '';
      if (Array.isArray(result.potential_intermediary_B) && result.potential_intermediary_B.length > 0) {
        intermediaryString = result.potential_intermediary_B.join(', ');
      } else {
        intermediaryString = 'None';
      }

      // Create formatted output string
      const formattedOutput = `Risk Item: ${result.risk_item}\\nInstitution A: ${result.institution_A}\\nRelationship Type: ${result.relationship_type}\\nFinding Summary: ${result.finding_summary}\\nIntermediary B: ${intermediaryString}`;

      // Create URLs string
      let urlsString = '';
      if (result.sources.length > 0) {
        urlsString = result.sources.map((url, index) => `${index + 1}. ${url}`).join('\\n');
      }

      return {
        result: formattedOutput,
        urls: urlsString,
        raw_data: {
          risk_item: result.risk_item,
          institution_A: result.institution_A,
          relationship_type: result.relationship_type,
          finding_summary: result.finding_summary,
          potential_intermediary_B: result.potential_intermediary_B || [],
          urls: urlsString,
          sources_count: result.sources.length,
          renderedContent,
          webSearchQueries
        }
      };
    });
  }

  static extractGroundingMetadata(response: GeminiResponse): {
    renderedContent?: string;
    webSearchQueries?: string[];
  } {
    const candidate = response.candidates?.[0];
    if (!candidate) {
      return {};
    }

    const groundingMetadata = candidate.groundnMetadata || (candidate as any).groundingMetadata;
    if (!groundingMetadata) {
      return {};
    }

    return {
      renderedContent: groundingMetadata.searchEntryPoint?.renderedContent,
      webSearchQueries: groundingMetadata.webSearchQueries
    };
  }
}