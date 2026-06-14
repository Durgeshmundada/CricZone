FROM node:18-alpine AS production-dependencies

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:18-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=production-dependencies /app/backend/node_modules ./backend/node_modules
COPY --chown=node:node backend ./backend
COPY --chown=node:node public ./public

WORKDIR /app/backend
USER node
EXPOSE 5000

CMD ["node", "server.js"]
