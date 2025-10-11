import { GeminiResponse, GeminiGenerationConfig, GeminiTool, GeminiSystemInstruction } from '../../types/gemini';
export declare class GeminiService {
    private apiClient;
    private apiKey;
    private model;
    constructor();
    generateContent(contents: {
        role?: string;
        parts: {
            text: string;
        }[];
    }[], systemInstruction?: GeminiSystemInstruction, tools?: GeminiTool[], generationConfig?: GeminiGenerationConfig): Promise<GeminiResponse>;
    generateSearchContent(prompt: string, systemInstruction?: string): Promise<GeminiResponse>;
    verifyCompanyEntity(companyName: string, location: string, targetInstitution?: string): Promise<any>;
}
//# sourceMappingURL=GeminiService.d.ts.map