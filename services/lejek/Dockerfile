FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates poppler-utils python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY public public
COPY worker worker
COPY scripts scripts
COPY drizzle drizzle
COPY server.mjs identity.mjs ./
RUN node scripts/build.mjs && mkdir /data && chown node:node /data
USER node
CMD ["node", "server.mjs"]
