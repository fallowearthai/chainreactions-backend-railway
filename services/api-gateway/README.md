# API Gateway Service

**Unified entry point for ChainReactions microservices - Phase 3 Final Architecture**

The API Gateway serves as the single entry point for all client requests, routing them to the appropriate microservices and providing cross-cutting concerns like CORS, logging, and error handling.

## 🚀 Features

- **Request Routing**: Intelligent routing to 5 backend microservices
- **Load Balancing**: Distributes requests across service instances
- **CORS Management**: Centralized CORS configuration
- **Error Handling**: Unified error responses and fallback mechanisms
- **Health Monitoring**: Aggregate health checks for all services
- **Request Logging**: Centralized request/response logging
- **Production Ready**: Docker containerization with health checks

## 📋 API Routes

### Gateway Endpoints

#### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "version": "1.0.0",
  "port": 3000,
  "services": {
    "entity_relations": "http://localhost:3002",
    "entity_search": "http://localhost:3003",
    "dataset_matching": "http://localhost:3004",
    "data_management": "http://localhost:3005",
    "dataset_search": "http://localhost:3006"
  }
}
```

#### Gateway Information
```http
GET /api
```

### Proxied Routes

#### Entity Relations Service (Port 3002)
- `POST /api/enhanced/search` - DeepThinking 3-Stage OSINT
- `GET /api/enhanced/search-stream` - SSE streaming analysis
- `POST /api/normal-search` - Fast Google Web Search

#### Entity Search Service (Port 3003)
- `POST /api/entity-search` - Linkup API entity search

#### Dataset Matching Service (Port 3004)
- `POST /api/dataset-matching/match` - Single entity matching
- `POST /api/dataset-matching/batch` - Batch entity matching

#### Data Management Service (Port 3005)
- `GET /api/data-management/datasets` - List datasets
- `POST /api/data-management/datasets` - Create dataset
- `POST /api/data-management/datasets/:id/upload` - Upload CSV

#### Dataset Search Service (Port 3006)
- `POST /api/dataset-search/stream` - SSE streaming search
- `GET /api/dataset-search/nro-stats` - Canadian NRO statistics

## 🛠️ Installation

### Local Development

1. **Install dependencies**:
```bash
cd services/api-gateway
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your service URLs
```

3. **Run in development mode**:
```bash
npm run dev
```

4. **Build for production**:
```bash
npm run build
npm start
```

### Docker Deployment

```bash
# Build image
docker build -t chainreactions/api-gateway:latest .

# Run container
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e ENTITY_RELATIONS_URL=http://entity-relations:3002 \
  -e ENTITY_SEARCH_URL=http://entity-search:3003 \
  -e DATASET_MATCHING_URL=http://dataset-matching:3004 \
  -e DATA_MANAGEMENT_URL=http://data-management:3005 \
  -e DATASET_SEARCH_URL=http://dataset-search:3006 \
  --name api-gateway \
  chainreactions/api-gateway:latest
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Gateway port | No | `3000` |
| `NODE_ENV` | Environment mode | No | `development` |
| `ENTITY_RELATIONS_URL` | Entity Relations service URL | No | `http://localhost:3002` |
| `ENTITY_SEARCH_URL` | Entity Search service URL | No | `http://localhost:3003` |
| `DATASET_MATCHING_URL` | Dataset Matching service URL | No | `http://localhost:3004` |
| `DATA_MANAGEMENT_URL` | Data Management service URL | No | `http://localhost:3005` |
| `DATASET_SEARCH_URL` | Dataset Search service URL | No | `http://localhost:3006` |

### CORS Configuration

**Production Origins**:
- `https://chainreactions.site`
- `https://chainreactions-frontend-dev.vercel.app`
- Vercel deployment domains

**Development Origins**:
- `http://localhost:3001` (Frontend dev)
- `http://localhost:8080` (Legacy frontend)
- `http://localhost:3000` (Self)

## 📊 Architecture

### Request Flow
```
Client Request
    ↓
API Gateway (Port 3000)
    ↓
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Entity Relations│  Entity Search  │Dataset Matching │ Data Management │ Dataset Search  │
│   (Port 3002)   │   (Port 3003)   │   (Port 3004)   │   (Port 3005)   │   (Port 3006)   │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Service Directory Structure
```
services/api-gateway/
├── src/
│   └── app.ts              # Main gateway application
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── Dockerfile              # Container config
├── .env.example            # Environment template
└── README.md               # This file
```

## 🔍 Usage Examples

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Entity Search via Gateway
```bash
curl -X POST http://localhost:3000/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Tesla Inc",
    "location": "Palo Alto, CA"
  }'
```

### Dataset Matching via Gateway
```bash
curl -X POST http://localhost:3000/api/dataset-matching/match \
  -H "Content-Type: application/json" \
  -d '{
    "entity": "Microsoft Corporation",
    "location": "Redmond, WA"
  }'
```

## 🧪 Testing

```bash
# Type checking
npm run type-check

# Build check
npm run build
```

## 📈 Monitoring

### Health Check Endpoint
The gateway provides a health check endpoint that reports the status of the gateway itself and the configured service URLs.

**Endpoint**: `GET /api/health`

**Response includes**:
- Gateway status
- Service version
- Port information
- Configured service URLs
- Timestamp

### Error Handling
The gateway implements comprehensive error handling:
- **502 Bad Gateway**: When a backend service is unreachable
- **500 Internal Error**: For gateway-level errors
- **404 Not Found**: For undefined routes

## 🔒 Security

- Non-root Docker user (gateway:1001)
- Helmet.js security headers
- CORS configuration for production domains
- Request validation and sanitization
- Rate limiting support (future enhancement)

## 🚀 Phase 3 Integration

This API Gateway is the final piece of Phase 3 microservices architecture:
- **Port**: 3000 (unified entry point)
- **Routes to**: 5 independent microservices
- **Service Discovery**: Ready for Redis integration
- **Health Checks**: Aggregate monitoring
- **Load Balancing**: Round-robin support (future)

## 📝 Changelog

### Version 1.0.0 (2025-10-14)
- ✅ Initial API Gateway extraction from main app
- ✅ HTTP proxy middleware integration
- ✅ Routing for all 5 microservices
- ✅ CORS and security configuration
- ✅ Docker containerization with health checks
- ✅ Production-ready configuration
- ✅ Comprehensive error handling

## 📞 Support

For issues or questions:
- GitHub Issues: [chainreactions_backend/issues](https://github.com/yourusername/chainreactions_backend/issues)
- Documentation: See `/docs` folder in root repository

## 📄 License

MIT License - see LICENSE file for details
