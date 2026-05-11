# Stage 1: Build
FROM oven/bun:1.2 AS builder

LABEL org.opencontainers.image.source="https://github.com/ainterviewer/frontend"

WORKDIR /app

# Copy package files and lockfile
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application
# .dockerignore handles excluding node_modules, build, etc.
COPY . .

# Build the application
# We assume the SDK in src/lib/api is already generated
RUN bun run build

# Stage 2: Run
FROM oven/bun:1.3-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy the build output, package.json and lockfile
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock

# Install production dependencies only
RUN bun install --production --frozen-lockfile

# Environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
# The URL of the backend API (used for server-side requests)
ENV API_URL=http://localhost:8666

# ORIGIN is required by SvelteKit adapter-node for CSRF protection
# If you run this behind a proxy, set this to your public URL
# ENV ORIGIN=https://example.com

EXPOSE 3000
HEALTHCHECK CMD curl -fsS http://127.0.0.1:3000/health/ready || exit 1

# Start the application using bun
CMD ["bun", "build/index.js"]
