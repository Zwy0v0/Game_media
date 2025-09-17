FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY . .

EXPOSE 8080
CMD ["node", "src/app.js"]
