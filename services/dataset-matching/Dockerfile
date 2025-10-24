FROM node:20-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Configure npm for better reliability and install dependencies
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-timeout 300000 && \
    npm install --no-audit --no-fund && \
    npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S datasetmatching -u 1001

# Change ownership of the app directory
RUN chown -R datasetmatching:nodejs /app
USER datasetmatching

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: process.env.PORT || 3004, path: '/api/health', timeout: 2000 }; \
    const req = http.request(options, (res) => { \
      process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => { req.destroy(); process.exit(1); }); \
    req.end();"

# Expose port
EXPOSE 3004

# Start the application
CMD ["npm", "start"]