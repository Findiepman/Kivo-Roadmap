# Node 24 = current LTS (Node 20 stopped getting security fixes in April 2026).
FROM node:24-alpine

# su-exec lets the entrypoint drop from root to the "node" user after fixing
# the ownership of the mounted data folder.
RUN apk add --no-cache su-exec

WORKDIR /app

COPY package*.json ./
# better-sqlite3 ships prebuilt binaries; the build tools are only needed when
# none matches, and are removed again in the same layer.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
 && npm ci --omit=dev \
 && npm cache clean --force \
 && apk del .build-deps

COPY server/ ./server/
COPY public/ ./public/
COPY *.html ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh && mkdir -p data

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
