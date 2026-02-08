FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm config set dedupe-peer-dependents false && pnpm approve-builds sqlite3 && pnpm install --prod
COPY . .
ENV NODE_ENV=production
EXPOSE 6602
CMD ["node", "src/index.js"]
