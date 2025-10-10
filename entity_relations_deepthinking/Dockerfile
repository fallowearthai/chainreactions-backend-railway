# =================================================================
# ChainReactions Unified OSINT Platform - Docker Configuration
# =================================================================
# Multi-stage build for production optimization

# Stage 1: Builder Stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript application
RUN npm run build

# Stage 2: Production Stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S chainreactions -u 1001

# Set working directory
WORKDIR /app

# Copy package files from builder stage
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy any other necessary files
COPY --from=builder /app/README.md ./
COPY --from=builder /app/.env.example ./

# Create logs directory
RUN mkdir -p /app/logs && chown -R chainreactions:nodejs /app/logs

# Switch to non-root user
USER chainreactions

# Expose the application port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]