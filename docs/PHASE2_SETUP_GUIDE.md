# Phase 2 Setup Guide - API Gateway Architecture

## 📋 Overview

This guide walks through setting up and testing the Phase 2 architecture where services are separated behind an API Gateway.

## 🏗️ Architecture Overview

```
Frontend (8080)
    ↓
API Gateway (3000) - Entry point, routing, monitoring
    ↓
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│   Main App      │ Dataset Search  │ Entity Relations │ Dataset Matching│
│   (4000)        │   (4001)        │   (4002)        │   (4003)        │
│                 │                 │                 │                 │
│ • Entity Search │ • SSE Streaming │ • DeepThinking  │ • Matching Algo │
│ • Data Mgmt     │ • Linkup API    │ • Normal Search  │ • Cache Mgmt    │
│ • Email Service │ • NRO Stats     │ • SERP Execution │ • Supabase      │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
    ↓
Redis (6379) - Service discovery, caching
```

## 🚀 Quick Start

### Prerequisites

1. **Redis Server** (running on localhost:6379)
2. **Node.js 18+** with TypeScript
3. **Environment variables** configured in `.env`

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Start Redis

```bash
# Using Docker (recommended)
docker run -d --name chainreactions-redis -p 6379:6379 redis:7-alpine

# Or install Redis locally
redis-server
```

### Step 3: Start Services

**Option A: Manual Startup (Development)**

```bash
# Terminal 1: Start Main Application (Port 4000)
npm run start:main

# Terminal 2: Start API Gateway (Port 3000)
npm run start:gateway

# Terminal 3: Register Services (one-time setup)
npm run register-services register
```

**Option B: Docker Compose (Production-like)**

```bash
# Build and start all services
npm run phase2:build
npm run phase2:up

# View logs
npm run phase2:logs

# Stop services
npm run phase2:down
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following:

```bash
# Main Application (Port 4000)
PORT=4000
NODE_ENV=development

# API Keys
GEMINI_API_KEY=your_gemini_api_key
BRIGHT_DATA_API_KEY=your_bright_data_key
BRIGHT_DATA_SERP_ZONE=your_serp_zone
LINKUP_API_KEY=your_linkup_key
LINKUP_API_KEY_2=your_linkup_key_2

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Gateway Configuration
GATEWAY_PORT=3000
GATEWAY_HOST=0.0.0.0
LOG_LEVEL=info
```

### Service Registration

```bash
# Register all services with Redis
npm run register-services register

# List registered services
npm run register-services list

# Unregister all services
npm run register-services unregister
```

## 🧪 Testing the Setup

### 1. Test API Gateway

```bash
# Gateway health check
curl http://localhost:3000/api/health

# Gateway info
curl http://localhost:3000/api
```

### 2. Test Main Application Directly

```bash
# Main app health check
curl http://localhost:4000/api/health

# Entity search (direct to main app)
curl -X POST http://localhost:4000/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{"query": "test company", "domains": ["example.com"]}'
```

### 3. Test Through Gateway (Recommended)

```bash
# Entity search through gateway
curl -X POST http://localhost:3000/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{"query": "test company", "domains": ["example.com"]}'

# Data management through gateway
curl http://localhost:3000/api/data-management/datasets

# Email service through gateway
curl -X POST http://localhost:3000/api/demo-request \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "company": "Test Corp"}'
```

### 4. Test Frontend Integration

```bash
# Start frontend (if not already running)
cd ../chainreactions_frontend_dev
npm run dev

# Open browser to http://localhost:8080
# Verify all API calls work through the gateway
```

## 🔍 Monitoring and Debugging

### Gateway Monitoring

```bash
# Gateway health with detailed info
curl http://localhost:3000/api/health

# Main application health
curl http://localhost:4000/api/health

# Service registration status
npm run register-services list
```

### Logging

- **Gateway logs**: Port 3000 startup terminal
- **Main app logs**: Port 4000 startup terminal
- **Redis logs**: Docker container logs or Redis terminal

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 4000, and 6379 are available
2. **Redis connection**: Verify Redis is running and accessible
3. **CORS errors**: Check that frontend origin is in CORS allowlist
4. **Service discovery**: Run `npm run register-services list` to verify services

## 📊 Service Routing

### Current Routing Configuration

| Path Pattern | Target Service | Port | Description |
|--------------|----------------|------|-------------|
| `/api/entity-search/*` | main-app | 4000 | Entity search |
| `/api/data-management/*` | main-app | 4000 | Data management |
| `/api/demo-request` | main-app | 4000 | Email service |
| `/api/test-email` | main-app | 4000 | Email testing |
| `/api/enhanced/*` | entity-relations | 4002 | DeepThinking (future) |
| `/api/normal-search/*` | entity-relations | 4002 | Normal search (future) |
| `/api/dataset-search/*` | dataset-search | 4001 | Dataset search (future) |
| `/api/dataset-matching/*` | dataset-matching | 4003 | Dataset matching (future) |
| `/api/monitoring/*` | gateway | 3000 | Gateway monitoring |
| `/api/health` | gateway | 3000 | Gateway health |
| `/api` | gateway | 3000 | Gateway info |

## 🚦 Phase 2 Status

### ✅ Completed

- [x] API Gateway framework (Port 3000)
- [x] Service discovery with Redis
- [x] Load balancing and circuit breaker
- [x] Main application migration to Port 4000
- [x] Request routing and middleware
- [x] CORS configuration for gateway architecture
- [x] Service registration scripts

### 🚧 In Progress

- [ ] Dataset Search service separation (Port 4001)
- [ ] Entity Relations service separation (Port 4002)
- [ ] Dataset Matching service separation (Port 4003)

### 📋 Next Steps

1. **Week 2**: Extract Dataset Search to Port 4001
2. **Week 3**: Extract Entity Relations to Port 4002
3. **Week 4**: Extract Dataset Matching to Port 4003

## 🛠️ Development Workflow

### Adding New Services

1. Create service in `src/services/`
2. Update `ROUTE_CONFIG` in `gateway/config/GatewayConfig.ts`
3. Add service to `SERVICE_REGISTRY_CONFIG`
4. Update Docker Compose configuration
5. Register service with Redis: `npm run register-services register`

### Testing Service Changes

1. Stop the service
2. Make changes
3. Restart the service
4. Verify through gateway: `curl http://localhost:3000/api/service/health`

### Monitoring Service Health

```bash
# Check all services
npm run register-services list

# Test specific service through gateway
curl http://localhost:3000/api/service-name/health

# Check gateway statistics
curl http://localhost:3000/api/monitoring/status
```

## 📞 Support

If you encounter issues:

1. Check this guide first
2. Review logs in each terminal
3. Verify Redis connectivity
4. Check environment variables
5. Ensure all ports are available

## 🔄 Rollback Plan

If Phase 2 causes issues, you can quickly rollback:

```bash
# Stop gateway
pkill -f "start:gateway"

# Restart main app on original port
PORT=3000 npm run start:main

# Frontend will automatically connect to port 3000
```

This maintains backward compatibility while you debug Phase 2 issues.