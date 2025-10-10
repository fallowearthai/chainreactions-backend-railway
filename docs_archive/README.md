# ChainReactions Data Management Service

A dedicated microservice for handling dataset management, file uploads, and CSV import functionality within the ChainReactions backend architecture.

## Overview

This service provides comprehensive data management capabilities including:

- **Dataset Management**: Create, read, update, delete datasets
- **File Upload**: Support for CSV, XML, JSON file uploads
- **CSV Import**: Advanced CSV parsing with NRO format support
- **Data Export**: Export datasets back to CSV format
- **Validation**: File format and data validation before import

## Features

### Dataset Management
- Full CRUD operations for datasets
- Pagination and search support
- Dataset statistics and analytics
- Support for system and user datasets

### File Processing
- **CSV Import**: Complete Canadian NRO format support with all fields
- **XML Processing**: Parse XML organization files (frontend compatible)
- **JSON Processing**: Handle JavaScript/JSON format files
- **Validation**: Pre-import file validation and error reporting

### Advanced CSV Support
The service supports the full Canadian NRO CSV format with fields:
- `id`, `schema`, `name`, `aliases`, `birth_date`
- `countries`, `addresses`, `identifiers`, `sanctions`
- `phones`, `emails`, `program_ids`, `dataset`
- `first_seen`, `last_seen`, `last_change`

### Enhanced Database Schema
Extended `dataset_entries` table with new fields:
- `external_id`, `schema_type`, `countries[]`
- `addresses`, `identifiers`, `sanctions`
- `phones`, `emails`, `program_ids`
- `dataset_source`, `first_seen`, `last_seen`, `last_change`

## API Endpoints

### Dataset Management
```
GET    /api/datasets              - List all datasets
POST   /api/datasets              - Create new dataset
GET    /api/datasets/:id          - Get dataset details
PUT    /api/datasets/:id          - Update dataset
DELETE /api/datasets/:id          - Delete dataset
GET    /api/datasets/:id/entries  - Get dataset entries
GET    /api/datasets/:id/stats    - Get dataset statistics
```

### File Operations
```
POST   /api/datasets/:id/upload         - Upload and import file
POST   /api/datasets/:id/validate-file  - Validate file format
GET    /api/datasets/:id/export         - Export dataset to CSV
```

### Specialized Imports
```
POST   /api/import/nro-targets    - Import NRO targets.simple.csv
```

### Health Check
```
GET    /api/health                - Service health status
```

## Installation & Setup

1. **Install Dependencies**
```bash
cd data_management
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Required Environment Variables**
```bash
PORT=3004
NODE_ENV=development

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Upload Configuration
MAX_FILE_SIZE=50MB
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=csv,xml,json,js

# API Configuration
API_PREFIX=/api
CORS_ORIGIN=http://localhost:3000
```

## Development

### Start Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
npm start
```

### Testing
```bash
npm test
npm run test:watch
```

### Code Quality
```bash
npm run lint
npm run type-check
```

## Usage Examples

### Import NRO CSV File
```bash
curl -X POST http://localhost:3004/api/import/nro-targets \\
  -H "Content-Type: application/json" \\
  -d '{"file_path": "/path/to/targets.simple.csv"}'
```

### Upload File to Dataset
```bash
curl -X POST http://localhost:3004/api/datasets/123/upload \\
  -F "file=@data.csv"
```

### Get Dataset Statistics
```bash
curl http://localhost:3004/api/datasets/123/stats
```

### Export Dataset
```bash
curl http://localhost:3004/api/datasets/123/export?format=csv \\
  -o exported_data.csv
```

## File Format Support

### CSV Format (NRO Compatible)
```csv
id,schema,name,aliases,birth_date,countries,addresses,identifiers,sanctions,phones,emails,program_ids,dataset,first_seen,last_seen,last_change
NK-123,Organization,"Company Name","Alias1;Alias2","","cn,us","123 Main St","ID123","","","","","Canadian NRO","2024-01-01","2024-12-31","2024-06-01"
```

### XML Format (Frontend Compatible)
```xml
<organizations>
  <organization>
    <name>Company Name</name>
    <category>Industry</category>
    <alias>Alias 1</alias>
    <alias>Alias 2</alias>
  </organization>
</organizations>
```

### JSON Format (Frontend Compatible)
```json
[
  {
    "name": "Company Name",
    "category": "Industry",
    "aliases": ["Alias 1", "Alias 2"]
  }
]
```

## Architecture Integration

This service integrates with the ChainReactions microservices architecture:

- **Port**: 3004 (independent service)
- **Database**: Shared Supabase instance
- **Dependencies**: None (standalone)
- **Consumers**: Frontend, Dataset Matching Service

### Database Schema Changes

The service extends the existing Supabase schema with:

```sql
-- Added fields to dataset_entries table
ALTER TABLE dataset_entries
ADD COLUMN external_id TEXT,
ADD COLUMN schema_type TEXT DEFAULT 'Organization',
ADD COLUMN countries TEXT[],
ADD COLUMN addresses TEXT,
ADD COLUMN identifiers TEXT,
ADD COLUMN sanctions TEXT,
ADD COLUMN phones TEXT,
ADD COLUMN emails TEXT,
ADD COLUMN program_ids TEXT,
ADD COLUMN dataset_source TEXT,
ADD COLUMN first_seen TIMESTAMPTZ,
ADD COLUMN last_seen TIMESTAMPTZ,
ADD COLUMN last_change TIMESTAMPTZ;
```

## Performance Features

- **Batch Processing**: Import large CSV files in batches
- **Memory Efficient**: Streaming CSV parser
- **Duplicate Detection**: Prevent duplicate imports
- **Error Recovery**: Continue processing on individual row errors
- **Progress Tracking**: Real-time import progress reporting

## Error Handling

The service provides comprehensive error handling:

- **Validation Errors**: Pre-import validation with detailed error messages
- **Processing Errors**: Individual row error tracking during import
- **File Errors**: File format and size validation
- **Database Errors**: Supabase connection and query error handling

## Security Features

- **File Type Validation**: Restrict allowed file types
- **File Size Limits**: Prevent oversized uploads
- **Input Sanitization**: Clean and validate all input data
- **CORS Protection**: Configured CORS for frontend integration
- **Helmet Security**: Security headers and protection

## Monitoring & Logging

- **Request Logging**: Morgan HTTP request logging
- **Error Logging**: Comprehensive error tracking
- **Performance Metrics**: Import timing and statistics
- **Health Checks**: Service health monitoring endpoint

## Future Enhancements

- **Excel Support**: Import .xlsx files
- **Data Validation Rules**: Custom validation rules per dataset
- **Scheduled Imports**: Automated periodic imports
- **API Rate Limiting**: Request rate limiting
- **Webhook Notifications**: Import completion notifications
- **Data Transformation**: Custom data transformation pipelines

## Contributing

1. Follow the existing TypeScript patterns
2. Add tests for new functionality
3. Update API documentation
4. Ensure type safety
5. Follow error handling patterns

## License

MIT License - See LICENSE file for details