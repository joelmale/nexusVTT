# Build stage
FROM node:26.9.0-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/codex/services/admin-ui/package.json ./apps/codex/services/admin-ui/
COPY packages/rules-contracts/package.json ./packages/rules-contracts/

RUN npm ci --workspace=admin-ui --include-workspace-root

# The admin forms validate with the shared rules contracts, compiled from
# source through the Vite/tsconfig alias (no prebuilt dist needed).
COPY packages/rules-contracts ./packages/rules-contracts
COPY apps/codex/services/admin-ui ./apps/codex/services/admin-ui

RUN npm run build --workspace=admin-ui

# Production stage
FROM nginx:alpine

ARG VERSION=dev
ARG COMMIT_SHA=unknown

# Copy built app from build stage
COPY --from=build /app/apps/codex/services/admin-ui/dist /usr/share/nginx/html

COPY apps/codex/services/admin-ui/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

LABEL org.opencontainers.image.title="Nexus Codex Admin UI" \
      org.opencontainers.image.source="https://github.com/joelmale/nexusVTT" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$COMMIT_SHA"

CMD ["nginx", "-g", "daemon off;"]
