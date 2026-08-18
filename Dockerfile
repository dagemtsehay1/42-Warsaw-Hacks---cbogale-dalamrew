# syntax=docker/dockerfile:1

# The web server is also the worker (see src/instrumentation.ts), so this one
# image is the whole app: Next serves the board and the same process runs the
# 30-minute ingest and the daily forecast.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` here (not in the builder) so the layer is only rebuilt when the
# lockfile changes. Platform-specific optional deps — the SWC binary and sharp,
# which Next needs for image optimisation in production — resolve to their musl
# builds because this stage is the same image as the runner.
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Every page is `force-dynamic`, so the build never renders a page and therefore
# never needs the 42 credentials or the database. Nothing secret is baked in.
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Baked in, not left to .env: compose's `env_file: .env` can still override it
# (e.g. `APP_MODE=development` for a local container), but the image itself
# always defaults to the staff-only gate.
ENV APP_MODE=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# `output: "standalone"` traces the server plus only the node_modules it
# actually reaches, so the runtime image carries no dev dependencies.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Read at runtime via `path.join(process.cwd(), ...)` in src/lib/db/pool.ts, so
# it has to exist at the same relative path here — tracing does not catch it.
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db/schema.sql ./src/lib/db/schema.sql

# The coalition score *delta* in the ticker is a diff of two JSON files written
# here (src/lib/snapshots/campus.ts). Mounted as a volume in compose so the
# delta survives a restart instead of resetting to zero.
RUN mkdir -p data/snapshots && chown -R nextjs:nodejs data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
