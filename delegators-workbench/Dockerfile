FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_WORKBENCH_API_URL=
ARG VITE_CLERK_PUBLISHABLE_KEY=
ARG VITE_DELEGATORS_GATEWAY_URL=
ARG VITE_DELEGATORS_STORE_URL=
ARG VITE_DELEGATORS_DEFAULT_MODEL=dlg-pro
ENV VITE_WORKBENCH_API_URL=$VITE_WORKBENCH_API_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_DELEGATORS_GATEWAY_URL=$VITE_DELEGATORS_GATEWAY_URL
ENV VITE_DELEGATORS_STORE_URL=$VITE_DELEGATORS_STORE_URL
ENV VITE_DELEGATORS_DEFAULT_MODEL=$VITE_DELEGATORS_DEFAULT_MODEL
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime-base

ENV NODE_ENV=production
ENV WORKBENCH_PORT=4175
ENV WORKBENCH_CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app
# python3 + bash give the in-container "local" terminal mode real runtimes for
# sheet/data artifact tool runs (production should still prefer docker/remote).
# chromium + the font set power the HTML→PDF document renderer (peak-grade
# report/resume PDFs); without it the server falls back to the vector renderer.
RUN apk add --no-cache python3 bash chromium nss freetype harfbuzz ca-certificates \
      tesseract-ocr tesseract-ocr-data-eng ttf-dejavu font-noto font-inter && \
    addgroup -S -g 10001 workbench && \
    adduser -S -u 10001 -G workbench workbench && \
    mkdir -p /data/workspaces && \
    chown -R workbench:workbench /data

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

FROM runtime-base AS runtime
USER workbench
EXPOSE 4175
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4175/healthz || exit 1
CMD ["node", "dist-server/server/index.js"]

FROM runtime-base AS sandbox-runtime
USER root
RUN apk add --no-cache docker-cli
USER workbench
EXPOSE 4180
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4180/healthz || exit 1
CMD ["node", "dist-server/server/sandboxd.js"]
