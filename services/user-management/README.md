# ChainReactions User Management Service

A comprehensive user authentication and management service built on Supabase Auth, designed for the ChainReactions OSINT platform.

## 🚀 Features

### Authentication
- **User Registration & Login** with email/password
- **Email Verification** workflow
- **Password Reset** functionality
- **OAuth Integration** (Google, GitHub, Azure, Keycloak)
- **JWT Token Management** with refresh tokens
- **Multi-factor Authentication** support (future)

### User Management
- **User Profile Management** with custom fields
- **Role-Based Access Control (RBAC)** (admin, manager, user)
- **User Approval Workflow** for enterprise environments
- **Bulk User Operations** (approve, deactivate, credit management)
- **User Search & Filtering** with pagination

### Usage & Credits
- **Credit System** for API usage tracking
- **Usage Statistics** and analytics
- **Transaction History** with detailed logging
- **Credit Management** (add, deduct, reset)

### Security
- **Rate Limiting** for API endpoints
- **CORS Protection** with configurable origins
- **Input Validation** using Joi schemas
- **Security Headers** with Helmet
- **Audit Logging** for compliance

## 🏗️ Architecture

### Service Structure
```
services/user-management/
├── src/
│   ├── app.ts                    # Express application entry point
│   ├── controllers/              # Request handlers
│   │   ├── AuthController.ts     # Authentication endpoints
│   │   └── UserController.ts     # User management endpoints
│   ├── services/                # Business logic layer
│   │   ├── SupabaseAuthService.ts # Supabase Auth integration
│   │   └── SupabaseService.ts   # Database operations
│   ├── middleware/              # Custom middleware
│   │   ├── auth.ts              # Authentication & authorization
│   │   └── validation.ts        # Input validation
│   └── types/                  # TypeScript type definitions
│       ├── AuthTypes.ts         # Authentication types
│       └── UserTypes.ts         # User management types
├── dist/                       # Compiled JavaScript output
├── tests/                      # Test files
├── Dockerfile                  # Container configuration
├── package.json                # Dependencies and scripts
└── tsconfig.json              # TypeScript configuration
```

### Database Integration
- **Supabase Auth** for user authentication
- **PostgreSQL** via Supabase for user data
- **Existing tables**: `profiles`, `user_roles`, `user_usage_credits`
- **Row Level Security** for data isolation

## 📡 API Endpoints

### Authentication
```http
POST /api/auth/signup          # User registration
POST /api/auth/signin           # User login
POST /api/auth/signout          # User logout
POST /api/auth/verify-email     # Email verification
POST /api/auth/reset-password   # Password reset request
PUT /api/auth/update-password   # Password update
POST /api/auth/oauth            # OAuth sign-in
POST /api/auth/oauth/callback   # OAuth callback
GET  /api/auth/user             # Get current user
POST /api/auth/refresh          # Refresh JWT token
POST /api/auth/service-auth     # Service authentication
```

### User Management
```http
GET  /api/users/profile         # Get current user profile
GET  /api/users/:userId         # Get user by ID (admin)
GET  /api/users                 # Get users list (admin)
PUT  /api/users/profile/:userId # Update user profile
POST /api/users/:userId/approve # Approve user (admin)
POST /api/users/:userId/deactivate # Deactivate user (admin)
GET  /api/users/:userId/usage   # Get usage statistics
POST /api/users/:userId/credits # Add credits (admin)
POST /api/users/bulk            # Bulk operations (admin)
```

### Service Info
```http
GET /api/health                 # Health check
GET /api/info                   # Service information
```

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase project
- Environment variables

### Installation

1. **Clone and navigate to service directory**
```bash
cd services/user-management
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Build TypeScript**
```bash
npm run build
```

5. **Start development server**
```bash
npm run dev
```

### Environment Variables

```env
# Service Configuration
PORT=3007
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Frontend Configuration
FRONTEND_URL=http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_WINDOW_MS=300000
AUTH_RATE_LIMIT_MAX_REQUESTS=10
```

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t chainreactions-user-management .
```

### Run Container
```bash
docker run -p 3007:3007 \
  -e SUPABASE_URL=your_supabase_url \
  -e SUPABASE_ANON_KEY=your_anon_key \
  -e SUPABASE_SERVICE_ROLE_KEY=your_service_key \
  chainreactions-user-management
```

### Docker Compose
```yaml
version: '3.8'
services:
  user-management:
    build: .
    ports:
      - "3007:3007"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - NODE_ENV=production
    restart: unless-stopped
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Type Checking
```bash
npm run type-check
```

## 📊 Usage Examples

### User Registration
```javascript
const response = await fetch('http://localhost:3007/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123',
    displayName: 'John Doe',
    company: 'Acme Corp'
  })
});
```

### User Login
```javascript
const response = await fetch('http://localhost:3007/api/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123'
  })
});
```

### Get User Profile
```javascript
const response = await fetch('http://localhost:3007/api/users/profile', {
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  }
});
```

## 🔧 Scripts

```json
{
  "build": "tsc",
  "start": "node dist/app.js",
  "dev": "ts-node-dev --respawn --transpile-only src/app.ts",
  "type-check": "tsc --noEmit",
  "test": "jest",
  "test:watch": "jest --watch",
  "lint": "eslint src/**/*.ts",
  "lint:fix": "eslint src/**/*.ts --fix"
}
```

## 🛡️ Security Features

- **Password Requirements**: Minimum 6 characters, uppercase, lowercase, and numbers
- **Rate Limiting**: Configurable per-endpoint limits
- **CORS Protection**: Configurable allowed origins
- **Input Validation**: Comprehensive Joi validation schemas
- **JWT Security**: Secure token generation and validation
- **Authentication Middleware**: Multiple auth levels (user, admin, service)
- **Audit Logging**: Request/response logging for compliance

## 🔍 Monitoring & Logging

### Request Logging
All requests are logged with:
- Timestamp
- HTTP method and path
- Client IP address
- User agent
- Response status code
- Request duration

### Health Check
```bash
curl http://localhost:3007/api/health
```

### Service Info
```bash
curl http://localhost:3007/api/info
```

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure all required environment variables
- [ ] Set up SSL/TLS certificates
- [ ] Configure rate limits appropriately
- [ ] Set up monitoring and alerting
- [ ] Configure CORS origins for production
- [ ] Test all authentication flows
- [ ] Verify database connections
- [ ] Set up backup strategies

## 🔗 Integration with Other Services

### Service Authentication
Other ChainReactions services can authenticate users via:
```javascript
const response = await fetch('http://localhost:3007/api/auth/service-auth', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Token': 'your_service_token'
  },
  body: JSON.stringify({
    token: 'user_jwt_token'
  })
});
```

### Middleware Usage
```javascript
import { authenticate, requireAdmin } from './middleware/auth';

// Protected route
app.get('/api/protected', authenticate, (req, res) => {
  // req.user contains security context
});

// Admin-only route
app.post('/api/admin', authenticate, requireAdmin, (req, res) => {
  // Only admin users can access
});
```

## 🤝 Contributing

1. Follow the existing code style
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure TypeScript types are correct
5. Test all authentication flows

## 📝 License

MIT License - see LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**Supabase Connection Error**
- Verify environment variables are set correctly
- Check Supabase project is active
- Ensure service keys are valid

**CORS Issues**
- Verify frontend URL is in allowed origins
- Check that preflight OPTIONS requests are handled

**Rate Limiting**
- Adjust limits in environment variables
- Consider implementing user-based rate limiting

**Database Issues**
- Check RLS policies on Supabase tables
- Verify foreign key constraints
- Ensure indexes exist for performance

### Debug Mode
Set `NODE_ENV=development` and `ENABLE_DEBUG_LOGGING=true` for detailed logging.

---

**ChainReactions User Management Service** - Built with ❤️ for the OSINT community