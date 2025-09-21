const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const { getAppSecrets } = require("./utils/config");

require("dotenv").config();

const authRoutes = require("./routes/auth");
const videoRoutes = require("./routes/videos");
const screenshotRoutes = require("./routes/screenshots");
const taskRoutes = require("./routes/tasks");

const app = express();

// 初始化应用时从Secrets Manager获取配置
async function initApp() {
  try {
    const secrets = await getAppSecrets();
    if (secrets.jwt_secret) {
      process.env.JWT_SECRET = secrets.jwt_secret;
      console.log('JWT secret loaded from Secrets Manager');
    }
    if (secrets.external_api_key) {
      process.env.EXTERNAL_API_KEY = secrets.external_api_key;
      console.log('External API key loaded from Secrets Manager');
    }
  } catch (error) {
    console.log('Failed to load secrets:', error.message);
  }
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.json())
app.use(express.static('public'))
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/outputs", express.static(path.join(__dirname, "../outputs")));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/videos", videoRoutes);
app.use("/api/v1/screenshots", screenshotRoutes);
app.use("/api/v1/tasks", taskRoutes);


const PORT = process.env.PORT || 8080;

// 启动应用
async function startApp() {
  await initApp();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

startApp();
