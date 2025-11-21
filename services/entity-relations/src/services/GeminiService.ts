import axios, { AxiosInstance } from 'axios';
import {
  GeminiRequest,
  GeminiResponse,
  GeminiGenerationConfig,
  GeminiTool,
  GeminiSystemInstruction
} from '../types/gemini';

export class GeminiService {
  private apiClient: AxiosInstance;
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.apiClient = axios.create({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      timeout: parseInt(process.env.API_TIMEOUT || '30000'),
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': this.apiKey,
      },
    });
  }

  async generateContent(
    contents: { role?: string; parts: { text: string }[] }[],
    systemInstruction?: GeminiSystemInstruction,
    tools?: GeminiTool[],
    generationConfig?: GeminiGenerationConfig
  ): Promise<GeminiResponse> {
    try {
      const request: GeminiRequest = {
        contents: contents.map(content => ({
          parts: content.parts,
          role: content.role
        })),
      };

      if (systemInstruction) {
        request.system_instruction = systemInstruction;
      }

      if (tools && tools.length > 0) {
        request.tools = tools;
      }

      if (generationConfig) {
        request.generationConfig = generationConfig;
      }

      // Add retry logic for 502 errors
      let lastError: any = null;
      const maxRetries = 3;

      const startTime = Date.now();
      let success = false;
      let errorType: string | undefined;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.apiClient.post<GeminiResponse>(
            `/models/${this.model}:generateContent`,
            request
          );

          success = true;
          const responseTime = Date.now() - startTime;

  
          return response.data;
        } catch (error) {
          lastError = error;

          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.response?.data?.error?.message || error.message;

            // 记录错误类型
            if (status === 429) {
              errorType = 'RATE_LIMIT';
            } else if (status === 502) {
              errorType = 'BAD_GATEWAY';
            } else if (status === 503) {
              errorType = 'SERVICE_UNAVAILABLE';
            } else {
              errorType = `HTTP_${status}`;
            }

            // For 502 errors, retry with exponential backoff
            if (status === 502 && attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
              console.warn(`🔄 Gemini API 502 error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }

            throw new Error(`Gemini API Error (${status}): ${message}`);
          }
          throw error;
        }
      }

  
      throw lastError;
    } catch (error) {
      throw error;
    }
  }

  async generateSearchContent(
    prompt: string,
    systemInstruction?: string
  ): Promise<GeminiResponse> {
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ];

    const systemInstructionObj = systemInstruction ? {
      parts: [{ text: systemInstruction }]
    } : undefined;

    const tools: GeminiTool[] = [
      { googleSearch: {} },
      { codeExecution: {} }
    ];

    const generationConfig: GeminiGenerationConfig = {
      temperature: 0.1,
      maxOutputTokens: 65536,
      topP: 0.95,
      topK: 10,
      thinkingConfig: {
        thinkingBudget: 16384
      }
    };

    return this.generateContent(contents, systemInstructionObj, tools, generationConfig);
  }

  async verifyCompanyEntity(
    companyName: string,
    location: string,
    targetInstitution?: string,
    timeRange?: { start?: string; end?: string }
  ): Promise<any> {
    const companyA = companyName;
    const companyB = targetInstitution || 'Unknown';

    // Fallback location if empty
    const effectiveLocation = location && location.trim() !== '' ? location : 'Global';

    console.log('🌍 Location processing:', {
      originalLocation: location,
      locationType: typeof location,
      locationTrimmed: location?.trim(),
      effectiveLocation,
      isConverted: effectiveLocation !== location
    });

      const userPrompt = `I need you to investigate potential connections between the following institution and risk items: Institution A: ${companyB} Location: ${effectiveLocation} Risk List C: ["${companyA}"]. For each risk item, please analyze any direct or indirect connections, or significant mentions linking them with the institution.IMPORTANT INSTRUCTION:  You MUST search for each item in BOTH English AND the native language of ${effectiveLocation}. For example, if the country is "China", search using both English terms AND Chinese terms. If the country is "Germany", search using both English terms AND German terms. If the country is "Worldwide", search using English terms. ${timeRange && (timeRange.start || timeRange.end) ? `Time Range: ${timeRange.start || 'Not specified'} to ${timeRange.end || 'Not specified'}` : 'Time Range: Not specified'}.`;

    console.log(`🔍 Verifying entities: ${companyA} vs ${companyB} in ${effectiveLocation}`);

    try {
        const systemInstruction = {
        parts: [{
          text: `## Prompt: OSINT Research on Institutional Risk Links

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
\`\`\``
        }]
      };

      const startTime = Date.now();
      console.log(`⏱️ Starting Gemini API call with googleSearch tool...`);

      const response = await this.generateContent(
        [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction,
        [
        {
          codeExecution: {}
        },
        {
          googleSearch: {}
        }
      ],
        {
        "thinkingConfig": {
          "thinkingBudget": 12000
        },
        "temperature": 0.2,
        "maxOutputTokens": 65536,
        "topP": 0.95,
        "topK": 10
      }
      );

      const elapsedTime = Date.now() - startTime;
      console.log(`✅ Gemini API responded in ${elapsedTime}ms`);

      // Save raw Gemini response for analysis (same as GeminiNormalSearchService)
      const fs = require('fs');
      const path = require('path');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rawResponsePath = path.join('/Users/kanbei/Code/chainreactions_backend/test', `gemini_raw_response_${timestamp}.json`);

      try {
        // Create the test directory if it doesn't exist
        if (!fs.existsSync('/Users/kanbei/Code/chainreactions_backend/test')) {
          fs.mkdirSync('/Users/kanbei/Code/chainreactions_backend/test', { recursive: true });
        }

        fs.writeFileSync(rawResponsePath, JSON.stringify({
          timestamp: new Date().toISOString(),
          request: {
            url: this.generateContent.toString().includes('generativelanguage.googleapis.com') ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent' : 'Unknown',
            requestBody: {
              systemInstruction: systemInstruction,
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: {
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
            },
            headers: {
              'Content-Type': 'application/json'
            },
            params: {
              key: `${this.apiKey ? this.apiKey.substring(0, 20) : 'ENV_VAR'}...`
            },
            timeout: 180000,
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
          },
          response: {
            status: 200,
            statusText: 'OK',
            data: response
          },
          executionTime: elapsedTime,
          service: 'GeminiService (Standard Search)'
        }, null, 2));
        console.log(`📝 Raw Gemini response saved to: ${rawResponsePath}`);
      } catch (error) {
        console.error('Failed to save raw response:', error);
      }

      // Log complete raw response structure for debugging
      console.log('=== GEMINI API RAW RESPONSE STRUCTURE ===');
      console.log('Response candidates:', response.candidates);
      console.log('Candidates length:', response.candidates?.length || 0);
      console.log('Usage metadata:', response.usageMetadata);
      console.log('Model version:', response.modelVersion);

      if (response.candidates && response.candidates.length > 0) {
        console.log('First candidate structure:', {
          content: response.candidates[0]?.content,
          finishReason: response.candidates[0]?.finishReason,
          index: response.candidates[0]?.index
        });

        if (response.candidates[0]?.content?.parts) {
          console.log('Parts structure:', response.candidates[0].content.parts);
          console.log('Parts length:', response.candidates[0].content.parts.length);

          // Log each part with details
          response.candidates[0].content.parts.forEach((part, index) => {
            console.log(`Part ${index}:`, {
              hasText: !!part.text,
              textLength: part.text?.length || 0,
              textPreview: part.text?.substring(0, 100) || 'NO TEXT',
              partKeys: Object.keys(part)
            });
          });
        }
      }
      console.log('=== END RAW RESPONSE STRUCTURE ===');

      // Find the part that contains text content (gemini-2.5-flash may return multiple parts)
      let resultText = null;

      if (response.candidates?.[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        // Look for the part that contains text
        const textPart = parts.find(part => part.text && part.text.trim().length > 0);
        resultText = textPart?.text || null;
      }
      if (!resultText) {
        console.error('❌ FAILED TO EXTRACT TEXT FROM RESPONSE');
        console.error('Response structure analysis:');
        console.error('- Has candidates:', !!response.candidates);
        console.error('- Candidates length:', response.candidates?.length || 0);
        if (response.candidates?.length > 0) {
          console.error('- First candidate has content:', !!response.candidates[0]?.content);
          console.error('- First candidate has parts:', !!response.candidates[0]?.content?.parts);
          console.error('- First candidate parts length:', response.candidates[0]?.content?.parts?.length || 0);
        }
        throw new Error('No response text from Gemini API');
      }

      console.log('=== GEMINI API RAW RESPONSE ===');
      console.log(resultText);
      console.log('=== END RAW RESPONSE ===');

      // Try to parse JSON response - handle markdown code blocks
      try {
        let jsonText = resultText.trim();

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        return JSON.parse(jsonText);
      } catch (parseError) {
        console.warn('Failed to parse JSON response, returning raw text:', resultText);
        return {
          raw_response: resultText,
          error: 'JSON parsing failed',
          original_name: 'Unknown',
          description: resultText.substring(0, 200) + '...' // Fallback data
        };
      }
    } catch (error) {
      console.error('Entity verification failed:', error);
      throw new Error(`Failed to verify entity ${companyName}: ${error}`);
    }
  }
}