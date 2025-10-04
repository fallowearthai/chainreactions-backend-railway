import axios from 'axios';
import {
  NormalSearchRequest,
  GeminiRequestBody,
  GeminiResponse,
  NormalSearchResult
} from '../types/gemini';

export class GeminiNormalSearchService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
  }

  /**
   * Build system instruction prompt for OSINT research
   */
  private buildSystemInstruction(): string {
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

* Formulate search queries combining **Institution A** (\`{Institution A}\`, \`{Location A}\`) with the specific risk item from List C.
* If \`time_range_start\` and \`time_range_end\` are provided, incorporate this date range into your search using Google's \`before:\` and \`after:\` filters or equivalent. **CRITICAL: When time range is specified, you MUST ONLY include information from within this exact time period. Events, publications, or relationships outside this range MUST BE EXCLUDED entirely from your analysis.**

Analyze results from:

* Reports, news, official sites, academic publications, or other public documents within the timeframe.
* Focus on **specific, verifiable connections**, not general background info.

Look for evidence of:

* **Direct Links**: Clear collaboration, joint funding, projects, or documented relationships.
* **Indirect Links**: A and C are both explicitly linked through **intermediary B** in a documented shared outcome.
* **Significant Mentions**: A and C are jointly discussed in a risk-related context, even without direct cooperation.

For **Potential B**, ensure:

* It is explicitly cited as facilitating the A–C connection.
* Mere co-membership in alliances or general funding from B is **not sufficient** unless a specific A–C project via B is described and sourced.

If credible evidence is found:

* Summarize the connection and assess reliability.
* **Avoid** irrelevant info like rankings or general institution pages unless they directly support a finding.

If no evidence is found:

* Clearly note that after thorough search within the range.

---

### <Input>

* **Institution A**: \`{Institution A}\`
* **Location A**: \`{Location A}\`
* **Risk List C**: \`{List C}\`  // Example: ["Military", "Specific Org X", "Technology Y"]
* **Time Range Start**: \`{time_range_start}\`  // Optional, format: "YYYY-MM"
* **Time Range End**: \`{time_range_end}\`  // Optional, format: "YYYY-MM"

---

### <Output Instructions>

Output **only** a JSON list.

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
   * Build user prompt with search parameters
   */
  private buildUserPrompt(request: NormalSearchRequest): string {
    const timeRangeText = request.Start_Date && request.End_Date
      ? `focusing STRICTLY on information within the specified time range ${request.Start_Date} to ${request.End_Date}`
      : '';

    return `I need you to investigate potential connections between the following institution and risk items: Institution A: ${request.Target_institution} Location: ${request.Location} Risk List C: ${request.Risk_Entity}. For each risk item, please analyze any direct or indirect connections, or significant mentions linking them with the institution.IMPORTANT INSTRUCTION:  You MUST search for each item in BOTH English AND the native language of ${request.Location}. For example, if the country is "China", search using both English terms AND Chinese terms. If the country is "Germany", search using both English terms AND German terms. If the country is "Worldwide", search using English terms. ${timeRangeText}.`;
  }

  /**
   * Build Gemini API request body
   */
  private buildRequestBody(request: NormalSearchRequest): GeminiRequestBody {
    return {
      system_instruction: {
        parts: [
          {
            text: this.buildSystemInstruction()
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
        thinkingConfig: {
          thinkingBudget: 6000  // Reduced for faster processing (was 12000)
        },
        temperature: 0.2,
        maxOutputTokens: 65536,
        topP: 0.95,
        topK: 10
      },
      tools: [
        {
          codeExecution: {}
        },
        {
          googleSearch: {}
        }
      ]
    };
  }

  /**
   * Extract text content from Gemini response
   */
  private extractTextFromResponse(response: GeminiResponse): string | null {
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
    } catch (error) {
      console.error('Error extracting text from response:', error);
      return null;
    }
  }

  /**
   * Extract JSON from markdown or raw text
   */
  private extractJsonFromText(text: string): string | null {
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
  private cleanJsonString(str: string): string {
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
   * Parse JSON response with error handling
   */
  private parseJsonResponse(textContent: string): NormalSearchResult[] | null {
    try {
      const jsonContent = this.extractJsonFromText(textContent);
      if (!jsonContent) {
        console.error('No JSON content found in text');
        return null;
      }

      const cleanedString = this.cleanJsonString(jsonContent);
      const parsed = JSON.parse(cleanedString);

      if (Array.isArray(parsed)) {
        return parsed as NormalSearchResult[];
      } else if (typeof parsed === 'object' && parsed !== null) {
        return [parsed] as NormalSearchResult[];
      }

      return null;
    } catch (error) {
      console.error('JSON parsing error:', error);
      console.error('Text content:', textContent.substring(0, 500));
      return null;
    }
  }

  /**
   * Extract grounding metadata from Gemini response
   */
  private extractGroundingMetadata(response: GeminiResponse) {
    try {
      const candidate = response?.candidates?.[0];
      return {
        renderedContent: candidate?.groundingMetadata?.searchEntryPoint?.renderedContent,
        webSearchQueries: candidate?.groundingMetadata?.webSearchQueries || []
      };
    } catch (error) {
      return {
        renderedContent: undefined,
        webSearchQueries: []
      };
    }
  }

  /**
   * Execute normal search using Gemini API with Google Search tools
   */
  async executeNormalSearch(request: NormalSearchRequest): Promise<{
    results: NormalSearchResult[];
    metadata: {
      renderedContent?: string;
      webSearchQueries: string[];
    };
  }> {
    try {
      const requestBody = this.buildRequestBody(request);

      console.log('🔍 Executing Gemini Normal Search...');
      console.log('Target Institution:', request.Target_institution);
      console.log('Risk Entity:', request.Risk_Entity);
      console.log('Location:', request.Location);

      const response = await axios.post<GeminiResponse>(
        this.apiUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          params: {
            key: this.apiKey
          },
          timeout: 180000 // 3 minutes timeout (increased for complex searches)
        }
      );

      const textContent = this.extractTextFromResponse(response.data);
      if (!textContent) {
        throw new Error('Failed to extract text content from Gemini response');
      }

      console.log('📝 Extracted text content length:', textContent.length);

      const results = this.parseJsonResponse(textContent);
      if (!results || results.length === 0) {
        console.warn('⚠️ No results parsed from Gemini response');
        return {
          results: [],
          metadata: this.extractGroundingMetadata(response.data)
        };
      }

      console.log('✅ Successfully parsed', results.length, 'search results');

      return {
        results,
        metadata: this.extractGroundingMetadata(response.data)
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Gemini API Error:', error.response?.data || error.message);
        throw new Error(`Gemini API request failed: ${error.message}`);
      }
      throw error;
    }
  }
}
