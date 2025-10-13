const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { getAppSecrets } = require("../../utils/config");
const { processImageMulti } = require("../../utils/sharp");
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
  res.json({ status: "healthy", service: "image-processor", timestamp: new Date().toISOString() });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "image-processor", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 8082;

/**
 * 处理图片处理任务
 */
async function processImageTask(taskData) {
  const { taskId, screenshotId, filename, owner, userEmail } = taskData;
  const idRaw = taskData.screenshotId || taskData.targetId;
  const screenshotId = idRaw != null ? String(idRaw) : undefined;
  
  try {
    console.log(`Starting image processing for task ${taskId}, screenshot ${screenshotId}`);
    
    // 确保使用一致的 partition key
    const fakeReq = userEmail ? { auth: { email: userEmail } } : null;
    
    // 更新任务状态为运行中
    await updateTaskStatus(taskId, { 
      status: "running", 
      progress: 0, 
      updatedAt: Date.now() 
    }, fakeReq);

    // 执行图片处理
    const outputs = await processImageMulti(filename);
    
    // 更新截图记录
    await media.updateScreenshot(screenshotId, { 
      outputs: outputs, 
      processed: true 
    }, fakeReq);

    // 更新任务状态为完成
    await updateTaskStatus(taskId, { 
      status: "done", 
      progress: 100, 
      updatedAt: Date.now(),
      outputs: outputs
    }, fakeReq);

    console.log(`Image processing completed for task ${taskId}`);
    return { success: true, outputs };
    
  } catch (error) {
    console.error(`Image processing failed for task ${taskId}:`, error);
    
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
async function startImageProcessor() {
  console.log("Image processor started, listening for messages...");
  
  while (true) {
    try {
      // 接收消息
      const messages = await receiveMessage("IMAGE_PROCESS", 1, 20);
      
      if (messages.length === 0) {
        console.log("No messages received, continuing to poll...");
        continue;
      }

      for (const message of messages) {
        try {
          const taskData = JSON.parse(message.Body);
          console.log(`Processing image processing message:`, message.MessageId);
          
          // 处理任务
          await processImageTask(taskData);
          
          // 删除已处理的消息
          await deleteMessage("IMAGE_PROCESS", message.ReceiptHandle);
          console.log(`Message ${message.MessageId} processed and deleted`);
          
        } catch (error) {
          console.error(`Error processing message ${message.MessageId}:`, error);
          
          // 发送失败消息到DLQ
          const originalMessage = JSON.parse(message.Body);
          await sendToDLQ(originalMessage, error);
          
          // 删除失败的消息
          await deleteMessage("IMAGE_PROCESS", message.ReceiptHandle);
        }
      }
      
    } catch (error) {
      console.error("Error in image processor main loop:", error);
      // 等待5秒后重试
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// 启动应用和处理器
async function startApp() {
  await initApp();
  
  // 启动 Express 服务器
  app.listen(PORT, () => {
    console.log(`Image Processing service running on port ${PORT}`);
  });
  
  // 启动 SQS 消息处理器
  startImageProcessor().catch(error => {
    console.error("Image processor failed to start:", error);
    process.exit(1);
  });
}

// 启动应用
if (require.main === module) {
  startApp().catch(error => {
    console.error("Image processor service failed to start:", error);
    process.exit(1);
  });
}

module.exports = { processImageTask, startImageProcessor, app };