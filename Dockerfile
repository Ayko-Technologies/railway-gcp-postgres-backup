ARG NODE_VERSION='20.20.2'
ARG ALPINE_VERSION='3.23'

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS build

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

WORKDIR /app

COPY package*.json tsconfig.json ./
COPY src ./src

RUN npm ci && \
    npm run build && \
    npm prune --production

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION}

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

ARG PG_CLIENT_VERSIONS='16 17 18'

RUN for version in ${PG_CLIENT_VERSIONS}; do \
      apk add --update --no-cache postgresql${version}-client; \
    done

CMD pg_isready --dbname=$BACKUP_DATABASE_URL && \
    node dist/index.js
