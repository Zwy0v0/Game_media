const express = require("express");
// MongoDB 已弃用
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

require("dotenv").config();

const authRoutes = require("./routes/auth");
const videoRoutes = require("./routes/videos");
const screenshotRoutes = require("./routes/screenshots");
const { getTaskStatus } = require("./utils/dynamo");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.json())
app.use(express.static('public'))

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/videos", videoRoutes);
app.use("/api/v1/screenshots", screenshotRoutes);
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 基于DynamoDB的任务进度SSE
app.get("/api/v1/tasks/:taskId/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders && res.flushHeaders();

  let alive = true;
  req.on("close", () => { alive = false; });

  const send = (data) => { try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {} };

  // 首次立即发送一次
  const first = await getTaskStatus(req.params.taskId).catch(() => null);
  if (first) send(first);

  // 简单轮询（作业场景足够）
  const timer = setInterval(async () => {
    if (!alive) return clearInterval(timer);
    const s = await getTaskStatus(req.params.taskId).catch(() => null);
    if (s) {
      send(s);
      if (s.status === "done" || s.status === "failed") {
        clearInterval(timer);
      }
    }
  }, 1500);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
