# Multi-stage build for Data Management Service

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Configure npm and install dependencies
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-timeout 300000 && \
    npm install --no-audit --no-fund

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Create uploads directory
RUN mkdir -p /app/uploads && \
    chown -R nodejs:nodejs /app/uploads

# Copy package files
COPY package*.json ./

# Configure npm and install production dependencies only
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-timeout 300000 && \
    npm install --production --no-audit --no-fund && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start application
CMD ["node", "dist/app.js"]
