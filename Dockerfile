FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod
COPY src ./src
COPY database.db ./
ENV NODE_ENV=production
EXPOSE 6602
CMD ["node", "src/index.js"]
