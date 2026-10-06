# BMSL website image: multi-stage, Node 22 + pnpm 10.34.4, frozen lockfile, ordinary `pnpm build`.
# No database or secret is needed (or accepted) at build time; migrations are NOT applied during the build.
# The runtime is plain `next start` (no standalone tracing is assumed) run by a non-root user.

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.34.4 --activate
WORKDIR /app

FROM base AS build
# Only tracked repository inputs are copied (there is no .npmrc in this repository).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json next.config.mjs ./
COPY scripts ./scripts
COPY src ./src
# NON-SECRET build configuration. next.config.mjs materializes the response security headers at `next build`, so these
# two switches only take effect when set HERE (build args), never as runtime env. Both default to OFF; never pass a
# secret as a build arg (build args are visible in the image history).
ARG HSTS_ENABLED=false
ARG CSP_ALLOW_GA4=false
ENV HSTS_ENABLED=$HSTS_ENABLED \
    CSP_ALLOW_GA4=$CSP_ALLOW_GA4
# scripts/build.mjs: payload generate:importmap (build-only inert env inside the child), then next build.
RUN pnpm build \
  && pnpm prune --prod

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# Runtime needs: production node_modules, the Next build, the config (+ the modules it imports), and src
# (Payload config and committed migrations). Ownership stays root (read-only for the app); only the media dir is writable.
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.mjs /app/tsconfig.json ./
COPY --from=build /app/src ./src
COPY --from=build /app/scripts/container-start.mjs ./scripts/container-start.mjs
# Self-contained CD gate job entrypoint (`node scripts/cd/gate-main-ci.mjs`, run with a job command override). It reads
# only BMSL_TARGET_SHA / optional BMSL_GATE_* env and needs no database, application secret or media volume.
COPY --from=build /app/scripts/cd/gate-main-ci.mjs ./scripts/cd/gate-main-ci.mjs
# Writable, persistent media location. In production mount a dedicated volume at /data/media and set
# BMSL_MEDIA_DIR=/data/media; it must be writable by uid 1000 / gid 1000 (user "node", group "node").
RUN mkdir -p /data/media && chown -R node:node /data/media
# Explicit user AND group: Northflank decides persistent-volume ownership from the image group at build time.
USER node:node
EXPOSE 3000
CMD ["node", "scripts/container-start.mjs"]
