# Gemini OSINT Search API

A powerful Node.js/TypeScript implementation of an OSINT (Open-Source Intelligence) search tool that investigates institutional relationships and risk associations using advanced AI and multi-search engine architecture.

## 🚀 Features

### Enhanced Multi-Engine Architecture
- **Meta Prompting System**: Two-stage AI analysis for intelligent search strategy generation
- **Multi-Search Engine Integration**: Supports Google, Baidu, and Yandex engines
- **Geographic Engine Selection**: Automatically selects appropriate engines based on location and risk category
- **Result Aggregation**: Deduplicates and scores results from multiple search engines
- **MCP Tools Integration**: Planned integration with specialized OSINT tools

### Original Gemini Search
- **Google Gemini 2.5 Flash**: Advanced AI analysis with Google Search grounding
- **Multi-language Support**: Automatically searches in English and native languages
- **Time Range Filtering**: Precise date constraints for targeted searches
- **Structured Output**: JSON-formatted relationship analysis with source citations

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
cd gemini-osint-search

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

## 📡 API Endpoints

### Original Gemini Search
- **POST** `/api/search` - Main institutional relationship analysis
- **GET** `/api/health` - System health check

### Multi-Search Engine System
- **GET** `/api/multisearch/health` - Search engine health check
- **POST** `/api/multisearch/search` - Execute multi-engine search
- **GET** `/api/multisearch/test` - Quick test with sample query
- **POST** `/api/multisearch/compare` - Compare results across engines
- **GET** `/api/multisearch/engines` - Test engine selection logic

### Meta Prompting System
- **POST** `/api/meta/strategy` - Generate search strategy for entities
- **GET** `/api/meta/test` - Test meta prompting with sample data

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
