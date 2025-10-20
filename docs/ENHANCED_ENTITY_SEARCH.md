# Enhanced Entity Search Documentation

**Status**: ✅ Complete - October 17, 2025
**Service**: Entity Search Microservice (Port 3003)
**Search Engine**: Google Search via Gemini 2.5 Flash API

## Overview

Enhanced Entity Search is a comprehensive company intelligence and risk analysis feature that automatically analyzes entities against 8 critical risk keywords using Google Search powered by Gemini AI. This replaces the previous Linkup API implementation with a more robust and intelligent search system.

### Key Features

- **Automated Risk Analysis**: Searches for 8 predefined risk keywords (military, defense, civil-military fusion, human rights violations, sanctions, police technology, weapons, terrorist connections)
- **Multi-Language Intelligence**: Automatically includes location-based language support (e.g., Chinese + English for China-based entities)
- **Intelligent Severity Assessment**: AI-powered classification of findings into high, medium, low, or no evidence
- **Relationship Classification**: Identifies Direct, Indirect, Significant Mention, or No Evidence Found relationships
- **Source Verification**: All findings backed by verifiable web sources with URLs and metadata
- **Structured Output**: Comprehensive JSON response with basic company info, risk analysis, and search metadata

## Architecture

### Backend Service

**Location**: `services/entity-search/src/`

#### Key Files

1. **EnhancedEntitySearchService.ts** (Line 1-350)
   - Core service implementing Google Search via Gemini API
   - Multi-stage processing: basic info extraction → risk keyword analysis → severity assessment
   - Temperature: 0.1 (focused, deterministic results)
   - Multi-language query generation

2. **enhanced-types.ts**
   - TypeScript interfaces for Enhanced Entity Search
   - Request/response types, risk analysis structures
   - Severity levels and relationship types

3. **EntitySearchController.ts**
   - REST API endpoint handler: `POST /api/entity-search`
   - Request validation and response formatting

4. **.env Configuration**
   ```bash
   # Required
   GEMINI_API_KEY=your_gemini_api_key_here

   # Deprecated (old Linkup implementation)
   # LINKUP_API_KEY=your_linkup_api_key_here
   ```

### Frontend Components

**Location**: `src/components/dashboard/`

#### Component Hierarchy

```
CompanySearchContent.tsx (Container)
  └─ ResultsSection.tsx
      └─ SearchResults.tsx (Router)
          └─ EnhancedEntitySearchResults.tsx (Enhanced format)
              ├─ EnhancedBasicInfoSection.tsx
              ├─ EnhancedRiskSummaryCard.tsx
              ├─ EnhancedRiskAnalysisSection.tsx
              └─ EnhancedMetadataSection.tsx
```

#### Key Files

1. **types/enhanced-entity-search.ts**
   - Frontend type definitions matching backend
   - Helper functions for UI (colors, emojis, formatting)

2. **hooks/useCompanySearch.ts**
   - Business logic for company search flow
   - API integration, credits management, history saving
   - Changed response format from array to single object

3. **components/EnhancedEntitySearchResults.tsx**
   - Main results container
   - Error handling and export functionality

4. **components/EnhancedBasicInfoSection.tsx**
   - Displays: company name, headquarters, sectors, description, past names

5. **components/EnhancedRiskSummaryCard.tsx**
   - Overall risk level badge with color coding
   - High/medium/low severity counts
   - Flagged vs clean keywords

6. **components/EnhancedRiskAnalysisSection.tsx**
   - Detailed risk findings grouped by severity
   - Accordion for sources and search queries
   - Intermediary organizations display

7. **components/EnhancedMetadataSection.tsx**
   - Search statistics: duration, sources, queries, API calls
   - Performance metrics

8. **utils/exportFormatters.ts** (Line 343-500)
   - `formatEnhancedEntitySearchForExport()` function
   - Markdown export with complete analysis

## API Reference

### Request

**Endpoint**: `POST http://localhost:3003/api/entity-search`

**Headers**:
```json
{
  "Content-Type": "application/json"
}
```

**Request Body**:
```typescript
{
  "company_name": string,           // Required - Entity name to search
  "location": string,                // Optional - Geographic location (e.g., "China", "United States")
  "include_risk_analysis": boolean,  // Default: true - Enable automated risk analysis
  "custom_risk_keywords": string[]   // Optional - Additional keywords beyond default 8
}
```

**Example**:
```json
{
  "company_name": "Henan University",
  "location": "China",
  "include_risk_analysis": true
}
```

### Response

**Success Response** (200 OK):
```typescript
{
  "success": true,
  "company": "Henan University",
  "location": "China",
  "basic_info": {
    "company_name": "Henan University",
    "headquarters": "Kaifeng, Henan, China",
    "sectors": ["Education", "Research"],
    "description": "A comprehensive public university...",
    "past_names": ["Henan Provincial University"]
  },
  "risk_analysis": [
    {
      "risk_keyword": "military",
      "severity": "medium",
      "relationship_type": "Indirect",
      "finding_summary": "Research collaborations with defense-related institutions...",
      "potential_intermediary_B": ["State Key Laboratory of..."],
      "sources": [
        {
          "title": "Research Collaboration Announcement",
          "url": "https://...",
          "snippet": "...",
          "type": "news_article"
        }
      ],
      "search_queries": [
        "Henan University military research",
        "河南大学 军事合作"
      ]
    }
  ],
  "risk_summary": {
    "overall_risk_level": "medium",
    "total_risks_found": 3,
    "high_severity_count": 0,
    "medium_severity_count": 2,
    "low_severity_count": 1,
    "flagged_keywords": ["military", "defense"],
    "clean_keywords": ["sanctions", "weapons", "terrorist"]
  },
  "metadata": {
    "search_duration_ms": 12456,
    "total_sources": 24,
    "search_queries_executed": 16,
    "api_calls_made": 8
  }
}
```

**Error Response** (200 OK with error):
```json
{
  "success": false,
  "company": "Example Corp",
  "location": "Unknown",
  "error": "Failed to retrieve basic company information",
  "metadata": {
    "search_duration_ms": 5000,
    "total_sources": 0,
    "search_queries_executed": 1,
    "api_calls_made": 1
  }
}
```

## Risk Keywords

The system automatically searches for these 8 risk indicators:

1. **military** - Military involvement, research, or contracts
2. **defense** - Defense industry connections or projects
3. **civil-military fusion** - Chinese civil-military integration programs
4. **human rights violations** - Labor practices, discrimination, ethical concerns
5. **sanctions** - International sanctions, trade restrictions
6. **police technology** - Surveillance, law enforcement technology
7. **weapons** - Weapons development, manufacturing, or sales
8. **terrorist** - Terrorism connections or support allegations

## Severity Classification

### High Severity
- Direct relationship with significant evidence
- Multiple credible sources confirming involvement
- Recent activity (within 1-2 years)
- Government/official sources mentioning entity

### Medium Severity
- Indirect relationship through intermediaries
- Moderate evidence from credible sources
- Historical involvement (2-5 years ago)
- Industry publications or research papers

### Low Severity
- Significant mention without direct involvement
- Limited evidence or single source
- Older information (5+ years)
- General industry context mentions

### None
- No credible evidence found after comprehensive search
- Sources explicitly state no involvement
- Keyword appears in unrelated context only

## Relationship Types

1. **Direct**: Entity directly involved in risk activity
2. **Indirect**: Relationship through intermediary organizations
3. **Significant Mention**: Entity mentioned in context of risk but no direct involvement
4. **No Evidence Found**: Comprehensive search yielded no relevant connections

## Multi-Language Support

The service automatically generates search queries in multiple languages based on location:

- **China**: Chinese (中文) + English
- **Russia**: Russian (Русский) + English
- **Japan**: Japanese (日本語) + English
- **South Korea**: Korean (한국어) + English
- **Middle East**: Arabic (العربية) + English
- **Default**: English only

## Frontend Integration

### Using Enhanced Entity Search

```typescript
// In useCompanySearch.ts hook
const requestData = {
  "company_name": data.targetInstitution,
  "location": data.country || "",
  "include_risk_analysis": true
};

const response = await fetch(API_ENDPOINTS.ENTITY_SEARCH, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestData)
});

const result = await response.json();
// result is EnhancedEntitySearchResponse (single object, not array)
setSearchResults(result);
```

### Display Components

```tsx
import { EnhancedEntitySearchResults } from './components/EnhancedEntitySearchResults';

<EnhancedEntitySearchResults
  searchData={{
    targetInstitution: "Henan University",
    country: "China"
  }}
  searchResults={enhancedResponse}
  onNewSearch={() => handleNewSearch()}
/>
```

## Export Functionality

Enhanced Entity Search results can be exported to:

1. **Markdown Format**
   - Complete report with all sections
   - Clickable source links
   - Emoji indicators for severity
   - Search metadata

2. **PDF Format** (via markdown conversion)
   - Professional formatting
   - Preserved links and structure
   - Ready for reporting

**Export Function**: `formatEnhancedEntitySearchForExport()` in `exportFormatters.ts:343-500`

## Migration from Linkup

### Backend Changes

✅ **Completed**
- Migrated `EnhancedEntitySearchService` to `services/entity-search/src/services/`
- Created `enhanced-types.ts` with TypeScript interfaces
- Updated `EntitySearchController.ts` to use Enhanced service
- Modified `.env.example` to require `GEMINI_API_KEY`
- Updated service descriptions in `app.ts`

### Frontend Changes

✅ **Completed**
- Created `types/enhanced-entity-search.ts` with frontend types
- Built 5 new UI components for Enhanced display
- Updated `useCompanySearch.ts` hook to use new API format
- Added `formatEnhancedEntitySearchForExport()` export function
- Modified `SearchResults.tsx` to route Enhanced vs Legacy formats
- Updated `CompanySearchContent.tsx` titles to "Enhanced Entity Search"
- Updated `ResultsSection.tsx` to pass onNewSearch prop

### Backward Compatibility

The system maintains backward compatibility with old Linkup search history:

```typescript
// In SearchResults.tsx
const isEnhancedFormat = !Array.isArray(results) && results && 'success' in results;

if (isEnhancedFormat) {
  // Use EnhancedEntitySearchResults
} else {
  // Use legacy CompanySearchTabs (for old history)
}
```

## Credits System

Enhanced Entity Search deducts **1 ordinary_search credit** per search:

```typescript
// In useCompanySearch.ts
const deductionSuccess = await deductCredits('ordinary_search', {
  target_institution: data.targetInstitution,
  country: data.country,
  search_timestamp: new Date().toISOString()
});
```

Credit check happens **before** search execution to prevent unauthorized searches.

## Search History

Results are automatically saved to Supabase:

```typescript
const savedHistory = await saveSearchHistory({
  search_type: 'company-search',
  target_institution: data.targetInstitution,
  location: data.country,
  search_results: result  // Complete Enhanced response object
});
```

## Performance Characteristics

**Typical Search Metrics**:
- Duration: 10-15 seconds
- API Calls: 8 (1 basic info + 8 risk keywords - 1 parallel call per keyword)
- Total Sources: 20-40 web sources
- Search Queries: 16 (2 per keyword: English + location language)

**Optimization**:
- Parallel risk keyword analysis (all 8 keywords processed simultaneously)
- Temperature 0.1 for faster, more focused results
- Efficient grounding metadata extraction

## Testing

### Manual Testing

1. **Test Entity**: University of Waterloo
   ```json
   {
     "company_name": "University of Waterloo",
     "location": "Canada",
     "include_risk_analysis": true
   }
   ```
   Expected: Low risk profile, primarily educational sources

2. **Test Entity**: Henan University
   ```json
   {
     "company_name": "Henan University",
     "location": "China",
     "include_risk_analysis": true
   }
   ```
   Expected: Medium risk profile with defense research connections

### Automated Testing

```bash
# Backend service test
cd services/entity-search
npm test

# Frontend component tests
cd /path/to/frontend
npm test -- EnhancedEntitySearchResults
```

## Troubleshooting

### Common Issues

1. **GEMINI_API_KEY not configured**
   - Error: "Gemini API key not configured"
   - Solution: Add `GEMINI_API_KEY` to `.env` file

2. **Slow response times**
   - Cause: Network latency or high API load
   - Solution: Consider implementing request caching for repeated searches

3. **Empty risk analysis**
   - Cause: Very obscure entities with minimal web presence
   - Expected behavior: All keywords return "none" severity

4. **Frontend displays legacy format**
   - Cause: Old search history from Linkup era
   - Expected: System correctly routes to CompanySearchTabs for backward compatibility

## Future Enhancements

### Potential Improvements

1. **Caching Layer**
   - Redis cache for frequently searched entities
   - TTL: 7 days for basic info, 24 hours for risk analysis

2. **Custom Risk Keywords**
   - Allow users to specify additional keywords
   - Industry-specific risk profiles

3. **Trend Analysis**
   - Track changes in risk profile over time
   - Alert on new risk indicators

4. **Batch Processing**
   - Process multiple entities in one request
   - CSV upload for bulk analysis

5. **Enhanced Visualizations**
   - Risk timeline charts
   - Network graphs for intermediary relationships
   - Geographic risk mapping

## API Rate Limits

**Gemini API Limits**:
- Free tier: 15 RPM (requests per minute)
- Paid tier: Configurable based on plan

**Recommendation**: Implement rate limiting at API Gateway level to prevent quota exhaustion.

## Security Considerations

1. **API Key Protection**
   - Store `GEMINI_API_KEY` in environment variables
   - Never commit to version control
   - Rotate keys periodically

2. **Input Validation**
   - Sanitize company names to prevent injection
   - Validate location strings against known list

3. **Output Sanitization**
   - Escape HTML in descriptions and summaries
   - Verify source URLs before displaying

## Monitoring and Logging

### Key Metrics to Track

1. **Search Performance**
   - Average search duration
   - API call success rate
   - Source retrieval success rate

2. **User Behavior**
   - Most searched entities
   - Most flagged risk keywords
   - Export usage statistics

3. **Error Rates**
   - API failures
   - Timeout occurrences
   - Credit deduction failures

### Logging

```typescript
// Service logs all searches
console.log(`Enhanced entity search for: ${company_name} in ${location}`);
console.log(`Search completed in ${duration}ms with ${total_sources} sources`);
```

## Support and Contact

For issues or questions:
- Backend: Review `services/entity-search/README.md`
- Frontend: Check frontend documentation
- API Documentation: This file

## Version History

**v1.0.0 - October 17, 2025**
- Initial release of Enhanced Entity Search
- Complete replacement of Linkup API integration
- 8 automated risk keywords
- Multi-language support
- Comprehensive frontend components
- Export functionality
- Backward compatibility with legacy search history

---

**Documentation Last Updated**: October 17, 2025
**Maintained By**: ChainReactions Development Team
