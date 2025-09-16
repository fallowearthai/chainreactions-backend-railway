import { PromptBuilder } from '../src/utils/promptBuilder';
import { SearchRequest } from '../src/types/gemini';

describe('PromptBuilder', () => {
  describe('buildSearchPrompt', () => {
    it('should build a basic search prompt without time range', () => {
      const request: SearchRequest = {
        Target_institution: 'Test Corp',
        Risk_Entity: 'Military,Technology',
        Location: 'China'
      };

      const prompt = PromptBuilder.buildSearchPrompt(request);

      expect(prompt).toContain('Test Corp');
      expect(prompt).toContain('Military');
      expect(prompt).toContain('Technology');
      expect(prompt).toContain('China');
      expect(prompt).toContain('BOTH English AND the native language of China');
      expect(prompt).toContain('Chinese terms');
    });

    it('should build a search prompt with time range', () => {
      const request: SearchRequest = {
        Target_institution: 'Test Corp',
        Risk_Entity: 'Military',
        Location: 'China',
        Start_Date: '2023-01',
        End_Date: '2024-12'
      };

      const prompt = PromptBuilder.buildSearchPrompt(request);

      expect(prompt).toContain('focusing STRICTLY on information within the specified time range 2023-01 to 2024-12');
    });

    it('should handle single risk entity', () => {
      const request: SearchRequest = {
        Target_institution: 'Test Corp',
        Risk_Entity: 'Military',
        Location: 'USA'
      };

      const prompt = PromptBuilder.buildSearchPrompt(request);

      expect(prompt).toContain('["Military"]');
      expect(prompt).toContain('English terms');
    });
  });

  describe('getSystemInstruction', () => {
    it('should return the complete system instruction', () => {
      const instruction = PromptBuilder.getSystemInstruction();

      expect(instruction).toContain('OSINT Research on Institutional Risk Links');
      expect(instruction).toContain('Research Security Analyst');
      expect(instruction).toContain('potential connections');
      expect(instruction).toContain('JSON list');
    });
  });

  describe('getLocationLanguage', () => {
    it('should return correct language for known locations', () => {
      expect(PromptBuilder.getLocationLanguage('China')).toBe('Chinese');
      expect(PromptBuilder.getLocationLanguage('Germany')).toBe('German');
      expect(PromptBuilder.getLocationLanguage('Japan')).toBe('Japanese');
      expect(PromptBuilder.getLocationLanguage('USA')).toBe('English');
    });

    it('should return English for unknown locations', () => {
      expect(PromptBuilder.getLocationLanguage('Unknown')).toBe('English');
      expect(PromptBuilder.getLocationLanguage('')).toBe('English');
    });

    it('should return English for worldwide', () => {
      expect(PromptBuilder.getLocationLanguage('Worldwide')).toBe('English');
    });
  });
});