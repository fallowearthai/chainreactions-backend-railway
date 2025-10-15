# Dataset Matching Service

**Port 4003** - Advanced entity matching algorithms with multi-algorithm support, caching, and batch processing capabilities.

## Overview

The Dataset Matching Service provides sophisticated entity matching capabilities using multiple algorithms and techniques to find relationships between entities in large datasets. It features configurable similarity weights, geographic matching, and intelligent caching.

## Core Algorithms

### 🧠 Advanced Matching Algorithms

#### Text Matching Algorithm
- **Jaro-Winkler Similarity**: Optimized for string similarity
- **Levenshtein Distance**: Edit distance measurement
- **Word-Level Matching**: Semantic word comparison
- **Character N-Grams**: Substring pattern matching

#### Entity Normalization
- **Case Normalization**: Standardized text case handling
- **Punctuation Handling**: Clean and normalize punctuation
- **Stop Word Removal**: Filter common non-informative words
- **Acronym Detection**: Identify and expand acronyms

#### Geographic Matching
- **Location-Based Boosting**: Prioritize geographically relevant matches
- **Country Normalization**: Standardize country names and codes
- **Regional Search Radius**: Configurable geographic search areas
- **Proximity Scoring**: Distance-based relevance ranking

#### Quality Assessment
- **Confidence Scoring**: Statistical confidence in match quality
- **Relevance Ranking**: Sort matches by relevance
- **Duplicate Detection**: Identify and merge duplicate matches
- **Quality Metrics**: Multiple quality indicators

#### Configurable Matching
- **Weighted Similarity Scoring**: Customizable algorithm weights
- **Custom Algorithm Selection**: Choose specific matching algorithms
- **Context-Aware Matching**: Consider entity context in matching
- **Threshold Configuration**: Adjustable similarity thresholds

## Features

### 🚀 Performance Features
- ✅ **In-Memory Caching**: Fast response times with configurable TTL
- ✅ **Batch Processing**: Handle up to 100 entities simultaneously
- ✅ **Concurrent Requests**: Support multiple simultaneous queries
- ✅ **Progressive Search**: Multi-stage search optimization

### 🎯 Advanced Capabilities
- ✅ **Multi-Algorithm Support**: Combine multiple matching algorithms
- ✅ **Geographic Intelligence**: Location-aware matching
- ✅ **Quality Scoring**: Confidence and relevance metrics
- ✅ **Configurable Weights**: Customizable algorithm parameters

### 📊 Analytics & Monitoring
- ✅ **Service Statistics**: Detailed performance metrics
- ✅ **Cache Analytics**: Cache hit rates and efficiency
- ✅ **Algorithm Performance**: Per-algorithm performance data
- ✅ **Batch Processing Stats**: Batch job statistics

## API Endpoints

### Core Matching
- `POST /api/dataset-matching/match` - Single entity matching
- `POST /api/dataset-matching/batch` - Batch entity matching

### Cache Management
- `DELETE /api/dataset-matching/cache/clear` - Clear all cache
- `POST /api/dataset-matching/cache/warmup` - Warm up cache with common queries

### Monitoring & Testing
- `GET /api/dataset-matching/stats` - Service statistics
- `GET /api/dataset-matching/health` - Health check with detailed status
- `GET /api/dataset-matching/test` - Test matching with sample entity

### System
- `GET /api/health` - Overall service health
- `GET /api` - Service information and capabilities

## Quick Start

### Development
```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your database credentials

# Start development server
npm run dev
```

### Production (Docker)
```bash
# Build image
docker build -t dataset-matching-service .

# Run container
docker run -p 4003:4003 --env-file .env dataset-matching-service
```

## Request Examples

### Single Entity Matching
```bash
curl -X POST http://localhost:4003/api/dataset-matching/match \
  -H "Content-Type: application/json" \
  -d '{
    "entity": "Tesla Inc",
    "location": "United States",
    "context": "Electric vehicle manufacturer",
    "matchTypes": ["exact", "partial", "related"],
    "minConfidence": 0.7,
    "maxResults": 20
  }'
```

### Batch Entity Matching
```bash
curl -X POST http://localhost:4003/api/dataset-matching/batch \
  -H "Content-Type: application/json" \
  -d '{
    "entities": ["Tesla Inc", "SpaceX", "Neuralink"],
    "options": {
      "location": "United States",
      "context": "Technology companies",
      "matchTypes": ["exact", "partial"],
      "minConfidence": 0.6,
      "maxResults": 10
    }
  }'
```

### Cache Management
```bash
# Clear cache
curl -X DELETE http://localhost:4003/api/dataset-matching/cache/clear

# Warm up cache
curl -X POST http://localhost:4003/api/dataset-matching/cache/warmup
```

## Environment Variables

```bash
# Required
PORT=4003
NODE_ENV=production
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cache Configuration
CACHE_TTL_MINUTES=60
MAX_CACHE_SIZE=1000

# Algorithm Configuration
DEFAULT_SIMILARITY_THRESHOLD=0.6
MAX_RESULTS_PER_QUERY=20
ENABLE_GEOGRAPHIC_MATCHING=true
GEOGRAPHIC_BOOST_FACTOR=1.2

# Performance Settings
MAX_BATCH_SIZE=100
CONCURRENT_REQUESTS_LIMIT=10
PROCESSING_TIMEOUT_MS=30000

# Optional Redis
# REDIS_URL=redis://redis:6379
```

## Algorithm Configuration

### Similarity Weights
```json
{
  "text_matching": {
    "jaro_winkler": 0.3,
    "levenshtein": 0.2,
    "word_level": 0.25,
    "character_ngram": 0.25
  },
  "boosting": {
    "geographic": 1.2,
    "context": 1.1,
    "acronym": 1.3
  }
}
```

### Geographic Matching
- **Local**: 50km radius
- **Regional**: 200km radius
- **Global**: No geographic limitation

### Quality Thresholds
- **High Confidence**: 0.8+
- **Medium Confidence**: 0.6-0.8
- **Low Confidence**: 0.4-0.6

## Performance Characteristics

### Response Times
- **Cached Queries**: < 500ms
- **Uncached Queries**: < 2000ms
- **Batch Processing**: Variable based on entity count

### Throughput
- **Single Entity**: ~60 requests/minute
- **Batch Processing**: Up to 100 entities per batch
- **Concurrent Requests**: 10 simultaneous requests

### Cache Efficiency
- **Hit Rate**: Typically 70-85%
- **Cache TTL**: Configurable (default: 60 minutes)
- **Memory Usage**: ~100MB for 1000 cached queries

## Architecture

```
Dataset Matching Service (Port 4003)
├── Core Algorithms
│   ├── TextMatching (Jaro-Winkler, Levenshtein, etc.)
│   ├── EntityNormalization (Case, punctuation, acronyms)
│   ├── GeographicMatching (Location-based boosting)
│   ├── QualityAssessment (Confidence scoring)
│   └── ConfigurableMatching (Weighted algorithms)
├── Services
│   ├── DatasetMatchingService (Main orchestration)
│   ├── SupabaseService (Database integration)
│   └── CacheManager (In-memory/Redis caching)
├── Controllers
│   └── DatasetMatchingController (API endpoints)
└── Utils
    ├── ConfigManager (Algorithm configuration)
    ├── ResponseFormatter (Response formatting)
    └── ErrorHandler (Error handling)
```

## Integration with ChainReactions Platform

This service integrates with the ChainReactions microservices architecture:

- **API Gateway** (Port 3000) routes requests to this service
- **Supabase** provides the dataset storage
- **Redis** (optional) provides distributed caching
- **Frontend** connects via the API Gateway

## Monitoring & Debugging

### Health Check Response
```json
{
  "status": "operational",
  "service": "dataset-matching",
  "details": {
    "matching_service": "operational",
    "cache_size": "available",
    "database_connection": "operational",
    "algorithms": {
      "text_matching": "operational",
      "quality_assessment": "operational",
      "entity_normalization": "operational",
      "geographic_matching": "operational"
    }
  }
}
```

### Statistics Endpoint
```json
{
  "cache_stats": {
    "total_cached_queries": 1250,
    "cache_hit_rate": 0.73,
    "cache_memory_usage": "85MB"
  },
  "algorithm_stats": {
    "text_matching_avg_time": "245ms",
    "geographic_boost_rate": 0.31,
    "confidence_distribution": {
      "high": 0.42,
      "medium": 0.38,
      "low": 0.20
    }
  },
  "performance_stats": {
    "avg_response_time": "380ms",
    "total_requests": 3420,
    "success_rate": 0.998
  }
}
```

## Use Cases

### 1. Entity Resolution
- Match company names across different datasets
- Resolve duplicate entities
- Standardize entity names and variations

### 2. Data Enrichment
- Add geographic context to entities
- Enhance entities with related information
- Improve data quality and completeness

### 3. Relationship Discovery
- Find related entities within datasets
- Identify potential business relationships
- Discover geographic clusters

### 4. Quality Assurance
- Validate entity data quality
- Detect potential duplicates
- Score entity match confidence

---

**Service**: Dataset Matching
**Port**: 4003
**Version**: 1.0.0
**Part of**: ChainReactions OSINT Platform
**Specialty**: Advanced entity matching algorithms