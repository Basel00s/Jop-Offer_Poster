FROM mcr.microsoft.com/playwright:v1.46.0-jammy

WORKDIR /app

COPY worker/package.json ./
COPY worker/package-lock.json ./
RUN npm ci --omit=dev

COPY models/ ./models/
COPY worker/postWorker.js ./

CMD ["node", "postWorker.js"]
