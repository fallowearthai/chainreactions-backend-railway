"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiDeepThinkingService = void 0;
const axios_1 = require("axios");
const FeatureFlags_1 = require("../utils/FeatureFlags");
class GeminiDeepThinkingService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || '';
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY is not configured');
        }
    }
    /**
     * Build optimized system instruction prompt - NEW OSINT Prompt
     * Updated to use consistent prompt structure across all endpoints
     */
    buildOptimizedSystemInstruction() {
        return `## Prompt: OSINT Research on Institutional Risk Links

**Role**
You are deepdiver, a Research Security Analyst conducting initial open-source intelligence (OSINT) gathering.

---

### <Goal>

Using web search capabilities, investigate potential connections (e.g., documented cooperation, funding, joint projects, shared personnel, significant mentions linking them) between **Institution A** and each item in **Risk List C** within a specified time range.

Summarize key findings, identify any **potential intermediary organizations (B)** explicitly mentioned as linking **A** and **C**, and provide **source URLs**.
Treat **each item in List C individually** for investigation.

---

### <Information Gathering Strategy>

For each item in **Risk List C**:

* Formulate search queries combining **Institution A** ({Institution A}, {Location A}) with the specific risk item from List C.
* If time_range_start and time_range_end are provided, incorporate this date range into your search using Google's before: and after: filters or equivalent. **CRITICAL: When time range is specified, you MUST ONLY include information from within this exact time period. Events, publications, or relationships outside this range MUST BE EXCLUDED entirely from your analysis.**

Analyze results from:

* Reports, news, official sites, academic publications, or other public documents within the timeframe.
* Focus on **specific, verifiable connections**, not general background info.

Look for evidence of:

* **Direct Links**: Clear collaboration, joint funding, projects, or documented relationships.
* **Indirect Links**: A and C are both explicitly linked through **intermediary B** in a documented shared outcome.
* **Significant Mentions**: A and C are jointly discussed in a risk-related context, even without direct cooperation.

For **Potential B**, ensure:

* It is explicitly cited as facilitating the A–C connection.
* Mere co-membership in alliances or general funding from B is not sufficient unless a specific A–C project via B is described and sourced.

If credible evidence is found:

* Summarize the connection and assess reliability.
* **Avoid** irrelevant info like rankings or general institution pages unless they directly support a finding.

If no evidence is found:

* Clearly note that after thorough search within the range.

---

### <Input>

* **Institution A**: {Institution A}
* **Location A**: {Location A}
* **Risk List C**: {Risk List C}
* **Time Range Start**: {time_range_start}
* **Time Range End**: {time_range_end}

---

### <Output Instructions>

Output only a JSON list.

Each item in **Risk List C** must be a separate JSON object containing:

\`\`\`json
{
  "risk_item": "string",
  "institution_A": "string",
  "relationship_type": "string", // One of: "Direct", "Indirect", "Significant Mention", "Unknown", "No Evidence Found"
  "finding_summary": "string", // CRITICAL: Citations MUST match exactly with sources array positions
  "potential_intermediary_B": ["string"] | null, // Only if clearly described and cited.
  "sources": ["string"] // CRITICAL: Must contain exactly the same number of URLs as citations in finding_summary
}
\`\`\``;
    }
    /**
     * Build optimized user prompt with enhanced clarity
     */
    buildUserPrompt(request) {
        const timeRangeText = request.Start_Date && request.End_Date
            ? `Time Range: STRICTLY ${request.Start_Date} to ${request.End_Date}. Only include information from within this exact period.`
            : 'Time Range: No specific time constraints - include recent and historical connections.';
        const languageInstruction = this.getLanguageSearchInstruction(request.Location);
        return `I need you to investigate potential connections between the following institution and risk items:

**Institution A:** ${request.Target_institution}
**Location:** ${request.Location}
**Risk List C:** ${request.Risk_Entity}
**${timeRangeText}**

**SEARCH INSTRUCTIONS:**
${languageInstruction}

**ANALYSIS REQUIREMENTS:**
For risk item in Risk List C, investigate:
1. Direct connections (cooperation, projects, formal relationships)
2. Indirect connections (through intermediaries with specific A-C linkage)
3. Significant mentions (joint discussion in risk contexts)
4. Evidence quality and source reliability

**OUTPUT FORMAT:**
Return a JSON array with one object per risk entity. Each object must contain:
- risk_item: exact name from input list
- institution_A: exact institution name
- relationship_type: "Direct", "Indirect", "Significant Mention", "Unknown", or "No Evidence Found"
- finding_summary: detailed evidence-based analysis
- potential_intermediary_B: intermediary name(s) or null

**CRITICAL:**
- Search in both English AND native languages
- Focus search queries on the exact institution name provided
- Prioritize official sources: .gov, .edu, established news organizations
- Provide specific evidence for all claims
- If no evidence found: state "No Evidence Found"
- Exclude speculation and general background`;
    }
    /**
     * Get language-specific search instructions
     */
    getLanguageSearchInstruction(location) {
        const locationLower = location.toLowerCase();
        // Map locations to their native languages
        const languageMap = {
            'china': ['Chinese (中文)'],
            'germany': ['German (Deutsch)'],
            'france': ['French (Français)'],
            'japan': ['Japanese (日本語)'],
            'south korea': ['Korean (한국어)'],
            'russia': ['Russian (Русский)'],
            'spain': ['Spanish (Español)'],
            'italy': ['Italian (Italiano)'],
            'brazil': ['Portuguese (Português)'],
            'india': ['Hindi (हिन्दी)'],
            'israel': ['Hebrew (עברית)'],
            'saudi arabia': ['Arabic (العربية)'],
            'egypt': ['Arabic (العربية)'],
            'mexico': ['Spanish (Español)'],
            'argentina': ['Spanish (Español)'],
            'netherlands': ['Dutch (Nederlands)'],
            'sweden': ['Swedish (Svenska)'],
            'norway': ['Norwegian (Norsk)'],
            'denmark': ['Danish (Dansk)'],
            'finland': ['Finnish (Suomi)'],
            'poland': ['Polish (Polski)'],
            'turkey': ['Turkish (Türkçe)'],
            'iran': ['Persian (فارسی)'],
            'pakistan': ['Urdu (اردو)'],
            'bangladesh': ['Bengali (বাংলা)'],
            'vietnam': ['Vietnamese (Tiếng Việt)'],
            'thailand': ['Thai (ไทย)'],
            'indonesia': ['Indonesian (Bahasa Indonesia)'],
            'malaysia': ['Malay (Bahasa Melayu)'],
            'philippines': ['Filipino (Filipino)']
        };
        // Check for exact matches first
        for (const [country, languages] of Object.entries(languageMap)) {
            if (locationLower === country) {
                return `Search in ENGLISH and ${languages.join(' and ')}. Use search terms in both languages for comprehensive coverage.`;
            }
        }
        // Check for partial matches
        for (const [country, languages] of Object.entries(languageMap)) {
            if (locationLower.includes(country)) {
                return `Search in ENGLISH and ${languages.join(' and ')}. Use search terms in both languages for comprehensive coverage.`;
            }
        }
        // Default for worldwide or unrecognized locations
        return locationLower.includes('worldwide') || locationLower.includes('global')
            ? 'Search in ENGLISH only.'
            : 'Search in ENGLISH and the local language of the region. Research the primary language(s) spoken in this location and include search terms in those languages.';
    }
    /**
     * Build optimized Gemini API request body for enhanced grounding
     */
    buildOptimizedRequestBody(request) {
        return {
            system_instruction: {
                parts: [
                    {
                        text: this.buildOptimizedSystemInstruction()
                    }
                ]
            },
            contents: [
                {
                    parts: [
                        {
                            text: this.buildUserPrompt(request)
                        }
                    ]
                }
            ],
            generationConfig: {
                // CRITICAL: NO thinkingConfig - this enables grounding chunks
                temperature: 0.2,
                maxOutputTokens: 65536,
                topP: 0.95,
                topK: 10
            },
            tools: [
                {
                    google_search: {} // Latest tool format (underscore version)
                }
            ]
        };
    }
    /**
     * Clean JSON content from grounding support text
     */
    cleanGroundingSupportText(text) {
        if (!text || typeof text !== 'string') {
            return text;
        }
        // Check if text starts with JSON pattern
        const trimmedText = text.trim();
        // If it starts with "{" and contains "finding_summary", extract the finding_summary
        if (trimmedText.startsWith('{') && trimmedText.includes('"finding_summary"')) {
            try {
                // Try to parse as JSON
                const jsonData = JSON.parse(trimmedText);
                if (jsonData.finding_summary) {
                    console.log('🧹 [CLEAN] Extracted finding_summary from JSON:', {
                        originalLength: text.length,
                        extractedLength: jsonData.finding_summary.length,
                        preview: jsonData.finding_summary.substring(0, 100) + '...'
                    });
                    return jsonData.finding_summary;
                }
            }
            catch (error) {
                // If JSON parsing fails, check if it's a malformed JSON with finding_summary
                const findingSummaryMatch = trimmedText.match(/"finding_summary"\s*:\s*"([^"]+)"/);
                if (findingSummaryMatch && findingSummaryMatch[1]) {
                    console.log('🧹 [CLEAN] Extracted finding_summary from malformed JSON:', {
                        originalLength: text.length,
                        extractedLength: findingSummaryMatch[1].length,
                        preview: findingSummaryMatch[1].substring(0, 100) + '...'
                    });
                    return findingSummaryMatch[1];
                }
                console.warn('⚠️ [CLEAN] Failed to parse JSON, returning original text:', {
                    textPreview: text.substring(0, 100) + '...',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return text;
    }
    /**
     * Clean only the first grounding support from JSON contamination
     * DISABLED: Temporarily disabled for performance testing
     */
    cleanFirstGroundingSupport(groundingSupports) {
        // DISABLED: Direct return without any JSON processing to test performance
        return groundingSupports;
        /*
        if (!groundingSupports || !Array.isArray(groundingSupports) || groundingSupports.length === 0) {
          return groundingSupports;
        }
    
        console.log('🧹 [CLEAN] Processing first grounding support for JSON cleanup:', {
          totalSupports: groundingSupports.length
        });
    
        // Only process the first support for JSON cleanup
        const firstSupport = groundingSupports[0];
        if (firstSupport?.segment?.text) {
          const originalText = firstSupport.segment.text;
          const cleanedText = this.cleanGroundingSupportText(originalText);
    
          const wasCleaned = originalText !== cleanedText;
          if (wasCleaned) {
            console.log('🧹 [CLEAN] Cleaned first support:', {
              originalLength: originalText.length,
              cleanedLength: cleanedText.length,
              lengthReduction: originalText.length - cleanedText.length,
              originalPreview: originalText.substring(0, 50) + '...',
              cleanedPreview: cleanedText.substring(0, 50) + '...'
            });
    
            // Return array with cleaned first support and unchanged others
            return [
              {
                ...firstSupport,
                segment: {
                  ...firstSupport.segment,
                  text: cleanedText
                }
              },
              ...groundingSupports.slice(1)
            ];
          }
        }
    
        // If no cleaning needed, return original array
        return groundingSupports;
        */
    }
    /**
     * Extract grounding metadata from Gemini response
     */
    extractGroundingMetadata(response) {
        const candidate = response?.candidates?.[0];
        const groundingMetadata = candidate?.groundingMetadata;
        const rawSupports = groundingMetadata?.groundingSupports || [];
        const cleanedSupports = this.cleanFirstGroundingSupport(rawSupports);
        return {
            has_grounding: !!groundingMetadata,
            grounding_chunks: groundingMetadata?.groundingChunks || [],
            grounding_supports: cleanedSupports,
            web_search_queries: groundingMetadata?.webSearchQueries || []
        };
    }
    /**
     * Process grounding chunks into sources
     */
    processGroundingChunks(groundingChunks) {
        return groundingChunks.map((chunk, index) => ({
            title: chunk.web?.title || 'Unknown Source',
            url: chunk.web?.uri || '',
            chunk_index: index
        }));
    }
    /**
     * Map evidence to sources using groundingChunkIndices
     */
    mapEvidenceToSources(groundingSupports, relevantChunkIndices) {
        return groundingSupports
            .filter((support) => support.groundingChunkIndices?.some((index) => relevantChunkIndices.has(index)))
            .map((support) => ({
            text: support.segment.text,
            source_indices: support.groundingChunkIndices || []
        }));
    }
    /**
     * Build enhanced response with grounding metadata
     * Optimized: Skip key_evidence and sources processing (frontend no longer uses these)
     */
    buildEnhancedResponse(parsedFindings, groundingMetadata, searchQueries, executionTimeMs) {
        // Build enhanced findings without redundant key_evidence and sources
        const enhancedFindings = parsedFindings.map((finding, findingIndex) => {
            return {
                ...finding,
                // Skip key_evidence processing - frontend uses inline citations instead
                key_evidence: [],
                // Skip sources processing - frontend uses grounding metadata instead
                sources: [],
                search_queries: searchQueries,
                quality_metrics: {
                    evidence_count: 0,
                    source_count: 0,
                    coverage_percentage: 0
                }
            };
        });
        return enhancedFindings;
    }
    /**
     * Extract text content from Gemini response
     */
    extractTextFromResponse(response) {
        try {
            const candidates = response?.candidates;
            if (candidates && Array.isArray(candidates) && candidates.length > 0) {
                const content = candidates[0]?.content;
                if (content && content.parts && Array.isArray(content.parts)) {
                    // Merge all text fields
                    let allTextContent = '';
                    for (const part of content.parts) {
                        if (part && part.text) {
                            allTextContent += part.text;
                        }
                    }
                    if (allTextContent) {
                        return allTextContent;
                    }
                }
            }
            return null;
        }
        catch (error) {
            console.error('Error extracting text from response:', error);
            return null;
        }
    }
    /**
     * Extract JSON from markdown or raw text
     */
    extractJsonFromText(text) {
        if (typeof text !== 'string') {
            return null;
        }
        // Find content between ```json and ```
        const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
            return jsonMatch[1].trim();
        }
        // Try to find direct JSON array or object
        const directJsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (directJsonMatch && directJsonMatch[1]) {
            return directJsonMatch[1].trim();
        }
        return text;
    }
    /**
     * Clean JSON string from control characters and formatting issues
     */
    cleanJsonString(str) {
        if (typeof str !== 'string') {
            return str;
        }
        return str
            // Remove control characters (ASCII 0-31, except \t \n \r)
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            // Clean extra backslashes
            .replace(/\\\\/g, '\\')
            // Fix line breaks
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            // Remove zero-width characters
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            // Remove other invisible characters
            .replace(/[\u2028\u2029]/g, '');
    }
    /**
     * Apply formatting to finding summary for better frontend display
     */
    formatFindingSummaryForDisplay(findingSummary) {
        try {
            if (!findingSummary || typeof findingSummary !== 'string') {
                return findingSummary;
            }
            // Define patterns for the 7 standard categories (both standard and alternative formats)
            const categoryPatterns = [
                /\(\d+\) \*\*Personnel.*?\*\*:/g,
                /\(\d+\) \*\*Projects.*?\*\*:/g,
                /\(\d+\) \*\*Publications.*?\*\*:/g,
                /\(\d+\) \*\*Events.*?\*\*:/g,
                /\(\d+\) \*\*Funding.*?\*\*:/g,
                /\(\d+\) \*\*Media.*?\*\*:/g,
                /\(\d+\) \*\*Organizations.*?\*\*:/g,
                /\(\d+\) Personnel Connections:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
                /\(\d+\) Joint Projects & Organizational Ties:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
                /\(\d+\) Publications:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
                /\(\d+\) Events:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
                /\(\d+\) Funding:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
                /\(\d+\) Media & Significant Mentions:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g,
                /\(\d+\) Organizations:[\s\S]*?(?=\n\(\d+\) |\nIntermediary B:)/g
            ];
            // Add line breaks before each category
            let formattedSummary = findingSummary;
            categoryPatterns.forEach(pattern => {
                formattedSummary = formattedSummary.replace(pattern, '\n\n$&');
            });
            return formattedSummary;
        }
        catch (error) {
            console.error('Error formatting finding summary:', error);
            return findingSummary;
        }
    }
    /**
     * Parse JSON response with error handling
     */
    parseJsonResponse(textContent) {
        try {
            const jsonContent = this.extractJsonFromText(textContent);
            if (!jsonContent) {
                console.error('No JSON content found in text');
                return null;
            }
            const cleanedString = this.cleanJsonString(jsonContent);
            const parsed = JSON.parse(cleanedString);
            let results;
            if (Array.isArray(parsed)) {
                results = parsed;
            }
            else if (typeof parsed === 'object' && parsed !== null) {
                results = [parsed];
            }
            else {
                return null;
            }
            // Apply formatting to finding summaries for better display
            results.forEach(result => {
                if (result.finding_summary) {
                    result.finding_summary = this.formatFindingSummaryForDisplay(result.finding_summary);
                }
            });
            return results;
        }
        catch (error) {
            console.error('JSON parsing error:', error);
            console.error('Text content:', textContent.substring(0, 500));
            return null;
        }
    }
    /**
     * Execute enhanced normal search with grounding metadata
     */
    async executeEnhancedNormalSearch(request) {
        const startTime = Date.now();
        FeatureFlags_1.FeatureFlags.setCurrentRequest(request);
        FeatureFlags_1.FeatureFlags.log('Starting enhanced normal search', 'info', {
            institution: request.Target_institution,
            riskEntity: request.Risk_Entity,
            location: request.Location
        });
        try {
            const requestBody = this.buildOptimizedRequestBody(request);
            FeatureFlags_1.FeatureFlags.log('Built optimized API request', 'debug', {
                system_instruction: 'optimized_grounding',
                tool_format: 'google_search',
                thinking_config: 'disabled'
            });
            const response = await axios_1.default.post(this.apiUrl, requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                },
                params: {
                    key: this.apiKey
                },
                timeout: 180000 // 3 minutes timeout
            });
            // TEMP: Save raw Gemini response for analysis
            const fs = require('fs');
            const path = require('path');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rawResponsePath = path.join('/Users/kanbei/Code/chainreactions_backend/test', `gemini_raw_response_${timestamp}.json`);
            try {
                fs.writeFileSync(rawResponsePath, JSON.stringify({
                    timestamp: new Date().toISOString(),
                    request: {
                        url: this.apiUrl,
                        requestBody: requestBody,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        params: {
                            key: `${this.apiKey.substring(0, 20)}...`
                        },
                        timeout: 180000
                    },
                    response: {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                        data: response.data
                    },
                    executionTime: Date.now() - startTime
                }, null, 2));
                console.log(`📝 Raw Gemini response saved to: ${rawResponsePath}`);
            }
            catch (error) {
                console.error('Failed to save raw response:', error);
            }
            const executionTime = Date.now() - startTime;
            const textContent = this.extractTextFromResponse(response.data);
            if (!textContent) {
                throw new Error('Failed to extract text content from Gemini response');
            }
            FeatureFlags_1.FeatureFlags.log('Extracted text content', 'debug', {
                contentLength: textContent.length,
                executionTime: executionTime
            });
            // Extract grounding metadata
            const groundingMetadata = this.extractGroundingMetadata(response.data);
            // Enhanced debugging for grounding metadata
            FeatureFlags_1.FeatureFlags.log('Grounding metadata analysis', 'debug', {
                hasGrounding: groundingMetadata.has_grounding,
                chunksCount: groundingMetadata.grounding_chunks.length,
                supportsCount: groundingMetadata.grounding_supports.length,
                searchQueriesCount: groundingMetadata.web_search_queries.length,
                chunksSample: groundingMetadata.grounding_chunks.slice(0, 2),
                supportsSample: groundingMetadata.grounding_supports.slice(0, 2)
            });
            // Parse findings from JSON
            const parsedFindings = this.parseJsonResponse(textContent);
            if (!parsedFindings || parsedFindings.length === 0) {
                FeatureFlags_1.FeatureFlags.log('No results parsed from Gemini response', 'warn');
                return {
                    results: [],
                    enhanced_mode: true
                };
            }
            // Validate parsed findings
            const validationResult = this.validateParsedFindings(parsedFindings, request);
            FeatureFlags_1.FeatureFlags.log('Findings validation result', validationResult.isValid ? 'info' : 'warn', validationResult);
            if (!validationResult.isValid) {
                FeatureFlags_1.FeatureFlags.log('Invalid findings detected, attempting recovery', 'warn');
                // Try to recover or fix common issues
                const recoveredFindings = this.recoverFindings(parsedFindings, validationResult.errors);
                if (recoveredFindings.length > 0) {
                    parsedFindings.length = 0;
                    parsedFindings.push(...recoveredFindings);
                    FeatureFlags_1.FeatureFlags.log('Successfully recovered findings', 'info', { recoveredCount: recoveredFindings.length });
                }
            }
            // Build enhanced response with grounding
            const enhancedResults = this.buildEnhancedResponse(parsedFindings, groundingMetadata, groundingMetadata.web_search_queries, executionTime);
            // Validate enhanced results
            const enhancedValidation = this.validateEnhancedResults(enhancedResults, groundingMetadata);
            FeatureFlags_1.FeatureFlags.log('Enhanced results validation', enhancedValidation.isValid ? 'info' : 'warn', enhancedValidation);
            // Calculate grounding metrics
            const groundingMetrics = FeatureFlags_1.FeatureFlags.calculateGroundingMetrics(groundingMetadata.grounding_chunks, groundingMetadata.grounding_supports, executionTime);
            FeatureFlags_1.FeatureFlags.logGroundingMetrics(groundingMetrics, request);
            // Check if metrics meet quality thresholds
            const meetsThresholds = FeatureFlags_1.FeatureFlags.meetsQualityThresholds(groundingMetrics);
            FeatureFlags_1.FeatureFlags.log('Quality threshold check', meetsThresholds ? 'info' : 'warn', {
                meetsThresholds,
                metrics: groundingMetrics
            });
            FeatureFlags_1.FeatureFlags.log('Enhanced search completed successfully', 'info', {
                resultsCount: enhancedResults.length,
                sourcesCount: groundingMetadata.grounding_chunks.length,
                evidenceCount: groundingMetadata.grounding_supports.length,
                executionTime
            });
            return {
                results: enhancedResults,
                grounding_metadata: groundingMetadata,
                grounding_metrics: groundingMetrics,
                enhanced_mode: true
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            FeatureFlags_1.FeatureFlags.log('Enhanced search failed', 'error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime
            });
            if (axios_1.default.isAxiosError(error)) {
                FeatureFlags_1.FeatureFlags.log('Gemini API Error', 'error', {
                    status: error.response?.status,
                    data: error.response?.data
                });
                throw new Error(`Gemini API request failed: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Execute search (main entry point) - uses enhanced grounding mode
     */
    async executeSearch(request) {
        const enhancedResponse = await this.executeEnhancedNormalSearch(request);
        // Convert enhanced response format to include all grounding data
        return {
            results: enhancedResponse.results.map(result => ({
                risk_item: result.risk_item,
                institution_A: result.institution_A,
                relationship_type: result.relationship_type,
                finding_summary: result.finding_summary,
                potential_intermediary_B: result.potential_intermediary_B,
                sources: result.sources?.map(s => s.url) || [],
                // Include enhanced data
                key_evidence: result.key_evidence,
                enhanced_sources: result.sources,
                search_queries: result.search_queries,
                quality_metrics: result.quality_metrics,
                // Include grounding metadata for positional citations
                grounding_metadata: enhancedResponse.grounding_metadata
            }))
        };
    }
    /**
     * Extract ALL evidence for a specific finding from grounding supports
     * Following "complete trust in Gemini" strategy - preserve all original data
     */
    findRelevantEvidenceForFinding(finding, groundingSupports, chunkIndexToSourceIndex, sources) {
        const allEvidence = [];
        groundingSupports.forEach((support, supportIndex) => {
            if (!support.segment?.text || !support.groundingChunkIndices?.length) {
                return;
            }
            // NO FILTERING - preserve all groundingSupports as provided by Gemini
            const evidenceText = support.segment.text;
            // Convert chunk indices to source indices (1-based for frontend)
            const sourceIndices = support.groundingChunkIndices
                .map((chunkIndex) => chunkIndexToSourceIndex.get(chunkIndex))
                .filter((index) => index !== undefined)
                .map((index) => index + 1); // Convert to 1-based indexing
            if (sourceIndices.length > 0) {
                allEvidence.push({
                    text: evidenceText,
                    source_indices: sourceIndices
                });
            }
        });
        // NO SORTING, NO LIMITING - return all evidence in original order
        return allEvidence;
    }
    /**
     * Find sources that are relevant to a specific finding
     */
    findRelevantSourcesForFinding(finding, findingEvidence, sources) {
        // Get unique source indices from evidence
        const relevantSourceIndices = new Set();
        findingEvidence.forEach(evidence => {
            evidence.source_indices.forEach(index => {
                relevantSourceIndices.add(index - 1); // Convert back to 0-based for internal use
            });
        });
        // Return only sources that are referenced in evidence
        return sources.filter((source, index) => relevantSourceIndices.has(index));
    }
    /**
     * Calculate coverage percentage
     */
    calculateCoveragePercentage(findingEvidence, groundingSupports) {
        if (groundingSupports.length === 0)
            return 0;
        const evidenceTexts = new Set(findingEvidence.map(e => e.text));
        const totalSupports = groundingSupports.length;
        return totalSupports > 0 ? (evidenceTexts.size / totalSupports) * 100 : 0;
    }
    /**
     * Validate parsed findings for common issues
     */
    validateParsedFindings(findings, request) {
        const errors = [];
        const warnings = [];
        if (!Array.isArray(findings)) {
            errors.push('Findings is not an array');
            return { isValid: false, errors, warnings };
        }
        findings.forEach((finding, index) => {
            // Check required fields
            if (!finding.risk_item || typeof finding.risk_item !== 'string') {
                errors.push(`Finding ${index}: Missing or invalid risk_item`);
            }
            if (!finding.institution_A || typeof finding.institution_A !== 'string') {
                errors.push(`Finding ${index}: Missing or invalid institution_A`);
            }
            if (!finding.relationship_type || typeof finding.relationship_type !== 'string') {
                errors.push(`Finding ${index}: Missing or invalid relationship_type`);
            }
            else {
                const validTypes = ['Direct', 'Indirect', 'Significant Mention', 'Unknown', 'No Evidence Found'];
                if (!validTypes.includes(finding.relationship_type)) {
                    errors.push(`Finding ${index}: Invalid relationship_type: ${finding.relationship_type}`);
                }
            }
            if (!finding.finding_summary || typeof finding.finding_summary !== 'string') {
                errors.push(`Finding ${index}: Missing or invalid finding_summary`);
            }
            // Check for quality issues
            if (finding.finding_summary && finding.finding_summary.length < 50) {
                warnings.push(`Finding ${index}: Very short finding_summary (${finding.finding_summary.length} characters)`);
            }
            if (finding.finding_summary && finding.finding_summary.length > 2000) {
                warnings.push(`Finding ${index}: Very long finding_summary (${finding.finding_summary.length} characters)`);
            }
            // Check for placeholder text
            const placeholderPatterns = [
                /not specified/i,
                /no information/i,
                /unknown/i,
                /to be determined/i,
                /N\/A/i,
                /null/i
            ];
            placeholderPatterns.forEach(pattern => {
                if (finding.finding_summary && pattern.test(finding.finding_summary)) {
                    warnings.push(`Finding ${index}: Contains placeholder text: ${pattern.source}`);
                }
            });
        });
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Recover findings from common parsing issues
     */
    recoverFindings(findings, errors) {
        const recovered = [];
        findings.forEach((finding, index) => {
            try {
                // Create a clean copy
                const cleanFinding = { ...finding };
                // Fix common issues
                if (!cleanFinding.risk_item && errors.some(e => e.includes(`Finding ${index}: Missing or invalid risk_item`))) {
                    cleanFinding.risk_item = 'Unknown Risk Item';
                }
                if (!cleanFinding.institution_A && errors.some(e => e.includes(`Finding ${index}: Missing or invalid institution_A`))) {
                    cleanFinding.institution_A = 'Unknown Institution';
                }
                if (!cleanFinding.relationship_type && errors.some(e => e.includes(`Finding ${index}: Missing or invalid relationship_type`))) {
                    cleanFinding.relationship_type = 'Unknown';
                }
                if (!cleanFinding.finding_summary && errors.some(e => e.includes(`Finding ${index}: Missing or invalid finding_summary`))) {
                    cleanFinding.finding_summary = 'No detailed analysis available due to parsing issues.';
                }
                // Fix relationship_type values
                const validTypes = ['Direct', 'Indirect', 'Significant Mention', 'Unknown', 'No Evidence Found'];
                if (!validTypes.includes(cleanFinding.relationship_type)) {
                    cleanFinding.relationship_type = 'Unknown';
                }
                // Only add if it has minimal required fields
                if (cleanFinding.risk_item && cleanFinding.institution_A && cleanFinding.finding_summary) {
                    recovered.push(cleanFinding);
                }
            }
            catch (error) {
                // Skip this finding if recovery fails
                console.warn(`Failed to recover finding ${index}:`, error);
            }
        });
        return recovered;
    }
    /**
     * Validate enhanced results for consistency and quality
     * Optimized: Simplified validation for streamlined data structure
     */
    validateEnhancedResults(results, groundingMetadata) {
        const errors = [];
        const warnings = [];
        let metrics = {};
        // Basic validation
        if (!Array.isArray(results) || results.length === 0) {
            errors.push('No enhanced results to validate');
            return { isValid: false, errors, warnings, metrics };
        }
        // Check grounding metadata availability (key for inline citations)
        const groundingChunksCount = groundingMetadata.grounding_chunks.length;
        const groundingSupportsCount = groundingMetadata.grounding_supports.length;
        // Validate finding summary content
        results.forEach((result, index) => {
            if (!result.finding_summary || result.finding_summary.trim().length === 0) {
                errors.push(`Result ${index}: Empty finding summary`);
            }
            // Check for valid relationship type
            if (!result.relationship_type || result.relationship_type.trim().length === 0) {
                warnings.push(`Result ${index}: Missing relationship type`);
            }
        });
        metrics = {
            totalResults: results.length,
            groundingChunksCount,
            groundingSupportsCount,
            evidenceCoverage: groundingSupportsCount > 0 && groundingChunksCount > 0 ?
                (groundingSupportsCount / groundingChunksCount) * 100 : 0
        };
        // Check grounding metadata quality
        if (groundingChunksCount === 0) {
            warnings.push('No grounding chunks available for citations');
        }
        if (groundingSupportsCount === 0) {
            warnings.push('No grounding supports available for citations');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metrics
        };
    }
}
exports.GeminiDeepThinkingService = GeminiDeepThinkingService;
