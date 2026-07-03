FROM node:24-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# Empty default => relative API base => browser uses the same origin (:5174), which the
# nginx proxy below forwards to the gateway. No CORS, single-origin (production shape).
ARG VITE_API_URL=
ARG VITE_CLERK_PUBLISHABLE_KEY=
ARG VITE_WORKBENCH_URL=
ARG VITE_TURNSTILE_SITE_KEY=
ARG VITE_DOWNLOADS_BASE_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_WORKBENCH_URL=$VITE_WORKBENCH_URL
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
ENV VITE_DOWNLOADS_BASE_URL=$VITE_DOWNLOADS_BASE_URL
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
# Patch base-image OS packages (Trivy HIGH: libxml2 CVE-2026-6732). The
# unprivileged base runs as uid 101, so switch to root for apk, then back.
USER root
RUN apk update && apk upgrade --no-cache
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER 101
EXPOSE 8080
