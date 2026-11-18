FROM node:24-bookworm-slim
WORKDIR /app
COPY public public
COPY worker worker
COPY scripts scripts
COPY drizzle drizzle
COPY server.mjs .
RUN node scripts/build.mjs && mkdir /data && chown node:node /data
USER node
CMD ["node", "server.mjs"]
