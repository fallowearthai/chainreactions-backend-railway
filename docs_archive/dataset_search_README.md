# Dataset Search Service

ChainReactions Dataset Search Service - Long Text Search with N8N Integration

## Overview

This microservice provides dataset search capabilities through N8N workflow integration. It supports Excel file processing, keyword-based searches, and asynchronous result handling.

## Features

- 📊 **Excel File Processing**: Support for .xlsx, .xls, and .csv files
- 🔍 **Long Text Search**: Advanced search capabilities through N8N workflows
- 🔄 **Asynchronous Processing**: Non-blocking search execution with status tracking
- 📝 **Keyword Extraction**: Automatic keyword suggestions from uploaded files
- 🔗 **N8N Integration**: Seamless workflow integration with webhook callbacks
- ✅ **File Validation**: Comprehensive file format and content validation

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │────│  Dataset Search │────│      N8N        │
│   (Port 8080)   │    │  Service        │    │  Workflow       │
│                 │    │  (Port 3004)    │    │  Engine         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## API Endpoints

### Core Search Operations
- `POST /api/dataset-search/execute` - Execute dataset search
- `POST /api/dataset-search/upload` - Upload and preview Excel file
- `GET /api/dataset-search/status/:execution_id` - Get execution status
- `GET /api/dataset-search/results/:execution_id` - Get execution results
- `DELETE /api/dataset-search/execution/:execution_id` - Cancel execution

### System Operations
- `POST /api/dataset-search/webhook` - N8N webhook callback
- `GET /api/dataset-search/stats` - Service statistics
- `GET /api/health` - Health check
- `GET /api` - Service information

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env .env.local
   ```

3. **Build Project**
   ```bash
   npm run build
   ```

## Development

### Start Development Server
```bash
npm run dev
```

### Available Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server with hot reload
npm run build      # Compile TypeScript to JavaScript
npm test           # Run tests
npm run test:watch # Run tests in watch mode
npm run lint       # Run ESLint
npm run type-check # Run TypeScript type checking without compilation
```

## Environment Variables

```bash
# Server Configuration
PORT=3004
NODE_ENV=development

# N8N Integration Settings
N8N_WEBHOOK_URL=http://localhost:5678/webhook/dataset-search
N8N_API_URL=http://localhost:5678/api/v1
N8N_API_KEY=your_n8n_api_key_here

# File Upload Settings
MAX_FILE_SIZE=10MB
ALLOWED_FILE_EXTENSIONS=.xlsx,.xls,.csv

# Search Configuration
MAX_SEARCH_TIMEOUT=300000  # 5 minutes
MAX_CONCURRENT_SEARCHES=5
```

## Usage Examples

### 1. Execute Search with Keywords
```bash
curl -X POST http://localhost:3004/api/dataset-search/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "target_institution": "NanoAcademic Technologies",
    "keywords": ["technology", "research", "innovation"],
    "start_date": "2023-01-01",
    "end_date": "2024-01-01"
  }'
```

### 2. Upload and Search with Excel File
```bash
curl -X POST http://localhost:3004/api/dataset-search/execute \\
  -H "Content-Type: multipart/form-data" \\
  -F "target_institution=NanoAcademic Technologies" \\
  -F "excel_file=@dataset.xlsx"
```

### 3. Check Execution Status
```bash
curl -X GET http://localhost:3004/api/dataset-search/status/12345678-1234-1234-1234-123456789abc
```

### 4. Get Results
```bash
curl -X GET http://localhost:3004/api/dataset-search/results/12345678-1234-1234-1234-123456789abc
```

## API Response Format

### Success Response
```json
{
  "success": true,
  "execution_id": "12345678-1234-1234-1234-123456789abc",
  "message": "Dataset search started successfully",
  "data": [...],
  "metadata": {
    "total_results": 25,
    "processing_time": 1500,
    "keywords_used": ["technology", "research"]
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR"
}
```

## File Upload Specifications

### Supported Formats
- `.xlsx` - Excel 2007+ format
- `.xls` - Legacy Excel format
- `.csv` - Comma-separated values

### File Size Limits
- Maximum file size: 10MB (configurable)
- Maximum rows: No hard limit, but performance may vary

### File Validation
- Format validation based on file extension
- Content validation to ensure data quality
- Automatic keyword extraction from file contents

## N8N Integration

The service integrates with N8N workflows through:

1. **Trigger Webhook**: Sends search requests to N8N
2. **Result Callback**: Receives results via webhook
3. **Status Tracking**: Monitors execution progress
4. **Error Handling**: Manages workflow failures

### N8N Workflow Requirements

Your N8N workflow should:
1. Accept the trigger payload format
2. Process the search request
3. Return results via the callback webhook
4. Handle errors appropriately

## Error Handling

The service provides comprehensive error handling:

- **Validation Errors**: Input validation with detailed messages
- **File Processing Errors**: Excel parsing and validation errors
- **N8N Integration Errors**: Workflow trigger and callback errors
- **System Errors**: General service errors with proper logging

## Monitoring

### Health Check
```bash
curl -X GET http://localhost:3004/api/health
```

### Service Statistics
```bash
curl -X GET http://localhost:3004/api/dataset-search/stats
```

## Development Guidelines

### Code Structure
```
src/
├── app.ts                          # Express application
├── controllers/
│   └── DatasetSearchController.ts  # Main API controller
├── services/
│   ├── N8nIntegrationService.ts    # N8N workflow integration
│   └── ExcelProcessingService.ts   # Excel file processing
├── types/
│   └── DatasetSearchTypes.ts       # TypeScript type definitions
└── utils/
    └── ErrorHandler.ts             # Error handling utilities
```

### TypeScript Standards
- Strict type checking enabled
- All functions properly typed
- Interface definitions for all data structures
- Comprehensive error type definitions

### Testing
```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
```

## Troubleshooting

### Common Issues

1. **File Upload Fails**
   - Check file format and size limits
   - Verify MIME type configuration

2. **N8N Integration Issues**
   - Verify webhook URL configuration
   - Check N8N workflow status
   - Review N8N logs for errors

3. **Performance Issues**
   - Monitor memory usage for large files
   - Adjust timeout settings if needed
   - Consider file size optimization

### Logs
The service provides detailed logging for:
- Request/response cycles
- File processing operations
- N8N integration calls
- Error conditions

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation for API changes
4. Follow existing code style and patterns

## License

ISC