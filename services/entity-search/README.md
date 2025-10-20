# Entity Search Service

**Linkup API integration for professional business intelligence**

Part of the ChainReactions microservices architecture, this service provides entity search capabilities using the Linkup API for comprehensive business intelligence gathering.

## 🚀 Features

- **Professional Business Intelligence**: Advanced entity search with AI-powered analysis
- **Multi-Strategy JSON Parsing**: Robust parsing of various response formats
- **Domain Filtering**: Exclude low-quality sources from search results
- **Location-Based Search**: Optional location parameter for precise entity identification
- **Health Monitoring**: Built-in health check endpoints
- **Production Ready**: Docker containerization with health checks

## 📋 API Endpoints

### Search Entity
```http
POST /api/entity-search
Content-Type: application/json

{
  "company_name": "Tesla Inc",
  "location": "Palo Alto, CA",
  "exclude_domains": ["example.com"]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "data": {
        "company_info": {
          "original_name": "Tesla, Inc.",
          "english_name": "Tesla",
          "description": "Electric vehicle and clean energy company",
          "headquarters": "...",
          "sectors": ["Automotive", "Energy"],
          "vendors": [...],
          "partnerships": [...],
          "research_references": [...]
        },
        "sources": [...]
      }
    }
  ],
  "message": "Entity search completed successfully"
}
```

### Health Check
```http
GET /api/health
```

### Service Info
```http
GET /api/info
```

## 🛠️ Installation

### Local Development

1. **Install dependencies**:
```bash
cd services/entity-search
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your Linkup API key
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
docker build -t chainreactions/entity-search:latest .

# Run container
docker run -d \
  -p 3003:3003 \
  -e LINKUP_API_KEY=your_key_here \
  -e NODE_ENV=production \
  --name entity-search \
  chainreactions/entity-search:latest
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Service port | No | `3003` |
| `NODE_ENV` | Environment mode | No | `development` |
| `LINKUP_API_KEY` | Linkup API key | Yes | - |
| `LINKUP_BASE_URL` | Linkup API base URL | No | `https://api.linkup.so/v1` |
| `REDIS_URL` | Redis connection URL | No | - |

## 📊 Architecture

```
services/entity-search/
├── src/
│   ├── app.ts                 # Express application
│   ├── controllers/
│   │   └── EntitySearchController.ts
│   ├── services/
│   │   ├── LinkupService.ts   # Linkup API integration
│   │   └── responseParser.ts  # Multi-strategy JSON parser
│   └── types/
│       └── types.ts           # TypeScript definitions
├── Dockerfile
├── package.json
└── tsconfig.json
```

## 🔍 Usage Examples

### Basic Search
```javascript
const response = await fetch('http://localhost:3003/api/entity-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_name: 'Microsoft Corporation'
  })
});

const data = await response.json();
console.log(data.data[0].data.company_info);
```

### Search with Location
```javascript
const response = await fetch('http://localhost:3003/api/entity-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_name: 'Apple Inc',
    location: 'Cupertino, CA'
  })
});
```

### Custom Domain Exclusion
```javascript
const response = await fetch('http://localhost:3003/api/entity-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_name: 'Amazon',
    exclude_domains: ['wikipedia.org', 'reddit.com', 'example.com']
  })
});
```

## 🧪 Testing

```bash
# Run tests
npm test

# Type checking
npm run type-check
```

## 📈 Health Monitoring

The service exposes a health check endpoint that verifies:
- Service availability
- Linkup API configuration
- Environment setup

**Note**: Health checks do NOT make actual API calls to avoid consuming credits.

## 🔒 Security

- Non-root Docker user
- API key protection via environment variables
- CORS configuration for production domains
- Request validation and sanitization

## 🚀 Phase 3 Integration

This service is part of Phase 3 microservices architecture:
- **Port**: 3003
- **Access**: Via API Gateway on port 3000
- **Service Discovery**: Redis-based registration
- **Health Checks**: Automatic monitoring

## 📝 Changelog

### Version 1.0.0 (2025-10-14)
- ✅ Initial standalone service extraction from main app
- ✅ Multi-strategy JSON parsing implementation
- ✅ Docker containerization with health checks
- ✅ Production-ready configuration
- ✅ Comprehensive API documentation

## 📞 Support

For issues or questions:
- GitHub Issues: [chainreactions_backend/issues](https://github.com/yourusername/chainreactions_backend/issues)
- Documentation: See `/docs` folder in root repository

## 📄 License

MIT License - see LICENSE file for details
