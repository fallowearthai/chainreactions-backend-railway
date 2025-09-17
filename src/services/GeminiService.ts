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
        'x-goog-api-key': this.apiKey,
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

      const response = await this.apiClient.post<GeminiResponse>(
        `/models/${this.model}:generateContent`,
        request
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;

        throw new Error(`Gemini API Error (${status}): ${message}`);
      }
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
      temperature: 0.2,
      maxOutputTokens: 65536,
      topP: 0.95,
      topK: 10,
      thinkingConfig: {
        thinkingBudget: 12000
      }
    };

    return this.generateContent(contents, systemInstructionObj, tools, generationConfig);
  }

  async verifyCompanyEntity(companyName: string, location: string): Promise<any> {
    const prompt = `Act as a professional business intelligence analyst. Given a specific company name and address, your goal is to accurately identify the correct company entity. Search authoritative sources, including the official company website, government registries, reputable business directories, SEC filings, press releases, and partnership announcements. If multiple companies with similar or identical names are found, set 'similar_name_companies_exist' to true and provide a list of these entities with distinguishing details. For the identified company, return a JSON object with these fields: original_name (as registered), english_name, past_names (list of previous names), description (concise summary of main activities and industry in English), headquarters (full registered address), sectors (primary business sectors), similar_name_companies_exist (true/false). Ensure all data is current, accurate, and cite the source URL for each field. Format your response as a single, well-structured JSON object. Company_name = ${companyName}, Company_location = ${location}`;

    try {
      const response = await this.generateContent(
        [{ role: 'user', parts: [{ text: prompt }] }],
        undefined,
        [{ googleSearch: {} }],
        {
          temperature: 0.1,
          maxOutputTokens: 4096,
          thinkingConfig: {
            thinkingBudget: -1
          }
        }
      );

      const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!resultText) {
        throw new Error('No response text from Gemini API');
      }

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