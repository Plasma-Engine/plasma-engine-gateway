# Multi-stage Dockerfile for Plasma Engine Gateway (Node.js)
# Optimized for production deployment with security and performance

#
# Build stage
#
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --only=production --omit=dev --ignore-scripts

# Copy source code
COPY . .

# Build the application
RUN npm run build

#
# Production stage
#
FROM node:22-alpine AS production

# Add security updates and create non-root user
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/build ./build
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "build/index.js"]

# Labels for metadata
LABEL org.opencontainers.image.title="Plasma Engine Gateway" \
      org.opencontainers.image.description="GraphQL gateway service for Plasma Engine" \
      org.opencontainers.image.vendor="Plasma Engine" \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.licenses="MIT"