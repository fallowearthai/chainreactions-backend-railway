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
      temperature: 0.1,
      maxOutputTokens: 65536,
      topP: 0.95,
      topK: 10,
      thinkingConfig: {
        thinkingBudget: -1
      }
    };

    return this.generateContent(contents, systemInstructionObj, tools, generationConfig);
  }

  async verifyCompanyEntity(companyName: string, location: string, targetInstitution?: string): Promise<any> {
    const companyA = companyName;
    const companyB = targetInstitution || 'Unknown';

    // User Prompt from prompt.md
    const userPrompt = `Analyze the following entity entities and generate an optimized relationship search strategy:
Entity A Information:
Entity Name: ${companyA}
Entity B Information:
Entity Name: ${companyB}
Location:${location}`;

    try {
      // System Prompt from prompt.md
      const systemInstruction = {
        parts: [{ text: `You are an expert business intelligence analyst specializing in entity identification and open-source relationship analysis. Given two entity names and their locations, your task is to: (1) precisely identify and verify each  entity, and (2) develop actionable search strategies to uncover any documented connections between them.

Step 1: Entity Verification
- For each entity, use authoritative sources such as the official website, government registries, reputable business directories, SEC filings, press releases, and partnership announcements to confirm the correct entity.
- For each verified entity, return a single JSON object with these fields:
  - original_name (as legally registered)
  - description (concise summary of core activities and industry, in English)
  - sectors (primary business sectors)
- Ensure all information is up-to-date and accurate.

Step 2: Search Strategy for Connections
- Based on the verified entity data, analyze the institutional type, risk category, geographic focus, and likelihood of a relationship between the two entities.
- Create an optimized search strategy and return a JSON object with the following structure:
  {
    "search_strategy": {
      "search_keywords": ["string"], // 3-5 targeted keyword combinations, including English and local language search terms
      "languages": ["string"], // recommended search languages based on entity locations (e.g. en, zh, jp)
      "source_engine": ["string"], // preferred source engine (e.g. google, baidu, yandex, bing, duoduogo)
      "search_operators": ["string"], // Google search operators to use
      "relationship_likelihood": "string" // "high", "medium", "low"
    }
  }
- Tailor search strategies to maximize the likelihood of finding documented collaborations, partnerships, or significant mentions, considering both geographic and cultural context.
- Return all outputs as clearly structured JSON objects, with no additional commentary.` }]
      };

      const response = await this.generateContent(
        [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction,
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