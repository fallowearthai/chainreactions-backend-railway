# Entity Relations Normal Search Service

Google Web Search based OSINT analysis service using Gemini AI with native Google Search capabilities.

## Overview

This service provides normal (non-deepthinking) OSINT analysis by leveraging Google's Gemini 2.5 Flash model with built-in Google Search tools. It investigates potential connections between institutions and risk entities through web search.

## Features

- **Google Web Search Integration**: Direct integration via Gemini's `googleSearch` tool
- **Multi-language Support**: Automatic search in both English and native language
- **Time Range Filtering**: Optional date range constraints for search results
- **Relationship Classification**: Direct, Indirect, Significant Mention, Unknown, No Evidence Found
- **Intermediary Detection**: Identifies potential intermediary organizations
- **Source Attribution**: Provides source URLs for all findings

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **AI Model**: Google Gemini 2.5 Flash
- **Search Method**: Google Web Search (via Gemini googleSearch tool)

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Start the server**:
   ```bash
   # Development mode with hot reload
   npm run dev

   # Production mode
   npm start
   ```

## API Endpoints

### POST /api/normal-search
Execute normal OSINT search.

**Request Body**:
```json
{
  "Target_institution": "Institution name",
  "Risk_Entity": "Risk entity or entities",
  "Location": "Geographic location",
  "Start_Date": "2024-01-01",  // Optional
  "End_Date": "2024-12-31"      // Optional
}
```

**Response**:
```json
{
  "result": "Risk Item: Military\\nInstitution A: Apple Inc\\n...",
  "urls": "1. https://example.com\\n2. https://example2.com",
  "raw_data": {
    "risk_item": "Military",
    "institution_A": "Apple Inc",
    "relationship_type": "Direct",
    "finding_summary": "...",
    "potential_intermediary_B": ["Org B"],
    "urls": "1. https://...",
    "sources_count": 2,
    "renderedContent": "...",
    "webSearchQueries": ["query1", "query2"]
  }
}
```

### GET /api/health
Health check endpoint.

### GET /api/info
Service information and capabilities.

## Development

```bash
# Run in development mode
npm run dev

# Type checking
npm run type-check

# Run tests
npm test

# Lint code
npm run lint
```

## Port Configuration

- **Default Port**: 3005
- **CORS**: Configured for `http://localhost:8080` (frontend)

## Comparison with DeepThinking

| Feature | Normal Search | DeepThinking |
|---------|--------------|--------------|
| **Search Method** | Google Web Search | WebSearch Meta-Prompt + Multi-Engine SERP |
| **AI Processing** | Single Gemini call | 3-stage workflow |
| **Search Engines** | Google only | Google + Baidu + Yandex |
| **Processing Time** | ~10-30 seconds | ~35-60 seconds |
| **Complexity** | Simplified | Advanced |
| **Cost** | Lower | Higher |
| **Use Case** | Quick investigations | Deep analysis |

## Environment Variables

```bash
PORT=3005                    # Service port
NODE_ENV=development         # Environment mode
GEMINI_API_KEY=your_key      # Google Gemini API key
```

## Testing

```bash
# Health check
curl http://localhost:3005/api/health

# Info endpoint
curl http://localhost:3005/api/info

# Test search
curl -X POST http://localhost:3005/api/normal-search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "Apple Inc",
    "Risk_Entity": "Military",
    "Location": "United States"
  }'
```

## Integration with Frontend

The service is designed to be a drop-in replacement for the N8N webhook endpoint:

**Old**: `https://n8n.fallowearth.site/webhook/normal-search`
**New**: `http://localhost:3005/api/normal-search`

The response format is identical to ensure frontend compatibility.

## Architecture

```
src/
├── app.ts                           # Express server setup
├── controllers/
│   └── NormalSearchController.ts    # Request handling and formatting
├── services/
│   └── GeminiNormalSearchService.ts # Gemini API integration
└── types/
    └── gemini.ts                    # TypeScript type definitions
```

## Notes

- Uses Gemini 2.5 Flash model for optimal cost/performance
- Thinking budget: 12,000 tokens for complex reasoning
- Max output tokens: 65,536 for comprehensive results
- Temperature: 0.2 for consistent, factual outputs
- Automatically searches in both English and native language based on Location
