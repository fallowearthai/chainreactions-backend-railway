/**
 * CitationFormatter Utility
 *
 * Formats finding summaries with embedded source citations
 * to provide better transparency and reference capabilities
 */

export interface SourceReference {
  title: string;
  url: string;
  index: number;
}

export interface CitationSegment {
  text: string;
  startIndex: number;
  endIndex: number;
  sourceIndices: number[];
}

export interface FormattedCitation {
  originalText: string;
  annotatedText: string;
  citations: SourceReference[];
  citationSegments: CitationSegment[];
}

/**
 * CitationFormatter class for embedding source references in finding summaries
 */
export class CitationFormatter {
  /**
   * Formats a finding summary by embedding source citations at relevant positions
   *
   * @param findingSummary - The original finding summary text
   * @param keyEvidence - Array of evidence objects with source information
   * @param sources - Array of source objects with title and URL
   * @returns FormattedCitation object with annotated text and citation metadata
   */
  public static formatFindingWithCitations(
    findingSummary: string,
    keyEvidence: any[],
    sources: any[]
  ): FormattedCitation {
    if (!findingSummary || !keyEvidence || keyEvidence.length === 0) {
      return {
        originalText: findingSummary,
        annotatedText: findingSummary,
        citations: [],
        citationSegments: []
      };
    }

    // Extract source references from sources array
    const sourceReferences: SourceReference[] = sources.map((source, index) => ({
      title: source.title || source.name || `Source ${index + 1}`,
      url: source.url || source.link || '',
      index
    }));

    // Create citation segments based on key evidence
    const citationSegments: CitationSegment[] = this.createCitationSegments(
      findingSummary,
      keyEvidence,
      sourceReferences
    );

    // Generate annotated text with embedded citations
    const annotatedText = this.embedCitations(findingSummary, citationSegments, sourceReferences);

    return {
      originalText: findingSummary,
      annotatedText,
      citations: sourceReferences,
      citationSegments
    };
  }

  /**
   * Creates citation segments by mapping key evidence to finding summary text positions
   */
  private static createCitationSegments(
    findingSummary: string,
    keyEvidence: any[],
    sourceReferences: SourceReference[]
  ): CitationSegment[] {
    const segments: CitationSegment[] = [];

    keyEvidence.forEach((evidence: any, evidenceIndex: number) => {
      if (!evidence.evidence) return;

      const evidenceText = evidence.evidence;
      const sourceIndex = evidence.source_index;

      // Find all occurrences of this evidence in the finding summary
      const positions = this.findTextPositions(findingSummary, evidenceText);

      positions.forEach(position => {
        // Map source_index to actual source reference
        const sourceRefs = sourceIndex !== undefined && sourceIndex < sourceReferences.length
          ? [sourceIndex]
          : [];

        segments.push({
          text: evidenceText,
          startIndex: position.start,
          endIndex: position.end,
          sourceIndices: sourceRefs
        });
      });
    });

    // Remove overlapping segments, keep longer ones
    return this.mergeOverlappingSegments(segments);
  }

  /**
   * Finds all positions where a text appears in the finding summary
   */
  private static findTextPositions(text: string, searchText: string): Array<{start: number, end: number}> {
    const positions: Array<{start: number, end: number}> = [];
    const cleanSearchText = searchText.trim().toLowerCase();
    const cleanText = text.toLowerCase();

    let index = cleanText.indexOf(cleanSearchText);
    while (index !== -1) {
      positions.push({
        start: index,
        end: index + cleanSearchText.length
      });
      index = cleanText.indexOf(cleanSearchText, index + 1);
    }

    return positions;
  }

  /**
   * Merges overlapping citation segments, preferring longer segments
   */
  private static mergeOverlappingSegments(segments: CitationSegment[]): CitationSegment[] {
    if (segments.length === 0) return [];

    // Sort segments by start position
    segments.sort((a, b) => a.startIndex - b.startIndex);

    const merged: CitationSegment[] = [];
    let current = segments[0];

    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];

      // Check if segments overlap
      if (next.startIndex <= current.endIndex) {
        // Merge segments, combine source indices, and extend boundaries
        current = {
          text: current.text, // Keep original text
          startIndex: current.startIndex,
          endIndex: Math.max(current.endIndex, next.endIndex),
          sourceIndices: [...new Set([...current.sourceIndices, ...next.sourceIndices])]
        };
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Embeds citation markers into the original text
   */
  private static embedCitations(
    originalText: string,
    citationSegments: CitationSegment[],
    sourceReferences: SourceReference[]
  ): string {
    if (citationSegments.length === 0) {
      return originalText;
    }

    // Sort segments by position in reverse order to avoid index shifting
    const sortedSegments = [...citationSegments].sort((a, b) => b.startIndex - a.startIndex);

    let annotatedText = originalText;

    sortedSegments.forEach(segment => {
      const citationMarkers = segment.sourceIndices.map(sourceIndex => {
        const source = sourceReferences[sourceIndex];
        if (!source) return '';

        // Create citation marker format: [Source: Title] or [1] for short references
        const shortTitle = source.title.length > 50
          ? source.title.substring(0, 47) + '...'
          : source.title;

        return `[Source: ${shortTitle}]`;
      }).filter(marker => marker.length > 0);

      if (citationMarkers.length > 0) {
        const citationText = citationMarkers.join(', ');
        const before = annotatedText.substring(0, segment.endIndex);
        const after = annotatedText.substring(segment.endIndex);
        annotatedText = before + ' ' + citationText + after;
      }
    });

    return annotatedText;
  }

  /**
   * Alternative format using numbered citations
   */
  public static formatWithNumberedCitations(
    findingSummary: string,
    keyEvidence: any[],
    sources: any[]
  ): FormattedCitation {
    const result = this.formatFindingWithCitations(findingSummary, keyEvidence, sources);

    // Replace citation markers with numbered format
    let annotatedText = result.originalText;
    const citationMap = new Map<number, string>();

    // Create numbered citation map
    result.citations.forEach((source, index) => {
      citationMap.set(index, `[${index + 1}]`);
    });

    // Apply numbered citations to segments
    const sortedSegments = [...result.citationSegments].sort((a, b) => b.startIndex - a.startIndex);

    sortedSegments.forEach(segment => {
      const numbers = segment.sourceIndices.map(sourceIndex => {
        return citationMap.get(sourceIndex) || '';
      }).filter(num => num.length > 0);

      if (numbers.length > 0) {
        const citationText = numbers.join(', ');
        const before = annotatedText.substring(0, segment.endIndex);
        const after = annotatedText.substring(segment.endIndex);
        annotatedText = before + ' ' + citationText + after;
      }
    });

    return {
      ...result,
      annotatedText
    };
  }

  /**
   * Validates that citation segments are within text boundaries
   */
  public static validateCitationSegments(
    text: string,
    segments: CitationSegment[]
  ): boolean {
    return segments.every(segment =>
      segment.startIndex >= 0 &&
      segment.endIndex <= text.length &&
      segment.startIndex < segment.endIndex
    );
  }
}