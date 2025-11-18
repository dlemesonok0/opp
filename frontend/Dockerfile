FROM node:22-slim
WORKDIR /app
COPY package.json yarn.lock ./

RUN --mount=type=cache,id=yarn-cache,target=/usr/local/share/.cache/yarn \
    yarn config set cache-folder /usr/local/share/.cache/yarn \
    && yarn install --frozen-lockfile --verbose

COPY . .
