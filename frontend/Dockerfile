FROM node:22-slim
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --verbose
COPY . .
