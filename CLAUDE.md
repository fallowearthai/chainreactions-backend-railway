# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js/TypeScript implementation of a Google Gemini-based OSINT (Open-Source Intelligence) search tool, designed to replace an existing n8n workflow for investigating institutional relationships and risk associations.

## Core Purpose

The tool investigates potential connections between institutions and risk entities using Google Gemini 2.5 Flash with Google Search grounding capabilities. It performs multi-language searches based on geographic location and provides structured analysis of relationships found.

## Key Features

### Original Architecture
- **Webhook API**: POST endpoint for receiving search requests
- **Gemini Integration**: Uses Google Gemini 2.5 Flash with Google Search tools
- **Multi-language Support**: Automatically searches in both English and the native language of the target location
- **Time Range Filtering**: Supports precise date range constraints for searches
- **Structured Output**: Returns JSON-formatted results with relationship analysis and source URLs
- **Error Handling**: Robust parsing and cleanup of Gemini API responses

### Enhanced Architecture (Current Implementation)
- **Meta Prompting System**: Two-stage AI analysis for intelligent search strategy generation
- **Multi-Search Engine Integration**: Supports Bing, DuckDuckGo, and planned Baidu/Yandex engines
- **Geographic Engine Selection**: Automatically selects appropriate engines based on location and risk category
- **Result Aggregation**: Deduplicates and scores results from multiple search engines
- **MCP Tools Integration**: Planned integration with specialized OSINT tools (NewsAPI, ArXiv, OpenCorporates)
- **Comprehensive API**: Health checks, testing endpoints, and engine comparison tools

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for webhook handling
- **HTTP Client**: Axios for API requests
- **Environment**: dotenv for configuration management
- **Testing**: Jest for unit and integration tests

## Development Commands

### Setup and Installation
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to JavaScript
npm start            # Start the production server
npm run dev          # Start development server with hot reload
```

### Testing and Quality
```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint for code quality
npm run type-check   # Run TypeScript type checking
```

### API Testing
```bash
# Test the webhook endpoint
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "Example Corp",
    "Risk_Entity": "Military,Technology",
    "Location": "China",
    "Start_Date": "2023-01",
    "End_Date": "2024-12"
  }'
```

## Project Architecture

### Current Directory Structure

```
/Users/kanbei/Code/gemini test/
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── .env                           # Environment variables and API keys (all centralized)
├── CLAUDE.md                      # Project documentation (this file)
├── src/                           # Source code directory
│   ├── app.ts                     # Express server setup and routes
│   ├── controllers/               # Request handlers
│   │   ├── SearchController.ts    # Original Gemini search endpoint
│   │   ├── MetaController.ts      # Meta prompting strategy endpoints
│   │   └── MultiSearchController.ts # Multi-engine search endpoints
│   ├── services/                  # Business logic services
│   │   ├── GeminiService.ts       # Google Gemini API integration
│   │   ├── SearchService.ts       # Core OSINT search logic
│   │   ├── MetaPromptService.ts   # Search strategy analysis
│   │   ├── MultiSearchEngineService.ts # Multi-engine orchestration
│   │   └── searchEngines/         # Individual search engine services
│   │       ├── BingSearchService.ts    # Microsoft Bing Search API
│   │       └── DuckDuckGoService.ts    # DuckDuckGo Instant Answers
│   ├── types/                     # TypeScript type definitions
│   │   ├── gemini.ts              # Gemini API types
│   │   ├── strategy.ts            # Meta prompting types
│   │   └── searchEngines.ts       # Multi-search engine types
│   └── utils/                     # Utility functions
│       ├── responseParser.ts      # API response parsing
│       └── promptBuilder.ts       # Prompt construction
├── dist/                          # Compiled JavaScript (build output)
├── node_modules/                  # Dependencies
└── tests/                         # Test files (planned)
```

### Core Components

#### Original Gemini Search System
1. **SearchController** (`src/controllers/SearchController.ts`): Handles incoming webhook requests
2. **GeminiService** (`src/services/GeminiService.ts`): Manages Gemini API communication
3. **SearchService** (`src/services/SearchService.ts`): Implements business logic for relationship analysis
4. **ResponseParser** (`src/utils/responseParser.ts`): Parses and cleans Gemini API responses
5. **PromptBuilder** (`src/utils/promptBuilder.ts`): Constructs detailed search prompts

#### Meta Prompting System (New Architecture)
1. **MetaController** (`src/controllers/MetaController.ts`): Strategy generation endpoints
2. **MetaPromptService** (`src/services/MetaPromptService.ts`): Analyzes entities and generates search strategies

#### Multi-Search Engine System (New Architecture)
1. **MultiSearchController** (`src/controllers/MultiSearchController.ts`): Multi-engine search endpoints
2. **MultiSearchEngineService** (`src/services/MultiSearchEngineService.ts`): Engine orchestration and result aggregation
3. **BingSearchService** (`src/services/searchEngines/BingSearchService.ts`): Microsoft Bing Search API integration
4. **DuckDuckGoService** (`src/services/searchEngines/DuckDuckGoService.ts`): DuckDuckGo Instant Answers integration

### API Endpoints

#### Original Gemini Search
- **POST `/api/search`**: Main search endpoint that accepts:
  - `Target_institution`: The primary institution to investigate
  - `Risk_Entity`: Comma-separated list of risk entities to research
  - `Location`: Geographic location (determines search languages)
  - `Start_Date`/`End_Date`: Optional time range constraints

#### Meta Prompting Endpoints
- **POST `/api/meta/strategy`**: Generate search strategy for given entities
- **GET `/api/meta/test`**: Test meta prompting with sample data

#### Multi-Search Engine Endpoints
- **GET `/api/multisearch/health`**: Health check for all search engines
- **POST `/api/multisearch/search`**: Execute multi-engine search
- **GET `/api/multisearch/test`**: Quick test with sample query
- **POST `/api/multisearch/compare`**: Compare results across engines
- **GET `/api/multisearch/engines`**: Test engine selection logic

### Input/Output Format

**Input**: JSON object compatible with existing n8n webhook format
**Output**: Structured JSON containing:
- `risk_item`: The specific risk entity investigated
- `institution_A`: The target institution
- `relationship_type`: Direct/Indirect/Significant Mention/No Evidence Found
- `finding_summary`: Analysis summary with source citations
- `potential_intermediary_B`: Any intermediary organizations identified
- `sources`: Array of source URLs

## Environment Configuration

All API keys and configuration are centralized in the `.env` file:

### Core API Keys
- `GEMINI_API_KEY`: Google Gemini API key (required)
- `BING_SEARCH_API_KEY`: Microsoft Bing Search API key (optional)
- `GOOGLE_SEARCH_API_KEY`: Google Search API key (future use)
- `GOOGLE_SEARCH_ENGINE_ID`: Google Search Engine ID (future use)

### MCP Tools API Keys (Planned)
- `NEWS_API_KEY`: NewsAPI integration
- `ARXIV_API_KEY`: ArXiv academic papers
- `OPENCORPORATES_API_KEY`: Company registry data
- `CRUNCHBASE_API_KEY`: Business intelligence

### Specialized Search Engines (Planned)
- `BAIDU_API_KEY`: Chinese search engine
- `YANDEX_API_KEY`: Russian search engine

### Server Configuration
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `API_TIMEOUT`: Gemini API timeout (120000ms)
- `MAX_RETRIES`: Maximum retry attempts (3)

### Multi-Search Engine Settings
- `DEFAULT_MAX_RESULTS_PER_ENGINE`: Results per engine (20)
- `DEDUPLICATION_THRESHOLD`: Result similarity threshold (0.8)
- `MIN_ENGINES_FOR_HIGH_CONFIDENCE`: Minimum engines for confidence (2)

### Rate Limiting
- `REQUESTS_PER_MINUTE`: Request rate limit (60)
- `REQUESTS_PER_HOUR`: Hourly request limit (1000)

## Key Advantages Over n8n Implementation

1. **Enhanced Prompt Engineering**: Ability to use much longer, more detailed prompts without UI limitations
2. **Better Error Handling**: Specialized parsing for Gemini's sometimes inconsistent JSON responses
3. **Improved Maintainability**: Clear code structure vs visual workflow
4. **Performance Optimization**: Potential for concurrent searches and result caching
5. **Testing Coverage**: Comprehensive test suite for reliability
6. **Detailed Logging**: Better debugging and monitoring capabilities

## Development Notes

- The system uses a very detailed system prompt that defines OSINT research methodology
- Special attention is given to parsing Gemini's responses, which can include malformed JSON
- Multi-language search is critical for non-English regions
- Time range filtering must be strictly enforced when provided
- Source URL accuracy and citation matching are essential for result reliability

## Known Issues and Limitations

The following critical issues have been identified during development and testing that affect the reliability and accuracy of OSINT analysis:

### **1. Model Response Inconsistency**
- **Problem**: Same query produces completely different results across multiple runs
- **Impact**: Undermines reliability of analysis results
- **Example**: Three identical searches for HongZhiWei-NanoAcademic relationship returned: "No Evidence", "Direct Relationship", "No Evidence"
- **Root Cause**: Gemini's non-deterministic generation and varying search strategies

### **2. Citation-Source Mismatch**
- **Problem**: Inline citations `[1]`, `[2]` in finding_summary don't align with sources array positions
- **Impact**: Users cannot verify specific claims against sources
- **Example**: Finding mentions `[2]`, `[4]`, `[5]` but sources array numbered 1-6
- **Root Cause**: Inconsistent referencing system in AI responses

### **3. Source Accessibility Issues**
- **Problem**: High percentage of returned source URLs are inaccessible or redirect to error pages
- **Impact**: Prevents verification of claims and reduces trust in results
- **Root Cause**: Google Search Grounding returns redirect URLs that often lead to dead links

### **4. Limited Search Depth**
- **Problem**: Important evidence documents are missed despite existing in public sources
- **Impact**: False negative results when actual relationships exist
- **Example**: Failed to find known PDF evidence at china-see.com despite comprehensive search
- **Root Cause**: Surface-level search strategies, lack of deep web crawling

### **5. Chinese Name Translation Inconsistency**
- **Problem**: Company names translated differently across searches
- **Impact**: Missed relationships due to incorrect name variations
- **Example**: "宏智微科技" vs "鸿之微" vs "宏智威科技" for same company
- **Root Cause**: No standardized entity name resolution system

### **6. Search Result Time Sensitivity**
- **Problem**: Google search results change over time, affecting consistency
- **Impact**: Different results when running same query at different times
- **Root Cause**: Dynamic nature of web content and search engine algorithms

### **7. Single Source Dependency**
- **Problem**: Relies solely on Google Search Grounding API
- **Impact**: Limited coverage of specialized databases, academic sources, government records
- **Root Cause**: Architectural limitation to single search provider

### **8. Lack of Quality Assessment**
- **Problem**: No confidence scoring or source authority evaluation
- **Impact**: Cannot distinguish high-quality vs low-quality evidence
- **Root Cause**: Missing evaluation framework for search results

### **9. URL Transparency Issues**
- **Problem**: Google redirect URLs hide actual source locations
- **Impact**: Cannot assess source credibility or verify origin
- **Root Cause**: Google Search Grounding API design choice

### **10. JSON Parsing Instability**
- **Problem**: Occasional failures in structured data extraction from AI responses
- **Impact**: System errors and incomplete results
- **Root Cause**: Inconsistent AI response formatting

### **Potential Solutions Under Consideration**

- **Multi-run consensus**: Aggregate results from multiple identical queries
- **Enhanced search strategies**: Deep web crawling, specialized database access
- **Entity name standardization**: Company name resolution database
- **Source verification**: Link checking and archive.org fallbacks
- **Confidence scoring**: Machine learning-based result quality assessment
- **Alternative search APIs**: Integration with additional search providers
- **Result caching**: Store verified relationships to improve consistency