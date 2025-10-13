# CLAUDE.md

This file provides guidance to Claude Code when working with the ChainReactions backend deployment repository.

## 🚀 Production Deployment Status (October 2025)

### Current Deployment Architecture

- **Backend Server**: Digital Ocean Ubuntu 22.04 (2GB RAM)
- **Domain**: chainreactions.site
- **SSL**: Let's Encrypt HTTPS
- **Frontend**: Vercel (Development Environment)
  - Primary: `https://chainreactions-frontend-dev.vercel.app`
  - Deployment: `https://chainreactions-frontend-dev-fallowearths-projects-06c459ff.vercel.app`
  - Git Branch: `https://chainreactions-fronte-git-584dee-fallowearths-projects-06c459ff.vercel.app`
- **Backend**: Docker Container (ChainReactions Unified Service on Port 3000)

### 🌐 Network Configuration

```
HTTP (80) → Force Redirect → HTTPS (443)
    ↓
Nginx Reverse Proxy
    ├── /api → localhost:3000 (Docker Container)
    └── / → chainreactions-frontend-dev.vercel.app
```

### ⚡ Current Service Status

- ✅ **Server**: Running normally
- ✅ **Docker**: Container operational
- ✅ **SSL**: HTTPS certificate valid
- ✅ **Health Check**: https://chainreactions.site/api/health ✅
- ✅ **CORS**: Fixed - All hardcoded ports removed (October 13, 2025)
- ✅ **API Configuration**: Frontend uses environment-aware API endpoints
- ⚠️ **Deployment Status**: Code updated, awaiting Docker rebuild and deployment

### 🚨 Recent Fixes and Updates (October 13, 2025)

#### ✅ Fix 1: Removed All Hardcoded Ports (Frontend & Backend)

**Problem**:
- Frontend had hardcoded `localhost:3000` in 5 component files
- Backend had hardcoded `8080` port in 3 CORS configuration files
- This caused production deployment issues with incorrect API endpoints

**Solution Applied**:

**Frontend Changes** (`/Users/kanbei/Code/chainreactions_frontend_dev`):
- ✅ Updated `GetStartedModal.tsx` - Uses `API_ENDPOINTS.DEMO_REQUEST`
- ✅ Updated `DatasetFileUpload.tsx` - Uses `API_ENDPOINTS.DATASET_UPLOAD()`
- ✅ Updated `DatasetEditPage.tsx` - Uses `API_ENDPOINTS.DATASET_ENTRIES()` and `API_ENDPOINTS.DATASETS`
- ✅ Updated `DatasetManagement.tsx` - Uses `API_ENDPOINTS.DATASET_UPLOAD()`
- ✅ Updated `DatasetDetailPage.tsx` - Uses `API_ENDPOINTS` for stats, entries, and export
- ✅ Updated `.env.local` - Added deployment notes

**API Configuration Strategy** (`src/config/api.ts`):
```typescript
// Priority order:
1. Environment variable (VITE_BACKEND_URL) - Highest priority
2. Auto-detect Vercel environment → https://chainreactions.site
3. Auto-detect production domain → https://chainreactions.site
4. Fallback to localhost:3000 (development only)
```

**Backend Changes** (`/Users/kanbei/Code/chainreactions_backend_railway`):
- ✅ Updated `src/app.ts` - Environment-aware CORS configuration
- ✅ Updated `src/services/data-management/app.ts` - Production/dev CORS origins
- ✅ Updated `src/services/dataset-search/app.ts` - Unified CORS configuration

**CORS Configuration** (All backend files):
```typescript
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://chainreactions.site',
        'https://chainreactions-frontend-dev.vercel.app',
        'https://chainreactions-frontend-dev-fallowearths-projects-06c459ff.vercel.app',
        'https://chainreactions-fronte-git-584dee-fallowearths-projects-06c459ff.vercel.app'
      ]
    : ['http://localhost:8080', 'http://localhost:3000', /* other dev ports */],
  credentials: true
}));
```

**Verification**:
- ✅ No hardcoded `localhost:3000` in frontend source files (only in API config fallback)
- ✅ All frontend components use centralized `API_ENDPOINTS`
- ✅ Backend CORS properly configured for production and development
- ✅ Vercel environment variable set: `VITE_BACKEND_URL=https://chainreactions.site`

**Deployment Status**:
- ✅ Frontend: Ready to redeploy on Vercel
- ⚠️ Backend: Code updated, requires Docker rebuild and deployment (see deployment instructions below)

### 📁 Repository Structure

**IMPORTANT**: This is the Digital Ocean deployment repository
- **Local Development**: `/Users/kanbei/Code/chainreactions_backend`
- **Production Deployment**: `/Users/kanbei/Code/chainreactions_backend_railway` (THIS REPOSITORY)
- **Deployment Process**:
  1. Develop and test in `chainreactions_backend`
  2. Manually sync changes to `chainreactions_backend_railway`
  3. Deploy to Digital Ocean server via Docker

---

## Project Overview

**ChainReactions Unified OSINT Platform** - A comprehensive Node.js/TypeScript backend that unifies 6 OSINT services into a single API on Port 3000.

### 🚀 Unified Services (All on Port 3000)

1. **Entity Relations** (DeepThinking + Normal modes) - 3-stage OSINT workflow with Gemini AI
2. **Entity Search** - Linkup API professional business intelligence
3. **Dataset Matching** - Advanced entity matching with multiple algorithms
4. **Data Management** - CSV upload and intelligent parsing
5. **Dataset Search** - SSE streaming search with dual API processing
6. **Demo Email Service** - Gmail SMTP integration for demo requests

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST APIs
- **AI**: Google Gemini 2.5 Flash with thinking mode
- **Search**: Bright Data SERP API (multi-engine), Linkup API
- **Database**: Supabase (PostgreSQL)
- **Email**: Nodemailer with Gmail SMTP
- **Caching**: Redis (optional, falls back to memory cache)

### 🐳 Docker Deployment

#### Quick Start Commands
```bash
# Build and start services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services
docker-compose down
```

#### Docker Services
- **chainreactions-app**: Main application (Port 3000)
- **redis**: Redis caching service (Port 6379 - internal only)

### 🔑 Required Environment Variables

Create a `.env` file with the following:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# AI & Search APIs
GEMINI_API_KEY=your_gemini_api_key
BRIGHT_DATA_API_KEY=your_bright_data_key
BRIGHT_DATA_SERP_ZONE=your_serp_zone
LINKUP_API_KEY=your_linkup_key
LINKUP_API_KEY_2=your_linkup_key_2

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email Service
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# Redis (optional)
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
```

## 🚀 API Endpoints (All on Port 3000)

### Entity Relations - DeepThinking Mode
- **POST `/api/enhanced/search`** - Full 3-stage OSINT analysis
- **GET `/api/enhanced/search-stream`** - SSE streaming with progress
- **POST `/api/enhanced/strategy`** - Stage 1 only (meta-prompting)
- **GET `/api/enhanced/test`** - Test with sample data

### Entity Relations - Normal Search Mode
- **POST `/api/normal-search`** - Fast Google Web Search based OSINT

### Entity Search
- **POST `/api/entity-search`** - Entity search with domain filtering
- **GET `/api/entity-search/test`** - Test Linkup API connection

### Dataset Matching
- **POST `/api/dataset-matching/match`** - Single entity matching
- **POST `/api/dataset-matching/batch`** - Batch entity matching
- **GET `/api/dataset-matching/stats`** - Service statistics
- **DELETE `/api/dataset-matching/cache/clear`** - Clear cache

### Data Management
- **GET `/api/data-management/datasets`** - List all datasets
- **POST `/api/data-management/datasets`** - Create new dataset
- **POST `/api/data-management/datasets/:id/upload`** - Upload CSV file
- **GET `/api/data-management/datasets/:id/entries`** - Get dataset entries
- **GET `/api/data-management/datasets/:id/stats`** - Dataset statistics

### Dataset Search
- **POST `/api/dataset-search/stream`** - Start streaming search
- **DELETE `/api/dataset-search/stream/:execution_id`** - Cancel search
- **GET `/api/dataset-search/stream/:execution_id/status`** - Get search status
- **GET `/api/dataset-search/nro-stats`** - Get NRO statistics

### Demo Email Service
- **POST `/api/demo-request`** - Send demo request email
- **GET `/api/test-email`** - Test email service connection

### System Endpoints
- **GET `/api/health`** - Unified health check for all 6 services
- **GET `/api`** - Service information and endpoint overview

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start production server
npm start

# Development mode with hot reload
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Lint code
npm run lint
```

## 🔒 Port Configuration (CRITICAL)

**FIXED PORT ALLOCATION**:
- **Frontend**: `8080` (Development)
- **Backend Unified Service**: `3000` (Production)
- **Redis**: `6379` (Internal only)

**CORS Configuration**: Backend MUST allow all Vercel deployment domains listed above.

## Project Structure

```
src/
├── app.ts                           # Express server and unified routes
├── controllers/
│   ├── EnhancedSearchController.ts  # DeepThinking workflow
│   ├── NormalSearchController.ts    # Normal search mode
│   ├── EntitySearchController.ts    # Entity search integration
│   ├── DatasetMatchingController.ts # Dataset matching integration
│   ├── DataManagementController.ts  # Data management integration
│   ├── DatasetSearchController.ts   # Dataset search integration
│   └── DemoRequestController.ts     # Demo email service
├── services/
│   ├── entity-search/               # Entity Search service
│   ├── dataset-matching/            # Dataset Matching service
│   ├── dataset-search/              # Dataset Search service
│   ├── data-management/             # Data Management service
│   ├── EmailService.ts              # Email service
│   ├── GeminiService.ts             # Gemini AI integration
│   ├── BrightDataSerpService.ts     # Bright Data SERP
│   └── ...
├── types/                           # TypeScript type definitions
└── templates/                       # Email templates
```

## 🔧 Deployment Checklist

### Pre-Deployment
- [ ] Update `.env` with production API keys
- [ ] Verify CORS origins include all Vercel domains
- [ ] Test all API endpoints locally
- [ ] Run `npm run build` successfully
- [ ] Check Docker configuration

### Deployment
- [ ] Sync code from development to deployment repository
- [ ] Build Docker images
- [ ] Start Docker containers
- [ ] Verify health check endpoint
- [ ] Test frontend-backend connectivity
- [ ] Monitor logs for errors

### Post-Deployment
- [ ] Verify all 6 services operational
- [ ] Test CORS from frontend domains
- [ ] Check Redis caching functionality
- [ ] Monitor resource usage (CPU, memory)
- [ ] Setup log rotation and monitoring

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
- Validate all changes with tests

## 📊 Performance Benchmarks

### Entity Relations - DeepThinking Mode
- **Total Execution Time**: ~107 seconds (Stage 1: 31s + Stage 2: 65s + Stage 3: 11s)
- **API Success Rate**: 100%
- **Results Quality**: 20+ optimized search results per analysis

### Entity Relations - Normal Search Mode
- **Execution Time**: 10-30 seconds
- **Search Engine**: Google Web Search (native Gemini integration)

### Dataset Search
- **Dual API Processing**: 84% speed improvement (164s → 27s for 6 entities)
- **Parallel Execution**: 2 API keys with round-robin distribution

## 🔍 Troubleshooting

### Health Check Fails
```bash
# Check if container is running
docker ps

# View container logs
docker logs chainreactions-app

# Restart container
docker-compose restart
```

### CORS Issues
- Verify CORS origins in `src/app.ts`
- Check Nginx proxy headers
- Test with browser DevTools Network tab

### Port Conflicts
```bash
# Check what's using port 3000
lsof -i :3000

# Kill process if needed
kill -9 PID
```

### Redis Connection Issues
- Service falls back to memory cache automatically
- Check Redis container status: `docker ps | grep redis`
- View Redis logs: `docker logs chainreactions-redis`

## 📚 Additional Documentation

For detailed development documentation, see the main development repository:
`/Users/kanbei/Code/chainreactions_backend/CLAUDE.md`

---

**Last Updated**: October 2025
**Deployment Target**: Digital Ocean Ubuntu 22.04 + Docker
**Domain**: chainreactions.site
