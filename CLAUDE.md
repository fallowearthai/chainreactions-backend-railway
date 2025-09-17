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
- **POST `/api/enhanced/search`** - Full 3-stage OSINT analysis
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