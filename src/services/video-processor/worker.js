const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { getAppSecrets } = require("../../utils/config");
const { transcodeMultiRes } = require("../../utils/ffmpeg");
const { media } = require("../../utils/dynamo");
const { updateTaskStatus } = require("../../utils/dynamo");
const { receiveMessage, deleteMessage, sendToDLQ } = require("../../utils/sqs");

require("dotenv").config();

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
app.use(express.json());

// 健康检查端点
app.get("/", (req, res) => {
  res.json({ status: "healthy", service: "video-processor", timestamp: new Date().toISOString() });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "video-processor", timestamp: new Date().toISOString() });
});

const PORT = 8081;

/**
 * 处理视频转码任务
 */
async function processVideoTranscode(taskData) {
  const { taskId, filename, owner, userEmail } = taskData;
  const idRaw = taskData.videoId || taskData.targetId;
  const videoId = idRaw != null ? String(idRaw) : undefined;

  try {
    console.log(`Starting video transcode for task ${taskId}, video ${videoId}`);

    // 确保使用一致的 partition key
    const fakeReq = userEmail ? { auth: { email: userEmail } } : null;

    // 更新任务状态为运行中
    await updateTaskStatus(taskId, {
      status: "running",
      progress: 0,
      updatedAt: Date.now()
    }, fakeReq);

    // 执行视频转码
    const outputs = await transcodeMultiRes(filename);

    // 更新视频记录
    await media.updateVideo(videoId, {
      outputs: outputs,
      transcoded: true
    }, fakeReq);

    // 更新任务状态为完成
    await updateTaskStatus(taskId, {
      status: "done",
      progress: 100,
      updatedAt: Date.now(),
      outputs: outputs
    }, fakeReq);

    console.log(`Video transcode completed for task ${taskId}`);
    return { success: true, outputs };

  } catch (error) {
    console.error(`Video transcode failed for task ${taskId}:`, error);

    // 确保使用一致的 partition key
    const fakeReq = userEmail ? { auth: { email: userEmail } } : null;

    // 更新任务状态为失败
    await updateTaskStatus(taskId, {
      status: "failed",
      error: error.message || String(error),
      updatedAt: Date.now()
    }, fakeReq);

    throw error;
  }
}

/**
 * 主循环 - 持续监听和处理SQS消息
 */
async function startVideoProcessor() {
  console.log("Video processor started, listening for messages...");

  while (true) {
    try {
      // 接收消息
      const messages = await receiveMessage("VIDEO_TRANSCODE", 1, 20);

      if (messages.length === 0) {
        console.log("No messages received, continuing to poll...");
        continue;
      }

      for (const message of messages) {
        try {
          const taskData = JSON.parse(message.Body);
          console.log(`Processing video transcode message:`, message.MessageId);

          // 处理任务
          await processVideoTranscode(taskData);

          // 删除已处理的消息
          await deleteMessage("VIDEO_TRANSCODE", message.ReceiptHandle);
          console.log(`Message ${message.MessageId} processed and deleted`);

        } catch (error) {
          console.error(`Error processing message ${message.MessageId}:`, error);

          // 发送失败消息到DLQ
          const originalMessage = JSON.parse(message.Body);
          await sendToDLQ(originalMessage, error);

          // 删除失败的消息
          await deleteMessage("VIDEO_TRANSCODE", message.ReceiptHandle);
        }
      }

    } catch (error) {
      console.error("Error in video processor main loop:", error);
      // 等待5秒后重试
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// 启动应用和处理器
async function startApp() {
  await initApp();

  // 启动 Express 服务器
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Video Processing service running on port ${PORT}`);
  });

  // 启动 SQS 消息处理器
  startVideoProcessor().catch(error => {
    console.error("Video processor failed to start:", error);
    process.exit(1);
  });
}

// 启动应用
if (require.main === module) {
  startApp().catch(error => {
    console.error("Video processor service failed to start:", error);
    process.exit(1);
  });
}

module.exports = { processVideoTranscode, startVideoProcessor, app };