FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends chromium fonts-liberation && \
    rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY dist ./dist
COPY templates ./templates
COPY app-releases ./app-releases

EXPOSE 3000

CMD ["node", "dist/index.js"]
