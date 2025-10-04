# CLAUDE.md - Entity Relations Normal Search Service

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Normal Search Service** for Entity Relations OSINT analysis. Unlike the DeepThinking service which uses a 3-stage workflow with multiple search engines, this service provides a streamlined single-call search using Google's Gemini AI with built-in Google Web Search capabilities.

## Architecture

### Single-Stage Google Search
- **Direct Integration**: Uses Gemini 2.5 Flash model with `googleSearch` tool
- **Simplified Workflow**: Single API call for complete analysis
- **Native Language Support**: Automatic search in both English and target location's language
- **Time Range Filtering**: Optional date constraints using Google's search operators

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST APIs
- **AI**: Google Gemini 2.5 Flash with googleSearch and codeExecution tools
- **Development**: Nodemon with ts-node for hot reload
- **Build**: TypeScript compiler (`tsc`)

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server with hot reload (Port 3005)
npm run build        # Compile TypeScript to JavaScript
npm start            # Start production server
npm test             # Run tests
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

## Project Structure

```
src/
├── app.ts                           # Express server and routes
├── controllers/
│   └── NormalSearchController.ts    # Request handling and response formatting
├── services/
│   └── GeminiNormalSearchService.ts # Gemini API integration with Google Search
└── types/
    └── gemini.ts                    # TypeScript type definitions
```

## API Endpoints

### POST `/api/normal-search`
Execute normal search with Google Web Search.

**Request Format**:
```json
{
  "Target_institution": "Institution name (required)",
  "Risk_Entity": "Risk entity or entities (required)",
  "Location": "Geographic location (required)",
  "Start_Date": "2024-01-01 (optional, YYYY-MM-DD)",
  "End_Date": "2024-12-31 (optional, YYYY-MM-DD)"
}
```

**Response Format**:
```json
{
  "result": "Risk Item: Military\\nInstitution A: Apple Inc\\n...",
  "urls": "1. https://example.com\\n2. https://example2.com",
  "raw_data": {
    "risk_item": "Military",
    "institution_A": "Apple Inc",
    "relationship_type": "Direct",
    "finding_summary": "Detailed analysis with citations [1], [2]",
    "potential_intermediary_B": ["Organization B"],
    "urls": "1. https://...",
    "sources_count": 8,
    "renderedContent": "Google Search rendered HTML",
    "webSearchQueries": ["query1", "query2"]
  }
}
```

### GET `/api/health`
Health check endpoint.

### GET `/api/info`
Service information and capabilities.

## Environment Configuration

```bash
PORT=3005                    # Service port (default)
NODE_ENV=development         # Environment
GEMINI_API_KEY=your_key      # Google Gemini API key (REQUIRED)
```

## Key Features

### 🎯 Core Capabilities
1. **Google Web Search**: Direct integration via Gemini's googleSearch tool
2. **Multi-language Support**: Automatic search in English and native language
3. **Time Range Filtering**: Optional date constraints for search results
4. **Relationship Classification**: Direct, Indirect, Significant Mention, Unknown, No Evidence Found
5. **Intermediary Detection**: Identifies potential intermediary organizations
6. **Source Attribution**: Provides source URLs with numbered citations

### 🚀 Technical Excellence
- **Single API Call**: Simplified workflow compared to DeepThinking
- **Thinking Budget**: 12,000 tokens for complex reasoning
- **Max Output**: 65,536 tokens for comprehensive results
- **Low Temperature**: 0.2 for consistent, factual outputs
- **Robust JSON Parsing**: Multi-layered fallback parsing strategy
- **CORS Support**: Configured for frontend integration (localhost:8080)

### 🌍 Search Optimization
- **Native Language**: Searches in both English and target location's language
- **Google Search Operators**: Uses `before:` and `after:` for date filtering
- **Query Optimization**: AI-generated search queries based on context

## Gemini API Integration

### System Instruction
The service uses a comprehensive OSINT analyst prompt that instructs the AI to:
- Investigate connections between Institution A and Risk List C
- Use Google Search with proper date filtering
- Classify relationship types accurately
- Identify intermediary organizations
- Provide numbered source citations

### Tools Configuration
```typescript
tools: [
  { codeExecution: {} },  // For complex data processing
  { googleSearch: {} }    // For web search capabilities
]
```

### Generation Config
```typescript
generationConfig: {
  thinkingConfig: {
    thinkingBudget: 12000  // Extended thinking for analysis
  },
  temperature: 0.2,        // Low for factual accuracy
  maxOutputTokens: 65536,  // Large for comprehensive results
  topP: 0.95,
  topK: 10
}
```

## JSON Parsing Strategy

The service implements a robust multi-layered JSON parsing approach:

1. **Extract Text**: Merge all text parts from Gemini response
2. **Extract JSON**: Look for markdown ```json blocks or direct JSON
3. **Clean JSON**: Remove control characters and formatting issues
4. **Parse**: Handle both arrays and single objects
5. **Fallback**: Graceful handling of parsing failures

## Response Formatting

The controller formats responses to match the N8N webhook output format:
- `result`: Formatted text with `\\n` line breaks (not real newlines)
- `urls`: Numbered source URLs separated by `\\n`
- `raw_data`: Complete structured data including grounding metadata

## Frontend Integration

### Migration from N8N
This service is designed as a **drop-in replacement** for the N8N webhook:

**Old Endpoint**: `https://n8n.fallowearth.site/webhook/normal-search`
**New Endpoint**: `http://localhost:3005/api/normal-search`

The response format is **identical** to ensure frontend compatibility without code changes.

### Frontend Code Location
The frontend code consuming this API is located at:
`/Users/kanbei/Code/chainreactions_frontend_dev/src/components/dashboard/hooks/useCompanyRelationsSearch.ts`

Lines 84-152 contain the `handleStandardSearch` function that calls this endpoint.

## Comparison with DeepThinking Service

| Feature | Normal Search | DeepThinking |
|---------|--------------|--------------|
| **Port** | 3005 | 3000 |
| **Search Method** | Google Web Search (Gemini) | Multi-Engine SERP |
| **Workflow** | Single API call | 3-stage pipeline |
| **Search Engines** | Google only | Google + Baidu + Yandex |
| **Processing Time** | ~10-30 seconds | ~35-60 seconds |
| **Complexity** | Simplified | Advanced |
| **Cost** | Lower (single API call) | Higher (multiple calls) |
| **Credits** | `ordinary_search` | `deepthinking_search` |
| **Use Case** | Quick investigations | Deep analysis |

## Testing

```bash
# Health check
curl http://localhost:3005/api/health

# Service info
curl http://localhost:3005/api/info

# Test normal search
curl -X POST http://localhost:3005/api/normal-search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "Apple Inc",
    "Risk_Entity": "Military",
    "Location": "United States"
  }'

# Test with date range
curl -X POST http://localhost:3005/api/normal-search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "Apple Inc",
    "Risk_Entity": "Military",
    "Location": "United States",
    "Start_Date": "2023-01-01",
    "End_Date": "2023-12-31"
  }'
```

## Development Principles

### 🚨 Code Quality Standards
- **Never modify system prompts** without explicit user approval
- Follow existing TypeScript conventions from other services
- Maintain consistent error handling patterns
- Preserve API response formats for frontend compatibility
- Use environment variables for all external service configuration

### 📊 Logging Strategy
- Log all search requests with parameters
- Log text extraction and JSON parsing steps
- Log successful results count
- Log errors with context for debugging

## Current Status (October 2025)

### ✅ Production Ready
- Complete implementation of Google Web Search integration
- Robust JSON parsing with multi-layered fallback
- Frontend-compatible response formatting
- Comprehensive error handling
- Health check and info endpoints

### 🎯 Next Steps
1. Frontend migration from N8N webhook to local endpoint
2. Integration testing with frontend application
3. Performance monitoring and optimization
4. Production deployment configuration

## Notes

- Uses Gemini 2.5 Flash for optimal cost/performance balance
- Automatically searches in both English and native language of Location
- Response format matches N8N webhook for seamless frontend migration
- Grounding metadata includes rendered content and web search queries
- Control characters and formatting issues are automatically cleaned
