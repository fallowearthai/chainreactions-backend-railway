FROM node:20-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY services/data-management/package*.json ./
COPY services/data-management/tsconfig.json ./

# Configure npm for better reliability and install dependencies
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-timeout 300000 && \
    npm install --no-audit --no-fund && \
    npm cache clean --force

# Copy source code and shared modules
COPY services/data-management/src/ ./src/
COPY src/shared/ ./src/shared/

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S entityrelations -u 1001

# Change ownership of the app directory
RUN chown -R entityrelations:nodejs /app
USER entityrelations

# Health check with improved configuration for DigitalOcean
HEALTHCHECK --interval=300s --timeout=15s --start-period=60s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { \
      hostname: 'localhost', \
      port: process.env.PORT || 3005, \
      path: '/api/health', \
      timeout: 5000, \
      headers: { 'User-Agent': 'Docker-Health-Check/1.0' } \
    }; \
    const req = http.request(options, (res) => { \
      process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => { \
      console.error('Health check failed: Connection error'); \
      process.exit(1); \
    }); \
    req.on('timeout', () => { \
      console.error('Health check failed: Timeout'); \
      req.destroy(); \
      process.exit(1); \
    }); \
    req.end();"

# Expose port
EXPOSE 3005

# Start the application
CMD ["npm", "start"]