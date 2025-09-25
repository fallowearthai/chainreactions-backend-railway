# Dataset Matching Service

ChainReactions Dataset Matching Service - Enhanced Entity Matching with AI-powered algorithms

## 🎯 Overview

This service provides advanced entity matching capabilities for the ChainReactions OSINT platform. It intelligently matches organizations and entities against known datasets (sanctions lists, risk entities, etc.) using multiple matching algorithms and quality assessment techniques.

## ✨ Features

- **Multi-Algorithm Matching**: Exact, alias, fuzzy, semantic, and partial matching
- **Quality Assessment**: Intelligent scoring to reduce false positives
- **High Performance**: Multi-level caching and batch processing
- **Real-time Processing**: Fast response times with optimized algorithms
- **Multi-language Support**: Handles English, Chinese, and mixed-language entities
- **Context Awareness**: Improves matching accuracy based on search context

## 🏗️ Architecture

### Matching Types
- **Exact**: Perfect name matches
- **Alias**: Known aliases and acronyms
- **Alias Partial**: Partial alias matching
- **Fuzzy**: Levenshtein and Jaro-Winkler similarity
- **Partial**: Substring and containment matching
- **Core Match**: Normalized core name matching (ignoring parentheses, etc.)

### Quality Metrics
- **Specificity Score**: Avoids generic terms
- **Length Ratio**: Ensures reasonable length proportions
- **Word Coverage**: Measures matching completeness
- **Context Relevance**: Contextual scoring (optional)

## 📁 Project Structure

```
src/
├── app.ts                          # Express application entry point
├── controllers/
│   └── DatasetMatchingController.ts # Request handlers
├── services/
│   ├── DatasetMatchingService.ts    # Core matching logic
│   ├── CacheService.ts              # Caching implementation
│   └── SupabaseService.ts           # Database operations
├── algorithms/
│   ├── TextMatching.ts              # Text matching algorithms
│   ├── QualityAssessment.ts         # Quality scoring
│   └── EntityNormalization.ts      # Text normalization
├── types/
│   └── DatasetMatchTypes.ts         # TypeScript definitions
└── utils/
    ├── ResponseFormatter.ts         # API response formatting
    └── ErrorHandler.ts              # Error handling utilities
```

## 🚀 API Endpoints

### Service Information
- `GET /api` - Service information and available endpoints
- `GET /api/health` - Health check with system status

### Dataset Matching
- `POST /api/dataset-matching/match` - Match single entity
- `POST /api/dataset-matching/batch` - Match multiple entities
- `GET /api/dataset-matching/cache/clear` - Clear matching cache

### Testing
- `GET /api/test-supabase` - Test database connectivity

## 📊 API Usage Examples

### Single Entity Match
```bash
curl -X POST http://localhost:3003/api/dataset-matching/match \
  -H "Content-Type: application/json" \
  -d '{
    "entity": "Shanghai Jiao Tong University",
    "minConfidence": 0.7,
    "matchTypes": ["exact", "alias", "fuzzy"]
  }'
```

### Batch Match
```bash
curl -X POST http://localhost:3003/api/dataset-matching/batch \
  -H "Content-Type: application/json" \
  -d '{
    "entities": ["Tesla Inc", "Microsoft", "Apple"],
    "options": {
      "minConfidence": 0.6,
      "forceRefresh": false
    }
  }'
```

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server Configuration
PORT=3003
NODE_ENV=development

# Supabase Configuration (Required)
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Matching Configuration
DEFAULT_MIN_CONFIDENCE=0.6
CACHE_EXPIRATION_MINUTES=5
BATCH_SIZE_LIMIT=100
```

### Matching Configuration
- **DEFAULT_MIN_CONFIDENCE**: Minimum confidence threshold (0.0-1.0)
- **CACHE_EXPIRATION_MINUTES**: Cache TTL in minutes
- **BATCH_SIZE_LIMIT**: Maximum entities per batch request

## 🛠️ Development

### Prerequisites
- Node.js 18+
- TypeScript 5+
- Supabase account with datasets configured
- Redis (optional, for distributed caching)

### Setup
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### Development Scripts
- `npm run dev` - Development mode with auto-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run type-check` - Type checking without build
- `npm run lint` - Code linting
- `npm test` - Run tests

## 🎯 Performance Characteristics

### Expected Performance
- **Single Match**: < 50ms average response time
- **Batch Match (10 entities)**: < 200ms average response time
- **Cache Hit Ratio**: 90%+ for repeated queries
- **Concurrent Requests**: Supports 100+ concurrent requests

### Optimization Features
- Multi-level caching (memory + Redis)
- Batch processing with parallel execution
- Database connection pooling
- Response compression
- Query optimization

## 🔧 Matching Algorithm Details

### Text Normalization
- Removes parentheses and organizational suffixes
- Standardizes spacing and punctuation
- Handles Unicode normalization
- Supports multiple languages

### Quality Assessment
- **Generic Term Detection**: Filters common words
- **Length Validation**: Ensures reasonable proportions
- **Context Scoring**: Improves accuracy based on usage
- **Confidence Calibration**: Dynamic threshold adjustment

### Fuzzy Matching
- **Levenshtein Distance**: Character-level differences
- **Jaro-Winkler Similarity**: Optimized for names
- **N-gram Analysis**: Substring matching
- **Phonetic Matching**: Handles pronunciation variants

## 🐛 Troubleshooting

### Common Issues

**Supabase Connection Fails**
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
- Check network connectivity
- Ensure Supabase project is active

**Low Match Quality**
- Adjust `DEFAULT_MIN_CONFIDENCE` threshold
- Check dataset quality and completeness
- Review entity normalization settings

**Performance Issues**
- Enable Redis caching
- Increase `CACHE_EXPIRATION_MINUTES`
- Optimize batch sizes

**Memory Usage**
- Monitor cache size limits
- Implement cache cleanup strategies
- Use Redis for distributed caching

### Debug Mode
Set `NODE_ENV=development` for detailed logging:
- Request/response logging
- Algorithm performance metrics
- Cache hit/miss statistics
- Error stack traces

## 📈 Monitoring

### Health Check Response
```json
{
  "status": "healthy",
  "service": "Dataset Matching Service",
  "version": "1.0.0",
  "timestamp": "2024-09-25T10:00:00.000Z",
  "uptime": 3600.123,
  "memory": { "rss": 52428800, "heapTotal": 29360128, "heapUsed": 20971520 },
  "environment": "development",
  "supabase_configured": true,
  "redis_configured": true
}
```

### Key Metrics
- Response times by endpoint
- Cache hit ratios
- Error rates by type
- Memory usage trends
- Database query performance

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Supabase connection tested
- [ ] Redis configured (recommended)
- [ ] SSL/TLS enabled
- [ ] Rate limiting configured
- [ ] Monitoring enabled
- [ ] Log rotation configured

### Docker Support (Coming Soon)
```dockerfile
# Dockerfile will be added in future releases
```

## 🤝 Contributing

This service is part of the ChainReactions backend ecosystem. Follow the established patterns:
- TypeScript for type safety
- Express.js for HTTP handling
- Consistent error handling
- Comprehensive logging
- Unit and integration tests

## 📝 Changelog

### v1.0.0 (2024-09-25)
- Initial release
- Core matching algorithms implemented
- Multi-level caching system
- Quality assessment framework
- Batch processing support
- Comprehensive API documentation

## 📞 Support

For support and questions:
- Check the troubleshooting section
- Review logs for error details
- Verify environment configuration
- Test database connectivity

---

**Dataset Matching Service** - Part of the ChainReactions OSINT Platform