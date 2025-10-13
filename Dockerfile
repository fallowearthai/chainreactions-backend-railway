# =================================================================
# ChainReactions Unified OSINT Platform - Simple Docker Configuration
# =================================================================

# Use Node.js runtime
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S chainreactions -u 1001

# Copy package files
COPY package*.json ./

# Install all dependencies (remove --force to prevent corruption)
RUN npm ci || npm install

# Copy source code
COPY . .

# Ensure TypeScript is installed and build the application
RUN npm install typescript --save-dev && npm run build

# Create logs and uploads directory
RUN mkdir -p /app/logs /app/uploads && chown -R chainreactions:nodejs /app/logs /app/uploads

# Switch to non-root user
USER chainreactions

# Expose the application port
EXPOSE 3000

# Add health check with longer startup time
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]