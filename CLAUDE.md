# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChainReactions Backend is a microservices architecture implementing OSINT (Open-Source Intelligence) capabilities through independent Node.js/TypeScript services. The project follows a modular approach where each feature is developed as a separate service before being integrated into a unified API gateway.

## Architecture

### Microservices Design
The project consists of independent services running on separate ports:

1. **Entity Relations DeepThinking** (Port 3000) - 3-stage OSINT workflow with AI analysis
2. **Demo Request Email Service** (Port 3001) - Email handling service
3. **Entity Search Service** (Port 3002) - Linkup API integration for entity search
4. **Dataset Matching Service** (Port 3003) - Advanced entity matching algorithms
5. **Data Management Service** (Port 3006) - CSV upload and intelligent parsing service

### Common Technology Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST APIs
- **Development**: Nodemon with ts-node for hot reload
- **Build**: TypeScript compiler (`tsc`)
- **Testing**: Jest framework

## Development Commands

Each service follows the same command structure:

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm start            # Start production server
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking without compilation
```

## 🔒 Port Configuration Rules (CRITICAL)

**FIXED PORT ALLOCATION - DO NOT CHANGE**:
- **Frontend**: `8080` (STRICT - no auto-increment allowed)
- **Entity Relations DeepThinking**: `3000`
- **Demo Email Service**: `3001`
- **Entity Search Service**: `3002`
- **Dataset Matching Service**: `3003`
- **Data Management Service**: `3006`

**Port Conflict Resolution**:
```bash
# Check port status
lsof -i :PORT_NUMBER

# Kill process occupying port
kill PID_NUMBER

# Always start services in order: Backend services first, then frontend
```

**CORS Configuration**: All backend services MUST allow `http://localhost:8080` origin
**Testing Ports**: Use range `9000-9999` to avoid conflicts with production ports

### Service-Specific Directories
- `entity_relations_deepthinking/` - Main OSINT analysis service
- `entity_search/` - Entity search via Linkup API
- `demo_email/` - Email service for demo requests
- `dataset_matching/` - Entity matching algorithms
- `data_management/` - CSV upload and intelligent parsing service
- `dataset_search/` - (Planned) Dataset search functionality

## Key Services Documentation

### Entity Relations DeepThinking Service
**Primary Service** - Comprehensive OSINT analysis with 3-stage workflow:

1. **Stage 1**: WebSearch Meta-Prompting for intelligent search strategy
2. **Stage 2**: Multi-engine SERP execution (Google, Baidu, Yandex)
3. **Stage 3**: AI analysis and relationship integration

**Key Features**:
- Google Gemini 2.5 Flash integration with thinking mode
- Bright Data SERP API for multi-engine search
- Geographic engine optimization
- Server-Sent Events (SSE) for real-time progress
- Structured OSINT output format

**Critical Implementation Notes**:
- Contains extensive CLAUDE.md with detailed architecture
- JSON parsing includes multi-layered fallback strategies
- Never modify AI system prompts without explicit permission
- Includes intelligent search engine normalization

### Entity Search Service
Linkup API integration for professional business intelligence:
- Intelligent domain filtering (excludes 12+ low-quality sources)
- Custom exclude_domains parameter support
- Multi-strategy JSON parsing with 4 fallback mechanisms

### Dataset Matching Service
Advanced entity matching with multiple algorithms:
- Jaro-Winkler, Levenshtein, N-gram similarity algorithms
- Quality assessment system with false positive filtering
- 8 match types: exact, alias, alias_partial, fuzzy, partial, core_match, core_acronym, word_match
- Memory caching with 5-minute expiry
- Batch processing support (up to 100 entities)
- Intelligent bracket processing for entity names with acronyms (e.g., "National University of Defense Technology (NUDT)")
- Geographic matching and regional boosting algorithms
- Configurable similarity thresholds and algorithm weights

### Data Management Service
CSV upload and intelligent parsing with Supabase integration:
- Smart CSV parser with automatic field mapping
- Support for multiple CSV formats with high adaptability
- Priority field detection: organization_name, aliases, countries
- Metadata preservation for unmapped fields
- Supabase database integration with dataset_entries table
- Real-time upload progress and validation

### Demo Email Service
Gmail SMTP integration for demo request handling:
- Nodemailer integration
- HTML email templates
- Form validation and error handling

## Environment Configuration

Each service requires its own `.env` file with service-specific API keys:

### Common Environment Variables
```bash
PORT=3000                    # Service port
NODE_ENV=development         # Environment
```

### Service-Specific Keys
- `GEMINI_API_KEY` - Google Gemini API (Entity Relations)
- `BRIGHT_DATA_API_KEY` - Bright Data SERP API (Entity Relations)
- `LINKUP_API_KEY` - Linkup API (Entity Search)
- `GMAIL_APP_PASSWORD` - Gmail SMTP (Demo Email)
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` - Database (Dataset Matching)

## Development Workflow

### Testing Individual Services
Each service can be tested independently:

```bash
# Entity Relations DeepThinking (Full 3-stage workflow)
cd entity_relations_deepthinking
curl -X POST http://localhost:3000/api/enhanced/search \
  -H "Content-Type: application/json" \
  -d '{"Target_institution": "NanoAcademic Technologies", "Risk_Entity": "HongZhiWei", "Location": "China"}'

# Entity Search
cd entity_search
curl -X POST http://localhost:3002/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{"query": "Apple Inc", "exclude_domains": ["wikipedia.org"]}'

# Dataset Matching
cd dataset_matching
curl -X POST http://localhost:3003/api/dataset-matching/match \
  -H "Content-Type: application/json" \
  -d '{"entity": "Apple Inc", "match_type": "fuzzy"}'
```

### Service Health Checks
All services provide health check endpoints:
- `/api/health` - Basic health status
- Service-specific test endpoints available

## Project Status and Development Strategy

### Completed Modules (100%)
1. ✅ Demo Request Email Service
2. ✅ Entity Relations DeepThinking (with frontend integration)
3. ✅ Entity Search Service
4. ✅ Dataset Matching Service
5. ✅ Data Management Service (CSV upload and intelligent parsing)

### Planned Development
1. **Dataset Search Service** - Excel processing and relationship search
2. **Unified API Gateway** - Service orchestration and routing
3. **Production Deployment** - Containerization and scaling

### Development Philosophy
- **Modular First**: Each feature developed as independent service
- **Integration Later**: Services unified through API gateway
- **Frontend Compatibility**: Maintain existing frontend interface compatibility
- **Progressive Migration**: Gradual replacement of N8N workflows

## Critical Development Rules

### Frontend Project Location
**IMPORTANT**: The frontend project is located at `/Users/kanbei/Code/chainreactions_frontend_dev/`
- **NEVER** start services from `entity_relations_deepthinking` as frontend
- Frontend runs on port 8080+ (Vite will auto-increment if ports are busy)
- Backend data management service runs on port 3006
- Always use `cd /Users/kanbei/Code/chainreactions_frontend_dev && npm run dev` for frontend

### Entity Relations DeepThinking Service Rules
- **NEVER modify system prompts** without explicit user approval
- Prompts are carefully crafted for specific AI behavior and output formatting
- This includes system instructions, meta-prompting logic, and AI instructions

### General Code Quality
- Follow existing TypeScript conventions in each service
- Maintain consistent error handling patterns
- Preserve API response formats for frontend compatibility
- Use environment variables for all external service configuration

## Testing and Quality Assurance

### Service Testing
- Each service includes comprehensive Jest test setup
- Health check endpoints for service validation
- API endpoint testing with sample data

### Type Safety
- Full TypeScript implementation across all services
- Type checking via `npm run type-check`
- Interface definitions in dedicated `types/` directories

### Code Quality
- ESLint configuration for consistent code style
- Automated linting via `npm run lint`

## Architecture Evolution

The project is designed for evolution from independent microservices to a unified system:

1. **Phase 1**: ✅ Independent service development
2. **Phase 2**: 🚧 Service integration and API gateway
3. **Phase 3**: 🎯 Production deployment and scaling

This modular approach ensures each component is fully functional before integration, reducing complexity and enabling independent testing and development.