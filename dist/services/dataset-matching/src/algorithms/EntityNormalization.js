"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityNormalization = void 0;
class EntityNormalization {
    /**
     * Extract bracketed content and abbreviations from text
     */
    static extractBracketedContent(text) {
        if (!text)
            return { main: '', bracketed: [], abbreviations: [] };
        const bracketed = [];
        const abbreviations = [];
        // Extract content in parentheses
        const parenthesesMatches = text.match(/\(([^)]+)\)/g);
        if (parenthesesMatches) {
            parenthesesMatches.forEach(match => {
                const content = match.replace(/[()]/g, '').trim();
                bracketed.push(content);
                // Check if it's likely an abbreviation (all caps, 2-8 characters)
                if (/^[A-Z]{2,8}$/.test(content)) {
                    abbreviations.push(content);
                }
            });
        }
        // Remove parentheses for main text
        const main = text.replace(/\s*\([^)]*\)/g, '').trim();
        return { main, bracketed, abbreviations };
    }
    /**
     * Generate abbreviation from text
     */
    static generateAbbreviation(text) {
        if (!text)
            return '';
        const words = text
            .trim()
            .split(/\s+/)
            .filter(word => word.length > 0 &&
            !this.STOP_WORDS.has(word.toLowerCase()) &&
            !this.GENERIC_TERMS.has(word.toLowerCase()));
        if (words.length < 2 || words.length > 6)
            return '';
        return words
            .map(word => word.charAt(0).toUpperCase())
            .join('');
    }
    /**
     * Normalize text for matching purposes with enhanced bracketed content handling
     */
    static normalizeText(text) {
        if (!text)
            return '';
        return text
            .toLowerCase()
            .trim()
            // Remove parentheses and their contents for base normalization
            .replace(/\s*\([^)]*\)/g, '')
            // Remove common organizational suffixes/prefixes
            .replace(/\b(university of|institute of|center for|centre for|the|inc|ltd|llc|corp|corporation|company|co|limited)\b/g, '')
            // Remove special characters and normalize spacing
            .replace(/[^\w\s]/g, ' ')
            // Replace multiple spaces with single space
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Create a core version of the text by removing even more organizational elements
     */
    static getCoreText(text) {
        let core = this.normalizeText(text);
        // Remove more organizational terms for core matching
        const orgPattern = Array.from(this.ORG_SUFFIXES).join('|');
        const regex = new RegExp(`\\b(${orgPattern})\\b`, 'gi');
        core = core
            .replace(regex, '')
            .replace(/\s+/g, ' ')
            .trim();
        return core;
    }
    /**
     * Calculate specificity score for a term (higher = more specific)
     */
    static getSpecificityScore(text) {
        if (!text)
            return 0;
        const normalized = text.toLowerCase().trim();
        const words = normalized.split(/\s+/).filter(word => word.length > 0);
        if (words.length === 0)
            return 0;
        // Base score from word count (more words = more specific)
        let score = Math.min(words.length * 0.2, 1.0);
        // Penalty for generic terms
        const genericWordCount = words.filter(word => this.GENERIC_TERMS.has(word)).length;
        const genericPenalty = (genericWordCount / words.length) * 0.7;
        score -= genericPenalty;
        // Bonus for longer terms
        const lengthBonus = Math.min(normalized.length / 50, 0.3);
        score += lengthBonus;
        // Bonus for having numbers or special formatting indicators
        if (/\d/.test(normalized) || /[.-]/.test(normalized)) {
            score += 0.1;
        }
        // Penalty for very short terms
        if (normalized.length < 5) {
            score *= 0.5;
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Generate comprehensive search variations from the input text
     */
    static generateSearchVariations(searchText) {
        const variations = new Set();
        // Add original text
        variations.add(searchText);
        // Extract bracketed content and abbreviations
        const { main, bracketed, abbreviations } = this.extractBracketedContent(searchText);
        // Add main text without brackets
        if (main && main !== searchText) {
            variations.add(main);
        }
        // Add bracketed content as separate variations
        bracketed.forEach(content => {
            variations.add(content);
            variations.add(content.toLowerCase());
        });
        // Add extracted abbreviations
        abbreviations.forEach(abbr => {
            variations.add(abbr);
            variations.add(abbr.toLowerCase());
        });
        // Generate abbreviation from main text
        const generatedAbbr = this.generateAbbreviation(main || searchText);
        if (generatedAbbr) {
            variations.add(generatedAbbr);
            variations.add(generatedAbbr.toLowerCase());
        }
        // Add normalized version
        const normalized = this.normalizeText(searchText);
        if (normalized && normalized !== searchText.toLowerCase()) {
            variations.add(normalized);
        }
        // Add core version
        const core = this.getCoreText(searchText);
        if (core && core !== normalized) {
            variations.add(core);
        }
        // Add variations without common organizational terms
        const withoutOrg = searchText
            .replace(/\b(inc|ltd|llc|corp|corporation|company|co|limited|group)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (withoutOrg && withoutOrg !== searchText) {
            variations.add(withoutOrg);
        }
        // Remove empty strings and duplicates
        return Array.from(variations).filter(v => v && v.trim().length > 0);
    }
    /**
     * Normalize entity for comprehensive processing
     */
    static normalizeEntity(entityName) {
        const original = entityName.trim();
        const normalized = this.normalizeText(original);
        const variations = this.generateSearchVariations(original);
        const specificityScore = this.getSpecificityScore(original);
        return {
            original,
            normalized,
            variations,
            specificity_score: specificityScore
        };
    }
    /**
     * Check if matching should be skipped for very short or empty terms
     */
    static shouldSkipMatching(entityName) {
        if (!entityName)
            return true;
        const normalized = entityName.toLowerCase().trim();
        // Skip if too short
        if (normalized.length < 2)
            return true;
        // Skip if it's only generic terms
        const words = normalized.split(/\s+/);
        const nonGenericWords = words.filter(word => !this.GENERIC_TERMS.has(word) &&
            !this.STOP_WORDS.has(word) &&
            word.length > 1);
        if (nonGenericWords.length === 0)
            return true;
        return false;
    }
    /**
     * Parse multiple entities from a string (handles "A, B and C" format)
     */
    static parseMultipleEntities(text) {
        if (!text || typeof text !== 'string') {
            return [];
        }
        // Handle numbered lists first (1. Item, 2. Item)
        if (/^\d+\.\s/.test(text.trim())) {
            return text
                .split(/\d+\.\s/)
                .map(item => item.trim())
                .filter(item => item.length > 0 && item.toLowerCase() !== 'none');
        }
        // Handle comma and "and" separated lists
        const entities = text
            // Split by comma, semicolon, or newline
            .split(/[,;\n]+/)
            // Further split by "and" but preserve meaningful phrases
            .flatMap(part => {
            // Don't split on "and" if it's part of a company name
            if (/\b(research and development|oil and gas|arts and sciences)\b/i.test(part)) {
                return [part.trim()];
            }
            return part.split(/\s+and\s+/i);
        })
            // Clean up each entity
            .map(entity => entity.trim())
            // Remove empty strings and generic terms
            .filter(entity => {
            if (!entity || entity.length < 2)
                return false;
            if (entity.toLowerCase() === 'none')
                return false;
            if (entity.toLowerCase() === 'no evidence found')
                return false;
            // Skip if it's just a number or single character
            if (/^\d+$/.test(entity) || entity.length === 1)
                return false;
            return true;
        })
            // Remove duplicates (case-insensitive)
            .filter((entity, index, array) => {
            const normalized = entity.toLowerCase();
            return array.findIndex(e => e.toLowerCase() === normalized) === index;
        });
        return entities;
    }
    /**
     * Calculate word overlap between two strings
     */
    static calculateWordOverlap(str1, str2) {
        if (!str1 || !str2)
            return 0;
        const words1 = str1.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2 && !this.STOP_WORDS.has(word));
        const words2 = str2.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2 && !this.STOP_WORDS.has(word));
        if (words1.length === 0 || words2.length === 0)
            return 0;
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        const intersection = new Set([...set1].filter(word => set2.has(word)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size;
    }
    /**
     * Check if text contains academic or publication terms
     */
    static isAcademicTerm(text) {
        const academicTerms = [
            'journal', 'conference', 'proceedings', 'review', 'publication',
            'article', 'paper', 'symposium', 'workshop', 'seminar', 'congress'
        ];
        const normalizedText = text.toLowerCase();
        return academicTerms.some(term => normalizedText.includes(term));
    }
    /**
     * Extract meaningful keywords from text
     */
    static extractKeywords(text, minLength = 3) {
        const normalized = this.normalizeText(text);
        const words = normalized.split(/\s+/);
        return words
            .filter(word => word.length >= minLength &&
            !this.STOP_WORDS.has(word) &&
            !this.GENERIC_TERMS.has(word))
            .filter((word, index, array) => array.indexOf(word) === index) // Remove duplicates
            .sort((a, b) => b.length - a.length); // Sort by length, longer first
    }
    /**
     * Check if two entity names are likely the same considering brackets and abbreviations
     */
    static areEntitiesEquivalent(entity1, entity2) {
        if (!entity1 || !entity2) {
            return { isMatch: false, confidence: 0, matchType: 'none' };
        }
        // Extract bracketed content for both entities
        const info1 = this.extractBracketedContent(entity1);
        const info2 = this.extractBracketedContent(entity2);
        // Check for exact matches
        if (entity1.toLowerCase() === entity2.toLowerCase()) {
            return { isMatch: true, confidence: 1.0, matchType: 'exact' };
        }
        // Check if main parts match
        const main1Norm = this.normalizeText(info1.main);
        const main2Norm = this.normalizeText(info2.main);
        if (main1Norm === main2Norm && main1Norm.length > 2) {
            return { isMatch: true, confidence: 0.95, matchType: 'main_match' };
        }
        // Check if one entity's main text matches the other's abbreviation
        const abbr1 = this.generateAbbreviation(info1.main);
        const abbr2 = this.generateAbbreviation(info2.main);
        // Entity1 main vs Entity2 abbreviations
        if (abbr2 && info1.abbreviations.includes(abbr2)) {
            return { isMatch: true, confidence: 0.9, matchType: 'abbreviation_match' };
        }
        // Entity2 main vs Entity1 abbreviations
        if (abbr1 && info2.abbreviations.includes(abbr1)) {
            return { isMatch: true, confidence: 0.9, matchType: 'abbreviation_match' };
        }
        // Check if abbreviations match
        for (const abbr1 of info1.abbreviations) {
            for (const abbr2 of info2.abbreviations) {
                if (abbr1.toLowerCase() === abbr2.toLowerCase()) {
                    return { isMatch: true, confidence: 0.85, matchType: 'abbr_to_abbr' };
                }
            }
        }
        // Check if generated abbreviations match
        if (abbr1 && abbr2 && abbr1.toLowerCase() === abbr2.toLowerCase() && abbr1.length > 2) {
            return { isMatch: true, confidence: 0.8, matchType: 'generated_abbr_match' };
        }
        // Check core text similarity for partial matches
        const core1 = this.getCoreText(entity1);
        const core2 = this.getCoreText(entity2);
        if (core1 === core2 && core1.length > 3) {
            return { isMatch: true, confidence: 0.75, matchType: 'core_match' };
        }
        // Check word overlap
        const overlap = this.calculateWordOverlap(entity1, entity2);
        if (overlap > 0.8) {
            return { isMatch: true, confidence: overlap * 0.7, matchType: 'word_overlap' };
        }
        return { isMatch: false, confidence: 0, matchType: 'none' };
    }
}
exports.EntityNormalization = EntityNormalization;
// Common generic terms that indicate low specificity
EntityNormalization.GENERIC_TERMS = new Set([
    'company', 'corporation', 'corp', 'inc', 'ltd', 'llc', 'group', 'international',
    'global', 'development', 'management', 'systems', 'services', 'name', 'co',
    'china', 'chinese', 'america', 'american', 'usa', 'us', 'canada', 'canadian',
    'japan', 'japanese', 'europe', 'european', 'asia', 'asian',
    'africa', 'african', 'india', 'indian', 'germany', 'german',
    'france', 'french', 'uk', 'britain', 'british', 'italy', 'italian',
    'spain', 'spanish', 'russia', 'russian', 'iran', 'korea', 'korean',
    'australia', 'australian', 'brazil', 'brazilian', 'mexico', 'mexican',
    'university', 'college', 'institute', 'research', 'center', 'centre',
    'technology', 'science', 'engineering', 'medical', 'hospital',
    'school', 'academy', 'laboratory', 'lab', 'faculty', 'department',
    'military', 'government', 'agency', 'organization', 'organisation', 'association',
    'limited', 'public', 'private', 'holdings', 'enterprises'
]);
// Stop words to ignore in processing
EntityNormalization.STOP_WORDS = new Set([
    'the', 'of', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
    'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had'
]);
// Organizational suffixes and prefixes that can be removed for core matching
EntityNormalization.ORG_SUFFIXES = new Set([
    'university of', 'institute of', 'center for', 'centre for', 'the',
    'inc', 'ltd', 'llc', 'corp', 'corporation', 'company', 'co', 'limited',
    'group', 'holdings', 'enterprises', 'international', 'global'
]);
//# sourceMappingURL=EntityNormalization.js.map