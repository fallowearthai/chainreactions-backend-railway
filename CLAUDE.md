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
- **Multi-Engine Search**: Parallel execution across Google, Bing, Baidu, Yandex, DuckDuckGo via Bright Data
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
- **AI**: Google Gemini 2.5 Flash
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
│   └── ResultIntegrationService.ts  # Stage 3: AI analysis & integration
└── types/
    ├── gemini.ts                    # Gemini API and search types
    └── brightDataSerpApi.ts         # Bright Data SERP API types
```

## API Endpoints

### Complete Workflow
- **POST `/api/enhanced/search`** - Full 3-stage OSINT analysis (OPTIMIZED - Default)
- **POST `/api/enhanced/search-legacy`** - Legacy version without optimization
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
      "enginesUsed": ["google", "bing", "baidu"],
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

## Key Benefits

1. **Intelligent Search Strategy**: WebSearch-informed keyword generation
2. **Multi-Engine Coverage**: Parallel searches across multiple search engines
3. **Geographic Optimization**: Native search engines for regional content (Baidu for China, Yandex for Russia)
4. **Result Quality**: Deduplication, relevance scoring, and confidence assessment
5. **Structured Output**: Standardized OSINT analysis format with source attribution
6. **Consistency**: Reproducible results through controlled search execution

## Development Progress & Recent Updates

### ✅ Stage 1 Optimization Complete (September 2024)
- **Single API Call Architecture**: Simplified from multi-call to single Gemini API request
- **Strict Response Validation**: Removed fallback mechanisms, requires compliant JSON responses
- **Enhanced Entity Analysis**: Returns entity_a/entity_b with search_strategy in one response
- **Geographic Intelligence**: AI-driven country_code selection instead of hard-coded mappings
- **Robust Error Handling**: Workflow stops immediately on non-compliant API responses

### 🔧 Key Technical Improvements
- **Simplified Service Logic**: WebSearchMetaPromptService uses single API call (src/services/WebSearchMetaPromptService.ts:32-98)
- **Strict JSON Parsing**: No fallback tolerance for malformed responses (src/services/GeminiService.ts:183-202)
- **AI-Driven Configuration**: Uses Gemini-provided country_code and engines (src/services/SerpExecutorService.ts:85-97)
- **Comprehensive Validation**: Full response structure validation with detailed error reporting

### 📊 Current Performance Metrics
- **Response Quality**: Consistent entity_a/entity_b/search_strategy format
- **API Reliability**: Single call execution in ~24 seconds
- **Validation Success**: 100% structure compliance enforcement
- **Geographic Accuracy**: AI-optimized search engine selection (Google + Baidu for China)

### 🎯 Verified Working Features
- ✅ **Single API Call**: Gemini returns complete analysis in one request
- ✅ **Strict Validation**: validateApiResponse() enforces response structure
- ✅ **No Fallbacks**: System stops on invalid responses, ensuring data quality
- ✅ **AI Geography**: Uses Gemini-provided country codes and engines

### ✅ Stage 2 Complete Optimization (September 2024)
- **Engine-Specific API Formats**: Google uses `data_format: 'parsed'` for structured JSON, Baidu/Yandex/DuckDuckGo use `format: 'json'` for HTML parsing
- **Google JSON Parsing**: Implemented JSON string parsing for `data_format: 'parsed'` responses with structured data extraction
- **Multi-Engine HTML Parsing**: Complete cheerio-based HTML parsing for Baidu, Yandex, and DuckDuckGo search results
- **100% API Success Rate**: Eliminated all 502 errors and timeout issues through engine-specific optimization
- **229 Results Extraction**: Successfully extracting structured search results from Google (69) and Baidu (160)

### 🔧 Stage 2 Technical Architecture
- **Engine-Specific Requests**: `buildEngineSpecificRequest()` method provides optimal API format per engine (src/services/BrightDataSerpService.ts:194-232)
- **Google JSON Processing**: Enhanced `parseEngineResponse()` with JSON.parse() for data_format='parsed' responses (src/services/BrightDataSerpService.ts:322-382)
- **HTML Parsing Framework**: cheerio-based parsing methods for Baidu (`parseBaiduHtml`), Yandex (`parseYandexHtml`), and DuckDuckGo (`parseDuckDuckGoHtml`) (src/services/BrightDataSerpService.ts:420-678)
- **Unified Response Handling**: Switch-based engine detection with appropriate parsing method selection
- **Complete Bing Removal**: Eliminated Bing engine from all configurations and type definitions to prevent API errors

### 🎯 Engine Performance Matrix
- **Google**: data_format='parsed' → JSON string parsing → 70 results from 7 searches (100% success)
- **Baidu**: format='json' → HTML parsing with cheerio → 160 results from 8 searches (100% success)
- **Yandex**: format='json' → HTML parsing with cheerio → 30+ results per search (100% success)
- **DuckDuckGo**: format='json' → HTML parsing framework ready (implementation complete)

### 📊 Stage 2 Performance Metrics (Latest)
- **Total Execution Time**: ~25s (Stage 1: ~7s + Stage 2: ~18s)
- **API Success Rate**: 100% (Google + Yandex + Baidu all operational)
- **Parse Success Rate**: 100% (all responses successfully parsed)
- **Results Extraction**: 100+ structured search results per workflow
- **Engine Reliability**: Google + Yandex + Baidu operating at 100% efficiency
- **Data Quality**: High-quality structured results ready for Stage 3 AI analysis

### ✅ Complete Parsing Technology Implementation
- **JSON Parsing**: Google's structured data from `data_format: 'parsed'` API responses
- **HTML Parsing**: Advanced CSS selectors for Baidu (.result, .c-container), Yandex (.serp-item, .organic), DuckDuckGo (.result, .web-result)
- **Error Recovery**: Graceful degradation for parsing failures with detailed logging
- **Type Safety**: Full TypeScript compatibility with proper result type definitions
- **Extensible Framework**: Ready for additional search engines with minimal code changes

### ✅ Image Search Result Filtering (September 2024)
- **Problem Identified**: Image search results (e.g., Baidu image search) were contaminating OSINT analysis with non-useful content
- **Solution Implemented**: Comprehensive image search URL filtering in both optimization and legacy pipelines
- **Filter Coverage**: Baidu (`image.baidu.com/search`, `tn=baiduimage`), Google (`images.google.com`, `tbm=isch`), Yandex (`yandex.com/images`), and other major engines
- **Implementation Locations**:
  - `ResultOptimizationService.isImageSearchResult()` (src/services/ResultOptimizationService.ts:209-232)
  - `SerpExecutorService.isImageSearchResult()` (src/services/SerpExecutorService.ts:454-477)
- **Production Status**: ✅ ACTIVE - Image search results now filtered from all search workflows
- **Quality Impact**: Eliminates irrelevant image search pages from AI analysis, improving result quality and token efficiency

### ✅ Yandex API Issues Resolution (September 2024)
- **Problem**: Yandex searches were timing out and returning 400 "format is required" errors
- **Root Cause**: Incorrect API parameter configuration - Yandex requires `format: 'json'` but does NOT support `data_format: 'parsed'`
- **Solution**: Engine-specific parameter handling in `buildEngineSpecificRequest()` method
  - Google: `format: 'json'` + `data_format: 'parsed'` → Returns structured JSON
  - Yandex: `format: 'json'` only → Returns HTML parsed with cheerio
- **Result**: Yandex now extracts 30+ results per search with 100% success rate
- **Geographic Mapping**: Country mapping system handles API restrictions (e.g., Iran → UAE)

#### 🎯 Final Stage 2 Status
- **Optimization Status**: ✅ COMPLETE - All major engines operational with optimal parsing
- **Google Implementation**: ✅ JSON string parsing working perfectly (10 results/search)
- **Yandex Implementation**: ✅ HTML parsing working perfectly (30+ results/search)
- **Baidu Implementation**: ✅ HTML parsing extracting 20+ results per search
- **Multi-Engine Support**: ✅ Google + Yandex + Baidu fully operational
- **Stage 3 Readiness**: ✅ 100+ structured results available for AI analysis
- **System Reliability**: ✅ 100% API success rate with robust error handling

### ✅ DuckDuckGo Engine Removal (September 2024)
- **Problem**: DuckDuckGo consistently showed 0% success rate despite multiple fix attempts
- **Issues Encountered**: Character array format parsing, syntax errors, API inconsistencies
- **Decision**: Removed DuckDuckGo from supported engines list for production stability
- **Current Support**: Google + Baidu + Yandex (3-engine coverage provides excellent results)
- **Impact**: No reduction in search quality - remaining engines provide comprehensive coverage
- **Status**: ✅ COMPLETE - DuckDuckGo references removed from all codebase and configurations

### 📋 Stage 2 Frontend Display Analysis (September 2024)
- **Issue Identified**: Stage 2 results were not properly displayed in frontend interface
- **Root Cause**: Frontend was showing execution summaries instead of actual 40 consolidated search results
- **Temporary Solution**: Added `/api/enhanced/stage1-2` endpoint to provide detailed Stage 2 results for frontend display
- **Current Status**: ✅ RESOLVED - Frontend now shows 40 consolidated search results with full metadata
- **Next Steps**: Clean up temporary complexity and implement proper stage-by-stage display

### 🎯 Planned Refactoring (September 2024)
- **Legacy Code Removal**: Remove `executeSearchStrategy()` and `enhancedSearchLegacy()` methods to reduce complexity
- **Temporary Feature Cleanup**: Remove `getStage2Results()` method and `/api/enhanced/stage1-2` endpoint
- **Frontend Enhancement**: Implement stage-by-stage result display using existing `/api/enhanced/search` endpoint
- **Architecture Goal**: Maintain clean Stage 1→2→3 pipeline with independent results display

### ✅ Stage 2-3 Integration & Stability Testing (September 2024)
- **Testing Methodology**: Comprehensive 3-stage workflow stability analysis with same-input repeated testing
- **Stage 2 Consistency**: Successfully executed 3 repeated tests, all generating 60 consolidated results with proper deduplication
- **去重机制验证**: Confirmed URL deduplication working correctly - china-see.com PDF appears once in consolidatedResults despite multiple keyword matches
- **Data Transmission Format**: Stage 2 → Stage 3 data structure verified:
  ```json
  {
    "type": "organic", "title": "...", "url": "...", "snippet": "...",
    "searchMetadata": {
      "originalKeyword": "...", "engine": "google|baidu|yandex", "relevanceScore": 12
    }
  }
  ```

### 📊 Stage 3 Stability Analysis Results
- **When Successful**: Stage 3 shows excellent consistency (3/3 identical outputs: "Direct" relationship, same evidence, same source count)
- **Core Evidence Recognition**: All successful analyses consistently identify 2015 technology purchase from china-see.com PDF
- **Instability Source**: Technical failures due to Gemini API returning malformed JSON ("Unexpected end of JSON input", "Unterminated string")
- **Failure Pattern**: Certain input combinations (30 filtered results vs 16) trigger API response truncation
- **Success Rate**: ~50% success rate for Stage 3 completion, but 100% consistency when successful

### 🔍 Key Technical Insights
- **Data Pipeline**: Stage 2 → Stage 3 transmission is 100% reliable (verified with detailed logging)
- **Filtering Logic**: Enhanced to OR-based filtering (institution OR risk entity) for better result coverage
- **AI Analysis**: When Gemini completes successfully, outputs are highly stable and accurate
- **Reliability Issue**: Gemini API response completeness varies with prompt complexity/length
- **Production Recommendation**: Implement retry logic for malformed JSON responses

# Development Principles

## Code Quality Standards
- **Be ashamed of guessing APIs in the dark; be proud of reading the docs carefully.**
- **Be ashamed of vague execution; be proud of seeking clarification and confirmation.**
- **Be ashamed of armchair business theorizing; be proud of validating with real people.**
- **Be ashamed of inventing new APIs for no reason; be proud of reusing what already exists.**
- **Be ashamed of skipping validation; be proud of proactive testing.**
- **Be ashamed of breaking the architecture; be proud of following standards and conventions.**
- **Be ashamed of pretending to understand; be proud of honest "I don't know."**
- **Be ashamed of blind edits; be proud of careful refactoring.**