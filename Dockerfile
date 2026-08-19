FROM node:20-alpine

# better-sqlite3 ships prebuilt binaries for most platforms, but building from
# source needs python3/make/g++ on alpine. Install them, then prune afterwards.
RUN apk add --no-cache --virtual .build-deps python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --production

# Native build deps no longer needed at runtime.
RUN apk del .build-deps

COPY server/ ./server/
COPY public/ ./public/
COPY *.html ./

RUN mkdir -p data

EXPOSE 3000
CMD ["node", "server/index.js"]
