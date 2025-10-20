# Data Management Service

**CSV upload, parsing, and dataset management with Supabase integration**

Part of the ChainReactions microservices architecture, this service provides comprehensive data management capabilities including intelligent CSV parsing, dataset management, and export functionality.

## 🚀 Features

- **Intelligent CSV Parsing**: Smart field detection and mapping with multiple format support
- **Dataset Management**: Full CRUD operations for datasets and entries
- **File Upload**: Multer-based file upload with validation
- **Supabase Integration**: PostgreSQL database with Supabase client
- **CSV Export**: Dual format export (user-friendly and technical)
- **Data Validation**: Format validation and quality checks
- **Batch Processing**: Efficient batch import for large datasets
- **Health Monitoring**: Built-in health check endpoints
- **Production Ready**: Docker containerization with health checks

## 📋 API Endpoints

### Dataset Management

#### List All Datasets
```http
GET /api/data-management/datasets?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "datasets": [...],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

#### Get Dataset by ID
```http
GET /api/data-management/datasets/:id
```

#### Create New Dataset
```http
POST /api/data-management/datasets
Content-Type: application/json

{
  "name": "My Dataset",
  "description": "Dataset description",
  "is_system": false
}
```

#### Update Dataset
```http
PUT /api/data-management/datasets/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "New description"
}
```

#### Delete Dataset
```http
DELETE /api/data-management/datasets/:id
```

### Dataset Entries

#### Get Dataset Entries
```http
GET /api/data-management/datasets/:id/entries?page=1&limit=50&search=keyword
```

#### Get Dataset Statistics
```http
GET /api/data-management/datasets/:id/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_entries": 1234,
    "unique_countries": 45,
    "schema_types": {"Organization": 1000, "Person": 234},
    "last_updated": "2025-10-14T00:00:00Z"
  }
}
```

### File Operations

#### Upload File to Dataset
```http
POST /api/data-management/datasets/:id/upload
Content-Type: multipart/form-data

file: <CSV file>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRows": 1000,
    "importedRows": 995,
    "skippedRows": 5,
    "duplicateRows": 0,
    "processing_time_ms": 3500,
    "warnings": ["Field detection confidence: high"]
  },
  "message": "Successfully imported 995/1000 entries"
}
```

#### Validate File Format
```http
POST /api/data-management/datasets/:id/validate-file
Content-Type: multipart/form-data

file: <CSV file>
```

#### Export Dataset
```http
GET /api/data-management/datasets/:id/export?format=user-friendly
```

**Formats:**
- `user-friendly`: 4 columns (Entity Name, Country, Type, Aliases)
- `technical`: 15 columns (full data with all fields)

### System Endpoints

#### Health Check
```http
GET /api/health
```

#### Service Info
```http
GET /api/info
```

## 🛠️ Installation

### Local Development

1. **Install dependencies**:
```bash
cd services/data-management
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

3. **Create uploads directory**:
```bash
mkdir -p uploads
```

4. **Run in development mode**:
```bash
npm run dev
```

5. **Build for production**:
```bash
npm run build
npm start
```

### Docker Deployment

```bash
# Build image
docker build -t chainreactions/data-management:latest .

# Run container
docker run -d \
  -p 3005:3005 \
  -e SUPABASE_URL=your_url \
  -e SUPABASE_ANON_KEY=your_key \
  -e NODE_ENV=production \
  -v $(pwd)/uploads:/app/uploads \
  --name data-management \
  chainreactions/data-management:latest
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Service port | No | `3005` |
| `NODE_ENV` | Environment mode | No | `development` |
| `SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_ANON_KEY` | Supabase anon key | Yes | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | No | - |
| `UPLOAD_PATH` | File upload directory | No | `./uploads` |
| `MAX_FILE_SIZE` | Max upload size (bytes) | No | `104857600` (100MB) |
| `REDIS_URL` | Redis connection URL | No | - |

## 📊 Architecture

```
services/data-management/
├── src/
│   ├── app.ts                    # Express application
│   ├── controllers/
│   │   └── DataManagementController.ts  # Request handlers
│   ├── services/
│   │   ├── SupabaseService.ts    # Database integration
│   │   ├── CsvImportService.ts   # CSV processing
│   │   └── SmartCsvParser.ts     # Intelligent field detection
│   ├── middleware/
│   │   └── upload.ts             # Multer configuration
│   └── types/
│       └── DataTypes.ts          # TypeScript definitions
├── Dockerfile
├── package.json
└── tsconfig.json
```

## 🔍 Usage Examples

### Upload CSV File
```javascript
const formData = new FormData();
formData.append('file', csvFile);

const response = await fetch('http://localhost:3005/api/data-management/datasets/123/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(`Imported ${result.data.importedRows} entries`);
```

### Create Dataset and Upload
```javascript
// Step 1: Create dataset
const dataset = await fetch('http://localhost:3005/api/data-management/datasets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Canadian Organizations',
    description: 'List of Canadian named research organizations'
  })
});

const { data } = await dataset.json();
const datasetId = data.id;

// Step 2: Upload CSV file
const formData = new FormData();
formData.append('file', csvFile);

await fetch(`http://localhost:3005/api/data-management/datasets/${datasetId}/upload`, {
  method: 'POST',
  body: formData
});
```

### Export Dataset
```javascript
const response = await fetch(
  'http://localhost:3005/api/data-management/datasets/123/export?format=user-friendly'
);

const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'dataset-export.csv';
a.click();
```

## 🧪 Testing

```bash
# Run tests
npm test

# Type checking
npm run type-check
```

## 📈 Smart CSV Parser

The service includes an intelligent CSV parser that:

- **Auto-detects field mappings**: Analyzes CSV headers to identify entity name, countries, aliases, etc.
- **Handles multiple formats**: Supports various CSV structures with flexible field detection
- **Quality assessment**: Validates parsed data and reports confidence levels
- **Field prioritization**: Identifies and flags missing critical fields
- **Flexible transformations**: Converts various field formats to standardized database format

### Supported Field Patterns

The parser recognizes these common field name patterns:

- **Organization Name**: `name`, `organization`, `entity_name`, `company_name`, `org_name`
- **Countries**: `country`, `countries`, `location`, `nation`
- **Aliases**: `alias`, `aliases`, `also_known_as`, `alternate_names`
- **Type/Schema**: `type`, `schema`, `entity_type`, `category`
- **External ID**: `id`, `external_id`, `entity_id`, `reference_id`

## 🔒 Security

- Non-root Docker user (nodejs:1001)
- Supabase Row Level Security (RLS) support
- File upload validation and size limits
- CORS configuration for production domains
- Request validation and sanitization
- Secure file handling with automatic cleanup

## 🚀 Phase 3 Integration

This service is part of Phase 3 microservices architecture:
- **Port**: 3005
- **Access**: Via API Gateway on port 3000
- **Service Discovery**: Redis-based registration
- **Health Checks**: Automatic monitoring
- **Dependencies**: Supabase (PostgreSQL)

## 📝 Changelog

### Version 1.0.0 (2025-10-14)
- ✅ Initial standalone service extraction from main app
- ✅ Smart CSV parser with auto-detection
- ✅ Full CRUD operations for datasets and entries
- ✅ File upload with multer integration
- ✅ Dual-format CSV export
- ✅ Docker containerization with health checks
- ✅ Production-ready configuration
- ✅ Comprehensive API documentation

## 📞 Support

For issues or questions:
- GitHub Issues: [chainreactions_backend/issues](https://github.com/yourusername/chainreactions_backend/issues)
- Documentation: See `/docs` folder in root repository

## 📄 License

MIT License - see LICENSE file for details
