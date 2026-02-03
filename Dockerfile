# Build Stage
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Final Stage (Gateway) will copy from here or we build directly in Gateway Dockerfile.
# For simplicity, we'll use this Dockerfile only as a BUILDER for the Gateway.
# This container will exit after build.
CMD ["echo", "Build complete"]
