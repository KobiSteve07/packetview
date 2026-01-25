# Multi-stage Dockerfile for PacketView Application

# Stage 1: Build Backend
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci

# Copy backend source and build
COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY backend/src/shared/types ./shared/types
RUN npm run build

# Stage 2: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build
COPY frontend/src ./src
COPY frontend/index.html ./
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig.json ./
RUN npm run build

# Stage 3: Production Runtime
FROM node:18-alpine AS production

# Install system dependencies for packet capture
RUN apk add --no-cache \
    tcpdump \
    libpcap-dev \
    libcap \
    && rm -rf /var/cache/apk/*

# Set capabilities on tcpdump binary for non-root execution
RUN setcap cap_net_raw,cap_net_admin=eip /usr/bin/tcpdump

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built backend
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/package.json ./backend/

# Copy built frontend
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist

# Copy shared types
COPY --chown=nodejs:nodejs shared/types ./shared/types

# Copy root package.json for scripts
COPY --chown=nodejs:nodejs package*.json ./

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 3001 8080 5173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["npm", "run", "start"]