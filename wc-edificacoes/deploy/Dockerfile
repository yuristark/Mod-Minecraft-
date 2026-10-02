# Build do front-end
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY client/ ./
RUN pnpm run build

# API
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist
RUN mkdir -p uploads && chown -R node:node /app/server/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/server.js"]
