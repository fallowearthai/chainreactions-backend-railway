FROM node:18-alpine

WORKDIR /app

# Install curl for health check
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S datasetsearch -u 1001

# Change ownership
RUN chown -R datasetsearch:nodejs /app
USER datasetsearch

# Expose port
EXPOSE 3006

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3006/api/health || exit 1

# Start service
CMD ["npm", "start"]