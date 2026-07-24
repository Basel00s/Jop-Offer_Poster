# Stage 1 — Build the React client
FROM node:20-bookworm AS builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2 — Production image
FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js db.js ./
COPY routes/ ./routes/
COPY models/ ./models/
COPY middleware/ ./middleware/
COPY utils/ ./utils/
COPY scripts/ ./scripts/
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3000

CMD ["node", "server.js"]
