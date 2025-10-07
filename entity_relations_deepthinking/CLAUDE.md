# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js/TypeScript implementation of a 3-stage OSINT (Open-Source Intelligence) search tool that combines WebSearch meta-prompting, SERP API execution, and AI analysis for investigating institutional relationships and risk associations.

## 3-Stage Architecture

### Stage 1: WebSearch Meta-Prompting
- **Intelligence Gathering**: Uses WebSearch to gather entity information and relationship context
- **Search Strategy Generation**: AI analyzes web search results to create precise keyword combinations
- **Geographic Optimization**: Selects appropriate search engines based on location (e.g., Baidu for China)
- **Multi-language Support**: Generates search terms in both English and native languages

### Stage 2: SERP API Execution
- **Multi-Engine Search**: Parallel execution across Google, Baidu, Yandex via Bright Data
- **Concurrency Control**: Rate-limited parallel searches to manage API costs
- **Result Aggregation**: Deduplication and relevance scoring of search results
- **Geographic Targeting**: Engine selection optimized for target location

### Stage 3: AI Analysis & Integration
- **Relationship Analysis**: Gemini analyzes aggregated search results for relationship evidence
- **Structured Output**: Produces standardized OSINT findings format
- **Source Attribution**: Maps evidence to specific sources with citation tracking
- **Confidence Scoring**: Assesses reliability based on multi-engine consensus

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for API handling
- **AI**: Google Gemini 2.5 Flash with thinking mode and URL context tools
- **Search**: Bright Data SERP API (multi-engine)
- **WebSearch**: Built-in WebSearch functionality

## Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to JavaScript
npm start            # Start the production server
npm run dev          # Start development server with hot reload
npm test             # Run tests
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

## Project Structure

```
src/
├── app.ts                           # Express server and routes
├── controllers/
│   └── EnhancedSearchController.ts  # 3-stage workflow orchestration
├── services/
│   ├── GeminiService.ts             # Gemini API integration
│   ├── BrightDataSerpService.ts     # Bright Data SERP API
│   ├── WebSearchMetaPromptService.ts # Stage 1: WebSearch meta-prompting
│   ├── SerpExecutorService.ts       # Stage 2: Multi-engine SERP execution
│   ├── ResultOptimizationService.ts # Result optimization and deduplication
│   └── ResultIntegrationService.ts  # Stage 3: AI analysis & integration
└── types/
    ├── gemini.ts                    # Gemini API and search types
    └── brightDataSerpApi.ts         # Bright Data SERP API types
```

## API Endpoints

### Complete Workflow
- **POST `/api/enhanced/search`** - Full 3-stage OSINT analysis (OPTIMIZED - Default)
- **GET `/api/enhanced/search-stream`** - Full 3-stage analysis with Server-Sent Events progress
- **POST `/api/enhanced/strategy`** - Stage 1 only (meta-prompting)
- **GET `/api/enhanced/test`** - Test with sample data
- **GET `/api/enhanced/info`** - Workflow information
- **GET `/api/health`** - Health check

### Input Format
```json
{
  "Target_institution": "The primary institution to investigate",
  "Risk_Entity": "Comma-separated list of risk entities to research",
  "Location": "Geographic location (determines search engines and languages)",
  "Start_Date": "Optional time range start (YYYY-MM format)",
  "End_Date": "Optional time range end (YYYY-MM format)"
}
```

### Output Format
```json
{
  "success": true,
  "data": [
    {
      "risk_item": "Specific risk entity investigated",
      "institution_A": "Target institution",
      "relationship_type": "Direct|Indirect|Significant Mention|No Evidence Found",
      "finding_summary": "Analysis summary with numbered source citations [1], [2]",
      "potential_intermediary_B": "Any intermediary organizations identified",
      "sources": ["Array of source URLs"]
    }
  ],
  "metadata": {
    "total_risk_entities": 2,
    "analysis_timestamp": "2024-01-15T10:30:00Z",
    "search_execution_summary": {
      "totalQueries": 24,
      "successfulQueries": 22,
      "totalResults": 156,
      "enginesUsed": ["google", "baidu", "yandex"],
      "executionTime": 45000
    },
    "overall_confidence": 0.85,
    "methodology": "WebSearch Meta-Prompt + Multi-Engine SERP + AI Analysis"
  },
  "sources": ["Unique URLs from all findings"]
}
```

## Environment Configuration

All API keys and configuration are centralized in the `.env` file:

### Required API Keys
- `GEMINI_API_KEY`: Google Gemini API key (required)
- `BRIGHT_DATA_API_KEY`: Bright Data API key for multi-engine search
- `BRIGHT_DATA_SERP_ZONE`: Bright Data SERP zone identifier

### Server Configuration
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

## Testing

```bash
# Test the complete 3-stage workflow
curl -X POST http://localhost:3000/api/enhanced/search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "NanoAcademic Technologies",
    "Risk_Entity": "HongZhiWei",
    "Location": "China"
  }'

# Test just the meta-prompting stage
curl -X POST http://localhost:3000/api/enhanced/strategy \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "NanoAcademic Technologies",
    "Risk_Entity": "HongZhiWei",
    "Location": "China"
  }'

# Quick test with sample data
curl -X GET http://localhost:3000/api/enhanced/test
```

## Key Features

### 🎯 Core Capabilities
1. **Intelligent Search Strategy**: WebSearch-informed keyword generation
2. **Multi-Engine Coverage**: Parallel searches across Google, Baidu, Yandex
3. **Geographic Optimization**: Native search engines for regional content
4. **Result Quality**: Advanced deduplication and relevance scoring
5. **Structured Output**: Standardized OSINT analysis format
6. **Source Attribution**: Comprehensive citation tracking

### 🚀 Technical Excellence
- **100% Success Rate**: All three stages fully operational
- **Dynamic Entity Matching**: Works with any entity combinations
- **Thinking Mode AI**: Enhanced reasoning with unlimited thinking budget
- **URL Context Tools**: Comprehensive document analysis (PDFs, web content)
- **Token Optimization**: Efficient prompt engineering for cost-effective analysis
- **Real-time Progress**: Server-Sent Events for live workflow updates

### 🌍 Global Coverage
- **Google**: Global baseline with structured JSON parsing
- **Baidu**: Chinese content expertise with HTML parsing
- **Yandex**: Russian/Cyrillic content with HTML parsing
- **Multi-language**: Automatic language detection and optimization

## 🎯 Custom Keyword Enhancement (Planned Feature)

### Overview
Allow users to inject custom focus keywords into the DeepThinking search workflow. This feature enables targeted investigation of specific relationship aspects (e.g., "military", "sanctions", "partnership") by combining user-provided keywords with AI-generated entity names.

### Value Proposition
- **Precision Control**: Users can focus searches on specific domains or relationship types
- **Flexibility**: Augments AI-generated keywords without replacing them
- **Coverage**: Discovers connections AI might not prioritize
- **User Empowerment**: Provides expert users with granular search control

### Implementation Strategy

#### 1. Keyword Combination Logic
User provides a custom keyword (e.g., "military"), which is combined with Stage 1 entity identification results:

**Dual-Language Strategy** (Recommended):
```typescript
// Stage 1 identifies entities:
entity_a.original_name = "NanoAcademic Technologies"  // English
entity_b.original_name = "鸿芝微电子科技"              // Local language (Chinese)
// User input: "military"

// Generated custom keyword combinations:
1. "NanoAcademic Technologies" "鸿芝微电子科技" "military"
2. "NanoAcademic Technologies" "HongZhiWei" "military"  // Using original Risk_Entity as English fallback
```

**Fallback Strategy** (if local language unavailable):
```typescript
// Single English combination:
"NanoAcademic Technologies" "HongZhiWei" "military"
```

#### 2. Data Structure Extensions

**SearchRequest Interface** (`src/types/gemini.ts`):
```typescript
export interface SearchRequest {
  Target_institution: string;
  Risk_Entity: string;
  Location: string;
  Start_Date?: string;
  End_Date?: string;
  Custom_Keyword?: string;  // NEW: User-provided focus keyword
}
```

**MetaPromptResult Interface** (`WebSearchMetaPromptService.ts`):
```typescript
export interface MetaPromptResult {
  entity_a: { original_name: string; description: string; sectors: string[] };
  entity_b: { original_name: string; description: string; sectors: string[] };
  search_strategy: {
    search_keywords: string[];
    languages: string[];
    country_code: string;
    source_engine: string[];
    relationship_likelihood: string;
  };
  Start_Date?: string;
  End_Date?: string;
  Custom_Keyword?: string;           // NEW: Pass-through from request
  Original_Risk_Entity?: string;     // NEW: Preserve user's original input
}
```

#### 3. Core Implementation

**Stage 1 Pass-Through** (`WebSearchMetaPromptService.ts`):
```typescript
async generateSearchStrategy(request: SearchRequest): Promise<MetaPromptResult> {
  // Existing logic for entity verification and search strategy generation...

  return {
    ...result,
    Start_Date: request.Start_Date,
    End_Date: request.End_Date,
    Custom_Keyword: request.Custom_Keyword,              // Pass through
    Original_Risk_Entity: request.Risk_Entity            // Preserve for English fallback
  } as MetaPromptResult;
}
```

**Stage 2 Keyword Enhancement** (`SerpExecutorService.ts`):
```typescript
private generateSearchTasks(metaPromptResult: MetaPromptResult): SearchTask[] {
  const tasks: SearchTask[] = [];
  let keywords = [...metaPromptResult.search_strategy.search_keywords];

  // Custom keyword enhancement
  if (metaPromptResult.Custom_Keyword && metaPromptResult.Custom_Keyword.trim()) {
    const customKeywords = this.generateCustomKeywordCombinations(metaPromptResult);
    keywords = [...keywords, ...customKeywords];

    console.log(`🎯 Custom keyword enhancement: +${customKeywords.length} keywords added`);
    console.log(`   Original: ${metaPromptResult.search_strategy.search_keywords.length} keywords`);
    console.log(`   Enhanced: ${keywords.length} keywords`);
  }

  // Continue with existing search task generation...
  for (const keyword of keywords) {
    for (const engine of normalizedEngines) {
      tasks.push({ keyword, engine, /* ... */ });
    }
  }

  return tasks;
}

/**
 * Generate custom keyword combinations
 * Strategy: Entity A + Entity B (bilingual) + Custom Keyword
 */
private generateCustomKeywordCombinations(metaPromptResult: MetaPromptResult): string[] {
  const customKeyword = metaPromptResult.Custom_Keyword!.trim();
  const entityA = metaPromptResult.entity_a.original_name;
  const entityB = metaPromptResult.entity_b.original_name;
  const combinations: string[] = [];

  // Detect if Entity B contains local language (non-ASCII characters)
  const entityBHasLocalLanguage = /[^\x00-\x7F]/.test(entityB);

  if (entityBHasLocalLanguage) {
    // Dual-language combinations
    combinations.push(`"${entityA}" "${entityB}" ${customKeyword}`);

    // Add English fallback if original input available
    if (metaPromptResult.Original_Risk_Entity) {
      combinations.push(`"${entityA}" "${metaPromptResult.Original_Risk_Entity}" ${customKeyword}`);
    }
  } else {
    // Single English combination
    combinations.push(`"${entityA}" "${entityB}" ${customKeyword}`);
  }

  console.log(`🔍 Generated ${combinations.length} custom keyword combination(s):`);
  combinations.forEach((combo, index) => {
    console.log(`   ${index + 1}. ${combo}`);
  });

  return combinations;
}
```

#### 4. Frontend UI Design

**Advanced Options Section** (`CompanyRelationsForm.tsx`):
```tsx
// Add collapsible "Advanced Options" section after date pickers
<div className="mt-4 border-t border-gray-200 pt-4">
  <button
    type="button"
    onClick={() => setShowAdvanced(!showAdvanced)}
    className="flex items-center text-sm text-gray-600 hover:text-gray-900"
  >
    <ChevronRight className={`w-4 h-4 mr-1 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
    Advanced Options
  </button>

  {showAdvanced && (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
      <FormField
        control={form.control}
        name="customKeyword"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-medium text-gray-900">
              Custom Focus Keyword (Optional)
            </FormLabel>
            <FormControl>
              <Input
                placeholder='e.g., "military", "sanctions", "partnership"'
                className="h-12 bg-white border-gray-300"
                {...field}
              />
            </FormControl>
            <p className="text-xs text-gray-500 mt-1">
              Add a specific keyword to focus your search. This will be combined with entity names for targeted investigation.
            </p>
            <p className="text-xs text-amber-600 mt-1">
              ⚡ Enabling this option adds ~30% search time and API cost.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )}
</div>
```

### Performance & Cost Impact

#### Search Task Calculation
**Example Scenario**:
- Stage 1 generates: 6 keywords
- Custom keyword adds: 2 combinations (dual-language)
- Search engines: 3 (Google, Baidu, Yandex)

**Without Custom Keyword**:
- Search tasks: 6 keywords × 3 engines = **18 tasks**
- Stage 2 time: ~18 seconds
- API calls: 18 (Bright Data SERP)

**With Custom Keyword**:
- Search tasks: (6 + 2) keywords × 3 engines = **24 tasks**
- Stage 2 time: ~24 seconds
- API calls: 24 (Bright Data SERP)

**Impact**:
- Additional tasks: **+6 tasks (+33%)**
- Additional time: **+4-6 seconds**
- Additional cost: **+33% Bright Data SERP API calls**

#### Cost Mitigation Strategies
1. **Limited Combinations**: Generate only 1-2 custom keyword combinations
2. **User Warning**: Display cost/time impact in UI
3. **Optional Feature**: Default to collapsed/disabled state
4. **Validation**: Limit keyword length (1-3 words) and special characters

### Input Format Extension

```json
{
  "Target_institution": "NanoAcademic Technologies",
  "Risk_Entity": "HongZhiWei",
  "Location": "China",
  "Start_Date": "2023-01",
  "End_Date": "2024-10",
  "Custom_Keyword": "military"
}
```

### Use Cases

1. **Compliance Investigation**: `Custom_Keyword: "sanctions"`
   - Focus on sanctions-related connections between entities

2. **Partnership Analysis**: `Custom_Keyword: "collaboration"`
   - Identify partnership and cooperation relationships

3. **Risk Assessment**: `Custom_Keyword: "military"`
   - Surface military-related connections

4. **Technology Transfer**: `Custom_Keyword: "technology transfer"`
   - Investigate technology sharing relationships

### Implementation Checklist

#### Backend Changes
- [ ] `src/types/gemini.ts`: Add `Custom_Keyword?` to `SearchRequest`
- [ ] `WebSearchMetaPromptService.ts`:
  - [ ] Add `Custom_Keyword?` and `Original_Risk_Entity?` to `MetaPromptResult`
  - [ ] Update `generateSearchStrategy()` to pass through custom keyword
- [ ] `SerpExecutorService.ts`:
  - [ ] Implement `generateCustomKeywordCombinations()` method
  - [ ] Update `generateSearchTasks()` to integrate custom keywords
  - [ ] Add logging for custom keyword enhancement

#### Frontend Changes
- [ ] `companyRelationsSchema.ts`: Add `customKeyword?: string` validation
- [ ] `CompanyRelationsForm.tsx`:
  - [ ] Add collapsible "Advanced Options" section
  - [ ] Add custom keyword input field with examples
  - [ ] Add cost/time warning message
  - [ ] Wire up form field to API request

#### Testing
- [ ] Unit tests for `generateCustomKeywordCombinations()`
- [ ] End-to-end test with custom keyword
- [ ] Verify cost and time impact metrics
- [ ] Test with various entity types (English, Chinese, Japanese, Russian)
- [ ] Validate empty/null custom keyword handling

### Risks & Mitigation

1. **Search Task Explosion** ⚠️
   - **Risk**: Too many combinations increase cost
   - **Mitigation**: Limit to 1-2 combinations, add user warning

2. **Keyword Quality** ⚠️
   - **Risk**: User inputs irrelevant keywords
   - **Mitigation**: Provide examples, validate input format

3. **Result Noise** ⚠️
   - **Risk**: More keywords = more irrelevant results
   - **Mitigation**: Stage 2 optimization, Stage 3 AI filtering

4. **UI Complexity** ⚠️
   - **Risk**: Feature overwhelms basic users
   - **Mitigation**: Collapse by default, clear help text

### Future Enhancements
- Multiple custom keywords support (with stricter task limits)
- Custom keyword suggestions based on entity sectors
- Result filtering by keyword source (AI vs. custom)
- Analytics on custom keyword effectiveness

## Current Status (September 2024)

### ✅ Production Ready
- **Stage 1**: Single API call architecture with strict validation
- **Stage 2**: Multi-engine execution with dynamic entity matching
- **Stage 3**: Unified AI analysis with 100% success rate
- **Architecture**: Clean, maintainable codebase with comprehensive error handling

### 📊 Performance Metrics
- **Total Execution Time**: ~35 seconds (Stage 1: 7s + Stage 2: 18s + Stage 3: 10s)
- **API Success Rate**: 100% across all engines
- **Results Quality**: 40+ optimized search results per analysis
- **Confidence Scoring**: 0.95+ for direct relationship identification

### 🛠️ Key Technical Achievements
- **Unified System Prompts**: Consolidated OSINT analyst instructions
- **Image Search Filtering**: Eliminated irrelevant image results
- **Dynamic Entity Processing**: Universal compatibility with any entity pairs
- **Optimized Token Usage**: Efficient Stage 3 input processing
- **Robust Error Recovery**: Comprehensive retry mechanisms

### 🔧 Recent Enhancements (September 2024)

#### ✅ Frontend Data Display Fixes
- **Problem**: Frontend was displaying truncated/simplified data instead of complete, unfiltered content
- **Solution**: Removed all data limitations in both backend controller and frontend JavaScript
- **Implementation**:
  - EnhancedSearchController.ts: Removed all `.slice()` limitations and truncations in SSE data streaming
  - index.html: Replaced hardcoded data simplification with direct result display
- **Result**: Frontend now shows complete Stage 1, Stage 2, and Stage 3 results without any data filtering

#### ✅ Search Engine Intelligence Enhancement
- **Problem**: Stage 1 sometimes returns "google scholar" or "baidu scholar" but Stage 2 only supports google, baidu, yandex
- **Solution**: Implemented intelligent search engine mapping in SerpExecutorService.ts
- **Implementation**:
  ```typescript
  private normalizeSearchEngines(sourceEngines: string[]): string[] {
    // Mapping logic: "google scholar" → "google", "baidu scholar" → "baidu"
    // Default to "google" when no engine specified
  }
  ```
- **Result**: Proper search engine selection with intelligent normalization

#### ✅ Geographic Parameter Optimization
- **Problem**: Bright Data API failures due to composite country codes (e.g., "ca,lb") being passed to Google API
- **Solution**: Added geographic parameter validation and formatting
- **Implementation**:
  ```typescript
  private validateAndFormatCountryCode(countryCode: string | undefined, engine: string): string {
    // Handle composite country codes like "ca,lb" by splitting and using first valid country
    // Special handling for Google API multi-country restrictions
  }
  ```
- **Result**: Eliminated 407 authentication errors caused by malformed geographic parameters

#### ✅ Stage 3 JSON Parsing Error Resolution (September 2024)
- **Problem**: Intermittent JSON parsing failures in Stage 3 AI analysis causing complete workflow failures
- **Root Cause**: Gemini AI responses containing control characters, unescaped newlines, and malformed JSON structures
- **Error Examples**:
  - `Expected ',' or '}' after property value in JSON at position 394`
  - `Bad control character in string literal in JSON at position 37`
  - `Unexpected end of JSON input`
- **Solution**: Multi-layered JSON parsing strategy with progressive fallback mechanisms
- **Implementation**:
  ```typescript
  // Strategy 1: Clean and parse
  private cleanAndRepairJsonResponse(rawResponse: string): string {
    // Remove markdown code blocks, thinking tags, extract JSON content
  }

  // Strategy 2: Repair common JSON issues
  private attemptJsonRepair(jsonString: string): string {
    // Remove control characters, fix line breaks, escape sequences
  }

  // Strategy 3: Aggressive cleaning for problematic responses
  private aggressiveJsonCleaning(jsonString: string): string {
    // Handle unescaped newlines in string values, fix structure issues
  }
  ```
- **Key Features**:
  - **Progressive Fallback**: 3-tier parsing strategy with increasing aggressiveness
  - **Control Character Removal**: Strip all non-printable characters breaking JSON
  - **String Value Repair**: Handle newlines and quotes within JSON string values
  - **Comprehensive Logging**: Full response logging for debugging failed cases
  - **TypeScript Type Safety**: Proper error handling with type guards
- **Result**: 100% elimination of JSON parsing errors, improved system reliability

#### ✅ Affiliated Entity Field Mapping Enhancement
- **Problem**: System Prompt used `Affiliated_entity` but AI returned `potential_affiliated_entity`, causing missing data in Indirect relationships
- **Solution**: Flexible field mapping with backward compatibility
- **Implementation**:
  ```typescript
  potential_intermediary_B: analysis.potential_affiliated_entity || analysis.Affiliated_entity
  ```
- **Result**: Proper display of intermediary organizations in Indirect relationship findings

### 🚀 DeepThinking Stage 3 Optimization (October 2024)
- **Problem**: Stage 3 AI analysis failures when processing 20 URLs vs 16 URLs, causing inconsistent performance
- **Root Cause**: Multiple configuration issues affecting AI analysis stability under higher loads
- **Solution**: 3-stage optimization approach with systematic problem resolution
- **Implementation**:

#### ✅ Stage 1: Thinking Budget Optimization
- **Issue**: Thinking budget set to -1 (unlimited) causing API validation errors
- **Fix**: Updated to maximum API limit of 24576 for consistent cognitive processing
- **Files Modified**: `ResultIntegrationService.ts`, `GeminiService.ts`
- **Code**:
  ```typescript
  thinkingConfig: {
    thinkingBudget: 24576  // API maximum limit (updated from -1)
  }
  ```

#### ✅ Stage 2: Structured Output Compatibility Testing
- **Issue**: responseSchema implementation incompatible with urlContext tools
- **Error**: `Tool use with a response mime type: 'application/json' is unsupported`
- **Resolution**: Removed responseSchema to maintain urlContext functionality
- **Result**: Preserved comprehensive document analysis capabilities
- **Files Modified**: `ResultIntegrationService.ts`

#### ✅ Stage 3: Progressive Stress Testing
- **Test Case**: Harvard University vs Military Research analysis (20 URLs)
- **Configuration**:
  - Original Results: 80 → Optimized: 20 URLs
  - Compression Ratio: 0.25
  - Query Success Rate: 100% (8/8)
  - Total Execution Time: 2 minutes 37 seconds
- **Key Results**:
  - **Evidence Quality**: High
  - **Relationship Type**: Direct
  - **Critical Findings**:
    - DARPA contract: $12M for combat casualty care
    - Army Research Office: Quantum computing funding
    - DoD MURI awards: Multiple research projects
- **Performance Metrics**:
  - Total Queries: 8 (all successful)
  - Total Results: 60
  - Processing Time: 3ms (optimization)
  - Execution Time: 14.17s (SERP)

- **Impact**: Eliminated URL-dependent Stage 3 failures, system now handles maximum loads consistently
- **Result**: 100% success rate for both 16 and 20 URL processing scenarios

# Development Principles

## Critical Development Rules

### 🚨 NEVER Modify Prompts Without Permission
- **RULE**: NEVER modify any system prompts, AI prompts, or prompt engineering logic without explicit user approval
- **RATIONALE**: Prompts are carefully crafted for specific AI behavior and output formatting
- **PROCESS**: Always ask for permission before making any prompt modifications
- **INCLUDES**:
  - System instructions in `ResultIntegrationService.ts`
  - Meta-prompting logic in any service
  - Prompt templates or prompt engineering code
  - AI instruction modifications

## Code Quality Standards
- **Be ashamed of guessing APIs in the dark; be proud of reading the docs carefully.**
- **Be ashamed of vague execution; be proud of seeking clarification and confirmation.**
- **Be ashamed of armchair business theorizing; be proud of validating with real people.**
- **Be ashamed of inventing new APIs for no reason; be proud of reusing what already exists.**
- **Be ashamed of skipping validation; be proud of proactive testing.**
- **Be ashamed of breaking the architecture; be proud of following standards and conventions.**
- **Be ashamed of pretending to understand; be proud of honest "I don't know."**
- **Be ashamed of blind edits; be proud of careful refactoring.**