FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod
COPY src ./src
ENV NODE_ENV=production
EXPOSE 6602
CMD ["node", "src/index.js"]
