FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY . .

# 创建临时目录（用于FFmpeg处理）
RUN mkdir -p /tmp

EXPOSE 8080
CMD ["node", "src/app.js"]
