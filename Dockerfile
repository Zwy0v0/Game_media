FROM node:18-alpine

WORKDIR /app

# Install ffmpeg first (smaller base image)
RUN apk add --no-cache ffmpeg

# Copy package files
COPY package*.json ./

# Install dependencies with optimizations
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create temp directory
RUN mkdir -p /tmp

EXPOSE 8080
CMD ["node", "src/app.js"]
