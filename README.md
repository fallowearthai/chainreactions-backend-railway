# ChainReactions OSINT Platform

A comprehensive Node.js/TypeScript implementation of a unified OSINT (Open-Source Intelligence) platform that combines multiple advanced search and analysis services for institutional relationship investigation and risk assessment.

## 🚀 Unified Services Architecture

### 🔬 Entity Relations (DeepThinking Mode)
- **3-Stage OSINT Workflow**: Meta-prompting → Multi-engine SERP → AI Analysis
- **Google Gemini 2.5 Flash**: Advanced AI analysis with thinking mode and URL context
- **Bright Data SERP API**: Multi-engine search (Google, Baidu, Yandex)
- **Geographic Engine Selection**: Automatic engine optimization based on location
- **Real-time Progress**: Server-Sent Events (SSE) for live workflow updates

### ⚡ Entity Relations (Normal Search Mode)
- **Google Web Search Integration**: Direct Gemini googleSearch tool usage
- **Fast Processing**: 10-30 seconds typical response time
- **Multi-language Support**: Automatic English + native language searches
- **Time Range Filtering**: Optional date constraints for targeted searches
- **N8N Compatible**: Drop-in replacement for existing workflows

### 🔍 Entity Search Service
- **Linkup API Integration**: Professional business intelligence search
- **Smart Domain Filtering**: Excludes 12+ low-quality sources (Wikipedia, Reddit, etc.)
- **Multi-strategy JSON Parsing**: 4-layer fallback mechanism for reliable responses
- **Custom Domain Exclusion**: User-defined domain filtering support

### 🎯 Dataset Matching Service
- **Advanced Algorithms**: Jaro-Winkler, Levenshtein, N-gram similarity matching
- **8 Match Types**: exact, alias, fuzzy, partial, core_match, core_acronym, word_match
- **Database-level Optimization**: PostgreSQL array operations for scalable performance
- **Intelligent Bracket Processing**: Handles entity names with acronyms (e.g., "Organization (ACRONYM)")
- **Batch Processing**: Support for up to 100 entities per request

### 🔍 Dataset Search Service
- **SSE Streaming**: Real-time search progress updates
- **Dual Linkup API**: Parallel processing with 2 API keys for 84% speed improvement
- **Canadian NRO Database**: 103 Canadian organizations integrated
- **Test/Production Modes**: Token-saving test mode for development
- **Intelligent JSON Parsing**: Structured data extraction from Linkup responses

### 📊 Data Management Service
- **CSV/XML/JSON Upload**: Smart parsing with automatic field mapping
- **Supabase Integration**: Complete dataset CRUD operations
- **Priority Field Detection**: Intelligent organization_name, aliases, countries identification
- **Metadata Preservation**: Complete dataset information management

## 🛠 Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **AI Integration**: Google Gemini 2.5 Flash
- **Search Engines**: Google, Baidu, Yandex
- **HTTP Client**: Axios
- **Environment Management**: dotenv
- **Testing**: Jest (planned)

## 📦 Quick Start

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd chainreactions-osint-platform

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your API keys
```

### Development
```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm start            # Start production server
npm run type-check   # Run TypeScript type checking
npm run lint         # Run code quality checks
npm test             # Run tests
```

### Production Deployment
```bash
# Build the application
npm run build

# Start production server
npm start

# The unified platform will be available on port 3000
# All services are accessible through unified API endpoints
```

## 🔧 Configuration

All configuration is centralized in the `.env` file:

### Required API Keys
- `GEMINI_API_KEY`: Google Gemini API key (required)
- `BRIGHT_DATA_API_KEY`: Bright Data SERP API key for multi-engine search (required)
- `BRIGHT_DATA_SERP_ZONE`: Bright Data SERP zone identifier (required)

### Optional Configuration
- Search engine APIs, MCP tools, specialized engines
- Server settings, timeouts, rate limits
- Multi-search engine parameters

See `.env.example` for complete configuration options.

## 📡 Unified API Endpoints

All services are unified on port 3000 with consistent API structure.

### 🔬 Entity Relations (DeepThinking Mode)
- **POST** `/api/enhanced/search` - Complete 3-stage OSINT workflow
- **GET** `/api/enhanced/search-stream` - SSE streaming 3-stage workflow
- **POST** `/api/enhanced/strategy` - Stage 1 only (meta-prompting)
- **GET** `/api/enhanced/test` - Test with sample data
- **GET** `/api/enhanced/info` - Workflow information

### ⚡ Entity Relations (Normal Search Mode)
- **POST** `/api/normal-search` - Fast Google Web Search analysis
- **GET** `/api/normal-search/info` - Service information

### 🔍 Entity Search Service
- **POST** `/api/entity-search` - Professional business intelligence search
- **GET** `/api/entity-search/test` - Test Linkup API connection

### 🎯 Dataset Matching Service
- **POST** `/api/dataset-matching/match` - Single entity matching
- **POST** `/api/dataset-matching/batch` - Batch entity matching
- **GET** `/api/dataset-matching/health` - Matching service health
- **GET** `/api/dataset-matching/stats` - Service statistics
- **GET** `/api/dataset-matching/test` - Test matching with sample entity
- **GET** `/api/dataset-matching/cache/clear` - Clear cache
- **POST** `/api/dataset-matching/cache/warmup` - Warmup cache

### 🔍 Dataset Search Service
- **POST** `/api/dataset-search/stream` - Start streaming search
- **DELETE** `/api/dataset-search/stream/:execution_id` - Cancel search
- **GET** `/api/dataset-search/stream/:execution_id/status` - Get search status
- **GET** `/api/dataset-search/nro-stats` - Get NRO statistics
- **GET** `/api/dataset-search/health` - Service health check
- **GET** `/api/dataset-search/test` - Service test endpoint

### 📊 Data Management Service
- **GET** `/api/data-management/datasets` - List all datasets
- **POST** `/api/data-management/datasets` - Create new dataset
- **GET** `/api/data-management/datasets/:id` - Get dataset details
- **PUT** `/api/data-management/datasets/:id` - Update dataset
- **DELETE** `/api/data-management/datasets/:id` - Delete dataset
- **POST** `/api/data-management/datasets/:id/upload` - Upload CSV file
- **GET** `/api/data-management/datasets/:id/entries` - Get dataset entries
- **GET** `/api/data-management/datasets/:id/stats` - Dataset statistics
- **GET** `/api/data-management/datasets/:id/export` - Export dataset
- **POST** `/api/data-management/import/nro-targets` - Import NRO targets
- **GET** `/api/data-management/health` - Service health check

### 🔧 System Endpoints
- **GET** `/api/health` - Unified health check for all services
- **GET** `/api` - Service information and endpoint overview

## 🧪 Example Usage

### Basic Search
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "Hong Kong Polytechnic University",
    "Risk_Entity": "Huawei",
    "Location": "China"
  }'
```

### Multi-Engine Search
```bash
curl -X POST http://localhost:3000/api/multisearch/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "HongZhiWei Technologies NanoAcademic",
    "location": "China",
    "languages": ["english", "chinese"],
    "max_results_per_engine": 10
  }'
```

## 🏗 Project Structure

```
src/
├── app.ts                          # Express server setup
├── controllers/                    # Request handlers
│   ├── SearchController.ts         # Original Gemini search
│   ├── MetaController.ts          # Meta prompting endpoints
│   └── MultiSearchController.ts   # Multi-engine search
├── services/                      # Business logic
│   ├── GeminiService.ts           # Google Gemini API
│   ├── SearchService.ts           # Core OSINT logic
│   ├── MetaPromptService.ts       # Search strategy analysis
│   ├── MultiSearchEngineService.ts # Engine orchestration
│   └── searchEngines/             # Individual search engines
├── types/                         # TypeScript definitions
└── utils/                         # Utility functions
```

## 🔍 Search Engine Support

### Currently Implemented
- **Google**: Global search engine with comprehensive coverage
- **Baidu**: Chinese search engine for native Chinese content and sources
- **Yandex**: Russian search engine for Cyrillic content and Eastern European sources

## 🌍 Geographic Intelligence

The system automatically selects appropriate search engines based on location:

- **China/Hong Kong/Taiwan**: Google + Baidu for comprehensive coverage
- **Russia/Eastern Europe**: Google + Yandex for native content access
- **Other Regions**: Google + Yandex for global coverage
- **Global**: Google baseline with regional engines based on context

## 🛡 Known Limitations

This system addresses several critical challenges in OSINT research:

1. **Model Response Inconsistency**: Multi-engine approach reduces single-point-of-failure
2. **Source Accessibility**: Result verification and link checking planned
3. **Search Depth**: Multiple engines provide broader coverage
4. **Geographic Restrictions**: Uncensored engines for restricted regions
5. **Entity Name Variations**: Multi-language search with name standardization

See `CLAUDE.md` for detailed technical documentation and known issues.

## 📈 Performance & Scalability

- **Parallel Search Execution**: Multiple engines searched concurrently
- **Result Deduplication**: Intelligent duplicate detection and scoring
- **Rate Limiting**: Configurable request limits per engine
- **Caching**: Planned result caching for improved performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

For issues, feature requests, or questions:
- Create an issue in the GitHub repository
- Check `CLAUDE.md` for detailed technical documentation
- Review API endpoint documentation for usage examples

---

**⚠️ Security Notice**: Never commit `.env` files containing API keys to version control. Always use `.env.example` for sharing configuration templates.
