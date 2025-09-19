const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

require("dotenv").config();

// 新增AWS服务导入
const { initializeAWSServices } = require("./services/awsService");

const authRoutes = require("./routes/auth");
const videoRoutes = require("./routes/videos");
const screenshotRoutes = require("./routes/screenshots");
const s3Routes = require("./routes/s3");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.static('public'));

// 移除本地文件服务，改为S3服务
// app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
// app.use("/outputs", express.static(path.join(__dirname, "../outputs")));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/videos", videoRoutes);
app.use("/api/v1/screenshots", screenshotRoutes);
app.use("/api/v1/s3", s3Routes);
// 初始化AWS服务
initializeAWSServices().then(() => {
  console.log("AWS services initialized");
}).catch(err => {
  console.error("AWS services initialization failed:", err);
});

// Cache service removed - using DynamoDB for data storage only

// 保持MongoDB连接（用于非核心数据）
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/gamemedia';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
