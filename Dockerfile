# Stage 1: Build the React/Vite application
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Run Nginx as the frontend and API gateway
FROM nginx:alpine

# Copy the built frontend files
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx must serve the application continuously
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
