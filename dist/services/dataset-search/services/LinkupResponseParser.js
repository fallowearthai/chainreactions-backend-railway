"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkupResponseParser = void 0;
const DatasetSearchTypes_1 = require("../types/DatasetSearchTypes");
class LinkupResponseParser {
    /**
     * Parse the Linkup API response - prioritize JSON parsing
     */
    static parseResponse(response, riskEntity) {
        if (!response || !response.answer) {
            throw new DatasetSearchTypes_1.DatasetSearchError('Invalid Linkup response: missing answer field', 'INVALID_RESPONSE_FORMAT', 422);
        }
        const answer = response.answer;
        const sources = response.sources || [];
        const sourceUrls = sources.map(source => source.url).filter(Boolean);
        try {
            // First try to parse as JSON array (expected format from new prompt)
            return this.parseJSONResponse(answer, riskEntity, sourceUrls, response);
        }
        catch (error) {
            console.log('JSON parsing failed, falling back to text parsing:', error);
            // Fallback to text parsing for backward compatibility
            return this.parseTextResponse(answer, riskEntity, sourceUrls, response);
        }
    }
    /**
     * Parse JSON response from API
     */
    static parseJSONResponse(answer, riskEntity, sourceUrls, rawResponse) {
        try {
            // Try to extract JSON from the answer
            const jsonMatch = answer.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }
            const jsonData = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(jsonData) || jsonData.length === 0) {
                throw new Error('Invalid JSON structure - expected array');
            }
            // Take the first result from the array
            const firstResult = jsonData[0];
            // Validate required fields
            if (!firstResult.risk_item) {
                throw new Error('Missing risk_item in JSON response');
            }
            if (!firstResult.relationship_type) {
                throw new Error('Missing relationship_type in JSON response');
            }
            // Validate relationship type
            const validTypes = ['Direct', 'Indirect', 'Significant Mention', 'Unknown', 'No Evidence Found'];
            if (!validTypes.includes(firstResult.relationship_type)) {
                console.warn(`Invalid relationship_type: ${firstResult.relationship_type}, defaulting to Unknown`);
                firstResult.relationship_type = 'Unknown';
            }
            return {
                risk_item: firstResult.risk_item,
                relationship_type: firstResult.relationship_type,
                finding_summary: firstResult.finding_summary || '',
                intermediary_organizations: firstResult.intermediary_organizations || [],
                source_urls: firstResult.source_urls || sourceUrls,
                processing_time_ms: 0,
                completed_at: new Date().toISOString(),
                raw_response: rawResponse
            };
        }
        catch (error) {
            console.error('JSON parsing failed:', error);
            throw error;
        }
    }
    /**
     * Parse text response (fallback for backward compatibility)
     */
    static parseTextResponse(answer, riskEntity, sourceUrls, rawResponse) {
        // Extract Risk Item - look for simple pattern first
        let riskItem = riskEntity;
        const riskItemMatch = answer.match(/Risk Item:\s*([^\n\r]+)/);
        if (riskItemMatch && riskItemMatch[1]) {
            riskItem = riskItemMatch[1].trim();
        }
        else {
            // Fallback to first meaningful line
            const lines = answer.split('\n').filter(line => line.trim().length > 10);
            if (lines.length > 0) {
                riskItem = lines[0].trim();
            }
        }
        // Extract Relationship Type - simple pattern matching
        let relationshipType = 'Unknown';
        // Check for explicit relationship indicators
        const lowerAnswer = answer.toLowerCase();
        if (lowerAnswer.includes('no evidence') || lowerAnswer.includes('no relationship') ||
            lowerAnswer.includes('no connection') || lowerAnswer.includes('not found')) {
            relationshipType = 'No Evidence Found';
        }
        else if (lowerAnswer.includes('direct') && (lowerAnswer.includes('partnership') ||
            lowerAnswer.includes('collaboration') || lowerAnswer.includes('contract'))) {
            relationshipType = 'Direct';
        }
        else if (lowerAnswer.includes('indirect') || lowerAnswer.includes('through') ||
            lowerAnswer.includes('via') || lowerAnswer.includes('intermediary')) {
            relationshipType = 'Indirect';
        }
        else if (lowerAnswer.includes('mentioned') || lowerAnswer.includes('referenced') ||
            lowerAnswer.includes('associated')) {
            relationshipType = 'Significant Mention';
        }
        // Try to extract explicit relationship type
        const relationshipMatch = answer.match(/Relationship Type:\s*([^\n\r]+)/);
        if (relationshipMatch && relationshipMatch[1]) {
            const explicitType = relationshipMatch[1].trim();
            const validTypes = ['Direct', 'Indirect', 'Significant Mention', 'Unknown', 'No Evidence Found'];
            if (validTypes.includes(explicitType)) {
                relationshipType = explicitType;
            }
        }
        // Extract Finding Summary - simple approach
        let findingSummary = '';
        const summaryMatch = answer.match(/Finding Summary:\s*([\s\S]+?)(?=\n(?:Intermediary|Source:|$)|$)/);
        if (summaryMatch && summaryMatch[1]) {
            findingSummary = summaryMatch[1].trim();
        }
        else {
            // Fallback to first meaningful paragraph
            const paragraphs = answer.split('\n\n').filter(p => p.trim().length > 50);
            findingSummary = paragraphs[0]?.trim() || 'Analysis completed - see sources for details';
        }
        // Extract organizations - simple approach
        const intermediaryOrganizations = [];
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
     * Batch parse multiple responses
     */
    static parseMultipleResponses(responses, riskEntities) {
        const results = [];
        responses.forEach((response, index) => {
            try {
                const riskEntity = riskEntities[index] || `Entity_${index}`;
                const parsed = this.parseResponse(response, riskEntity);
                results.push(parsed);
            }
            catch (error) {
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
exports.LinkupResponseParser = LinkupResponseParser;
//# sourceMappingURL=LinkupResponseParser.js.map