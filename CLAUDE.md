# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 Current Architecture Status (October 2025)

### Phase 4 Complete - No-Gateway Direct Connection Architecture

**Current State**: ✅ **Production Ready** - October 17, 2025

ChainReactions Backend has evolved from API Gateway pattern to **direct frontend-to-microservice connection** for improved performance and simplified deployment.

### Microservices Architecture

```
services/
├── entity-relations/    # Port 3002 - DeepThinking OSINT + Normal Search
├── entity-search/       # Port 3003 - Linkup business intelligence
├── dataset-matching/    # Port 3004 - Advanced entity matching
├── data-management/     # Port 3005 - CSV processing & Supabase
└── dataset-search/      # Port 3006 - SSE streaming + NRO data
```

### 🏗️ Architecture Evolution - October 17, 2025

**FROM**: Frontend → API Gateway → Microservices
**TO**: Frontend → **Direct Connection** → Microservices

**Benefits**:
- ✅ 10-20% response time improvement (no proxy layer)
- ✅ Simplified deployment and maintenance
- ✅ Better fault isolation
- ✅ CloudFlare CDN routing for production

### Service Dependencies
- **Redis** (Port 6379): Service discovery and caching
- **Supabase**: PostgreSQL database for data persistence
- **External APIs**: Gemini AI, Linkup, Bright Data SERP

## 🔧 Development Commands

### Starting All Services (Direct Connection Architecture)
```bash
# Quick start - All services in background
for service in entity-relations entity-search dataset-matching data-management dataset-search; do
  cd services/$service && npm start &
  cd ../..
done
wait

# Start frontend server (separate terminal)
cd /Users/kanbei/Code/chainreactions_frontend_dev_new && npm run dev &
```

### Alternative: Sequential Startup (Recommended for Development)
```bash
# Start services one by one to verify each starts correctly
cd services/entity-relations && npm run dev    # Port 3002
cd ../entity-search && npm run dev             # Port 3003
cd ../dataset-matching && npm run dev          # Port 3004
cd ../data-management && npm run dev           # Port 3005
cd ../dataset-search && npm run dev            # Port 3006
```

### Individual Service Development
```bash
# Navigate to any service directory
cd services/[service-name]

# Install dependencies
npm install

# Build TypeScript (required for production)
npm run build

# Development mode with hot reload (recommended)
npm run dev

# Type checking (catch errors before runtime)
npm run type-check

# Run tests
npm test

# Start production server (requires build first)
npm start

# Lint code
npm run lint
```

### Performance Testing
```bash
# Run performance tests for dataset matching
node test_performance.js

# Run fixed performance tests
node test_performance_fixed.js
```

### Batch Operations
```bash
# Install dependencies for all services
for service in entity-relations entity-search dataset-matching data-management dataset-search; do
  cd services/$service && npm install && cd ../..
done

# Build all services
for service in entity-relations entity-search dataset-matching data-management dataset-search; do
  cd services/$service && npm run build && cd ../..
done

# Type check all services
for service in entity-relations entity-search dataset-matching data-management dataset-search; do
  cd services/$service && npm run type-check && cd ../..
done
```

### Service Health Verification
```bash
# Check individual microservices (direct connection architecture)
curl http://localhost:3002/api/health  # Entity Relations
curl http://localhost:3003/api/health  # Entity Search
curl http://localhost:3004/api/health  # Dataset Matching
curl http://localhost:3005/api/health  # Data Management
curl http://localhost:3006/api/health  # Dataset Search

# Check frontend
curl http://localhost:3001  # Frontend Vite Dev Server
```

## 🏗️ Architecture Overview

### Service Structure
Each microservice follows this standardized structure:
```
services/[service-name]/
├── src/
│   ├── app.ts              # Express application entry point with middleware setup
│   ├── controllers/        # Request handlers (API endpoints)
│   ├── services/          # Business logic and external API integrations
│   ├── types/             # TypeScript interfaces and type definitions
│   └── utils/             # Utility functions and helpers
├── dist/                  # Compiled JavaScript output (auto-generated)
├── package.json           # Dependencies and npm scripts
├── tsconfig.json         # TypeScript configuration with strict mode
├── Dockerfile             # Multi-stage container configuration
├── .env.example           # Environment variables template
└── README.md              # Service-specific documentation
```

### TypeScript Configuration
All services use strict TypeScript configuration:
- **Target**: ES2020 with CommonJS modules
- **Strict Mode**: Enabled with all strict checks
- **Output**: `dist/` directory with source maps
- **Path Aliases**: `@/*` mapped to `src/*`
- **Compilation**: Required before running `npm start`

### ❌ API Gateway (DEPRECATED - October 17, 2025)
**Status**: ✅ **Removed** - Transitioned to direct frontend-to-microservice connection

**Architecture Change**: Frontend → API Gateway → Microservices → **Frontend → Direct Connection** → Microservices

**Reasons for Removal**:
- **Performance**: Eliminated 10-20% proxy latency
- **Simplicity**: Reduced deployment complexity and maintenance overhead
- **Scalability**: Better fault isolation and independent service scaling
- **Cost**: One less service to maintain and monitor

**Migration Path**: Frontend now connects directly to each microservice using individual URLs. CloudFlare CDN handles routing in production.

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
  - System instructions in services (e.g., Gemini prompts)
  - Meta-prompting logic in DeepThinking workflows
  - AI instruction modifications and template strings

### Code Quality Standards
- **TypeScript Strict Mode**: All services use strict TypeScript - no implicit any, strict null checks
- **Error Handling**: Consistent try-catch patterns with proper HTTP status codes
- **API Compatibility**: Preserve response formats for frontend compatibility
- **Environment Variables**: Use `.env.example` templates, never hardcode API keys
- **Documentation**: Read external API docs before implementation
- **Build Process**: Always run `npm run build` before `npm start` in production

### Development Workflow
1. **Development**: Use `npm run dev` for hot reload during development
2. **Type Checking**: Run `npm run type-check` before commits
3. **Building**: Use `npm run build` to compile TypeScript to JavaScript
4. **Production**: Use `npm start` to run compiled code from `dist/`
5. **Testing**: Use `npm test` and performance tests with `node test_performance.js`

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

### Individual Service Endpoints (Direct Connection)
Each service implements:
- **GET** `/api/health` - Service status and metadata
- **GET** `/api` - Service information and endpoints
- Service-specific endpoints for business logic

### Frontend Access URLs
- **Frontend**: `http://localhost:3001` (Vite Dev Server)
- **Entity Relations**: `http://localhost:3002` - DeepThinking OSINT + Normal Search
- **Entity Search**: `http://localhost:3003` - Linkup business intelligence
- **Dataset Matching**: `http://localhost:3004` - Advanced entity matching
- **Data Management**: `http://localhost:3005` - CSV processing & Supabase
- **Dataset Search**: `http://localhost:3006` - SSE streaming + NRO data

## 🔍 Troubleshooting

### Common Issues
1. **Port Conflicts**: Check if ports 3001, 3002-3006 are available (no more port 3000)
2. **Environment Variables**: Verify all required variables are set in each service's `.env`
3. **TypeScript Compilation**: Run `npm run build` before `npm start` in production
4. **Service Discovery**: Redis connection falls back to memory cache automatically
5. **CORS Issues**: Verify CORS origins include all frontend domains
6. **Service Management**: Use precise process management to avoid accidental service termination

### Health Check Failures
```bash
# Check if service is running
ps aux | grep node

# Check port usage (direct connection architecture)
lsof -i :3001  # Frontend Vite Server
lsof -i :3002  # Entity Relations
lsof -i :3003  # Entity Search
lsof -i :3004  # Dataset Matching
lsof -i :3005  # Data Management
lsof -i :3006  # Dataset Search

# Test service health endpoints
curl http://localhost:3002/api/health
curl http://localhost:3003/api/health
curl http://localhost:3004/api/health
curl http://localhost:3005/api/health
curl http://localhost:3006/api/health

# View service logs
cd services/[service-name] && npm run dev  # Shows live logs
```

### Development Workflow
1. **Startup Order**: Start microservices first (ports 3002-3006), then frontend (port 3001)
2. **Development Mode**: Use `npm run dev` for hot reload during development
3. **Testing**: Test endpoints directly - no API Gateway to go through
4. **Monitoring**: Monitor service health via `/api/health` endpoints
5. **Process Management**: Use precise process management - avoid broad `pkill` commands

### TypeScript Issues
```bash
# Check for TypeScript errors
cd services/[service-name] && npm run type-check

# Common TypeScript errors and solutions:
# - TS2307: Cannot find module -> Install missing dependencies with npm install
# - TS2322: Type mismatch -> Check function signatures and return types
# - TS2580: Cannot find name -> Import missing types or declare variables
```

### 🚨 Process Management Best Practices
```bash
# ❌ AVOID - Too broad, can kill other services
pkill -f "node"
pkill -f "npm"
pkill -f "vite"

# ✅ PREFERRED - Be specific
cd services/entity-relations && npm start
kill <specific_pid>
pm2 restart entity-relations

# ✅ USE - For development safety
npm run dev  # Individual service development
for service in entity-relations entity-search dataset-matching data-management dataset-search; do
  cd services/$service && npm run dev &
  cd ../..
done
```

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

## 📝 Development Scripts Reference

### Root Level Scripts (from package.json)
- `npm run build` - Build root TypeScript project
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run type-check` - TypeScript type checking
- `npm run lint` - ESLint code linting

### Service-Specific Scripts
Each microservice has its own npm scripts in its respective directory:
- `npm run dev` - Development mode with hot reload (recommended for development)
- `npm run build` - Compile TypeScript to JavaScript (required before production)
- `npm start` - Start production server from compiled JavaScript
- `npm test` - Run service-specific tests
- `npm run type-check` - Validate TypeScript types without compilation

**Last Updated**: October 20, 2025
**Status**: ✅ Phase 4 Complete - Direct Connection Architecture
**Architecture**: 5 Independent Microservices + Frontend (No API Gateway)

## 📝 Architecture Change Log

### October 17, 2025 - API Gateway Removal
- **Change**: Removed API Gateway (port 3000) and migrated to direct frontend-to-microservice connection
- **Reason**: Performance improvement (10-20% latency reduction), simplified deployment, better fault isolation
- **Impact**: Frontend now connects directly to each microservice, uses CloudFlare CDN routing for production
- **Lessons Learned**: Process management is critical - avoid broad `pkill` commands that can terminate multiple services

### Issue Resolution - Service Connectivity Problems
- **Problem**: All backend services stopped unexpectedly during frontend restart
- **Root Cause**: Overly broad process termination commands (`pkill -f "vite"` affected other Node.js processes)
- **Solution**: Implemented precise process management and verified service health systematically
- **Prevention**: Added process management best practices and health check procedures
