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
}