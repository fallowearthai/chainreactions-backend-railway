# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 Current Architecture Status (October 2025)

### Phase 3 Complete - Enterprise-Grade Microservices

**Current State**: ✅ **Production Ready** - October 14, 2025

ChainReactions Backend has been successfully transformed from a monolithic application to a modern microservices architecture with 6 independent services.

### Microservices Architecture

```
services/
├── api-gateway/         # Port 3000 - Unified entry point
├── entity-relations/    # Port 3002 - DeepThinking OSINT + Normal Search
├── entity-search/       # Port 3003 - Linkup business intelligence
├── dataset-matching/    # Port 3004 - Advanced entity matching
├── data-management/     # Port 3005 - CSV processing & Supabase
└── dataset-search/      # Port 3006 - SSE streaming + NRO data
```

### Service Dependencies
- **Redis** (Port 6379): Service discovery and caching
- **Supabase**: PostgreSQL database for data persistence
- **External APIs**: Gemini AI, Linkup, Bright Data SERP

## 🔧 Development Commands

### Starting All Services
```bash
# Start API Gateway (required first)
cd services/api-gateway && npm start &

# Start all microservices in parallel
cd services/entity-relations && npm start &
cd services/entity-search && npm start &
cd services/dataset-matching && npm start &
cd services/data-management && npm start &
cd services/dataset-search && npm start &
```

### Individual Service Development
```bash
# Navigate to any service directory
cd services/[service-name]

# Install dependencies
npm install

# Build TypeScript
npm run build

# Development mode with hot reload
npm run dev

# Type checking
npm run type-check

# Run tests
npm test

# Start production server
npm start
```

### Service Health Verification
```bash
# Check API Gateway health
curl http://localhost:3000/api/health

# Check individual services
curl http://localhost:3002/api/health  # Entity Relations
curl http://localhost:3003/api/health  # Entity Search
curl http://localhost:3004/api/health  # Dataset Matching
curl http://localhost:3005/api/health  # Data Management
curl http://localhost:3006/api/health  # Dataset Search
```

## 🏗️ Architecture Overview

### Service Structure
Each microservice follows this standardized structure:
```
services/[service-name]/
├── src/
│   ├── app.ts              # Express application entry point
│   ├── controllers/        # Request handlers
│   ├── services/          # Business logic
│   ├── types/             # TypeScript definitions
│   └── utils/             # Utility functions
├── package.json           # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── Dockerfile             # Container configuration
├── .env.example           # Environment template
└── README.md              # Service documentation
```

### API Gateway (Port 3000)
- **Purpose**: Unified entry point and request routing
- **Features**: HTTP proxy middleware, CORS management, health monitoring
- **Key Files**: `services/api-gateway/src/app.ts`, `services/api-gateway/.env`

### Core Services

#### Entity Relations (Port 3002)
- **Purpose**: DeepThinking 3-Stage OSINT workflow and Normal Search
- **Features**: Gemini AI integration, Bright Data SERP, SSE streaming
- **Key Configuration**: `GEMINI_API_KEY`, `BRIGHT_DATA_API_KEY`

#### Entity Search (Port 3003)
- **Purpose**: Linkup API integration for professional business intelligence
- **Features**: Multi-strategy JSON parsing, domain filtering, location-based search
- **Key Configuration**: `LINKUP_API_KEY`

#### Dataset Matching (Port 3004)
- **Purpose**: Advanced entity matching algorithms
- **Features**: 5 matching algorithms, configurable weights, dual-layer caching
- **Key Configuration**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

#### Data Management (Port 3005)
- **Purpose**: CSV upload, parsing, and dataset management
- **Features**: Intelligent CSV parsing, Supabase integration, batch processing
- **Key Configuration**: `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_PATH`

#### Dataset Search (Port 3006)
- **Purpose**: SSE streaming search with Canadian NRO data
- **Features**: Real-time streaming, dual API key processing, NRO statistics
- **Key Configuration**: `LINKUP_API_KEY_2`, NRO database access

## 🔑 Environment Configuration

### Service Setup Process
For each service, configure environment variables:
```bash
cd services/[service-name]
cp .env.example .env
# Edit .env with your API keys and configuration
npm install
```

### Critical Environment Variables
Each service has its own `.env.example` with required variables:

**API Gateway**: Service URLs and CORS origins
**Entity Relations**: `GEMINI_API_KEY`, `BRIGHT_DATA_API_KEY`, `BRIGHT_DATA_SERP_ZONE`
**Entity Search**: `LINKUP_API_KEY`, `LINKUP_BASE_URL`
**Dataset Matching**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REDIS_URL`
**Data Management**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPLOAD_PATH`
**Dataset Search**: `LINKUP_API_KEY_2`, NRO configuration

## 🚨 Critical Development Rules

### NEVER Modify System Prompts Without Permission
- **RULE**: NEVER modify any AI system prompts or prompt engineering logic without explicit user approval
- **RATIONALE**: Prompts are carefully crafted for specific AI behavior and output formatting
- **INCLUDES**:
  - System instructions in services
  - Meta-prompting logic
  - AI instruction modifications

### Code Quality Standards
- Follow existing TypeScript conventions
- Maintain consistent error handling patterns
- Preserve API response formats for frontend compatibility
- Use environment variables for all external service configuration
- Always read API documentation before implementation

## 🐳 Docker Deployment

### Individual Service Deployment
```bash
cd services/[service-name]
docker build -t chainreactions-[service-name] .
docker run -p [port]:[port] chainreactions-[service-name]
```

### Container Architecture
- All services run as non-root users
- Health checks implemented via `/api/health` endpoints
- Multi-stage builds for minimal attack surface
- Environment-specific configuration via environment variables

## 📊 Key API Endpoints

### Unified System Endpoints (via API Gateway)
- **GET** `http://localhost:3000/api/health` - All services health status
- **GET** `http://localhost:3000/api` - Complete system overview

### Individual Service Endpoints
Each service implements:
- **GET** `/api/health` - Service status and metadata
- **GET** `/api` - Service information and endpoints
- Service-specific endpoints for business logic

## 🔍 Troubleshooting

### Common Issues
1. **Port Conflicts**: Check if ports 3000, 3002-3006 are available
2. **Environment Variables**: Verify all required variables are set in each service
3. **Service Discovery**: Redis connection falls back to memory cache automatically
4. **CORS Issues**: Verify CORS origins include all frontend domains

### Health Check Failures
```bash
# Check if service is running
ps aux | grep node

# Check port usage
lsof -i :3000  # API Gateway
lsof -i :3002  # Entity Relations
# ... etc for other ports

# View service logs
cd services/[service-name] && npm start  # Shows logs
```

### Development Workflow
1. Start with API Gateway, then individual services
2. Use `npm run dev` for development with hot reload
3. Test endpoints directly before going through API Gateway
4. Monitor service health via `/api/health` endpoints

## 🎯 Business Capabilities

### OSINT Intelligence
- **DeepThinking 3-Stage Workflow**: Advanced analysis with meta-prompting
- **Multi-Engine Search**: Google, Bing, Baidu, Yandex integration
- **Real-time Streaming**: SSE for long-running operations

### Data Processing
- **Entity Matching**: 5 advanced algorithms with configurable weights
- **CSV Processing**: Intelligent parsing and validation
- **Dataset Management**: Complete CRUD operations with Supabase

### Business Intelligence
- **Company Research**: Linkup API integration for professional data
- **NRO Data**: Canadian government organization statistics
- **Geographic Matching**: Location-based entity resolution

---

**Last Updated**: October 14, 2025
**Status**: ✅ Phase 3 Complete - Production Ready
**Architecture**: 6 Independent Microservices
