const multer = require("multer");
const { awsService } = require("../services/awsService");
const { cacheService } = require("../services/cacheService");
const { processImageMulti } = require("../utils/sharp");

// 修改multer配置，使用内存存储
const storage = multer.memoryStorage();
const upload = multer({ storage });

exports.uploadMiddleware = upload.single("screenshot");

exports.uploadScreenshot = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No screenshot uploaded. Field 'screenshot' required." });

  try {
    // 生成唯一文件名
    const filename = Date.now() + '_' + req.file.originalname;
    const s3Key = `screenshots/${filename}`;
    
    // 上传到S3
    await awsService.uploadToS3(s3Key, req.file.buffer, req.file.mimetype);
    
    // 保存元数据到DynamoDB
    const screenshotData = awsService.toDynamoDBItem({
      id: filename,
      filename: filename,
      s3Key: s3Key,
      mimeType: req.file.mimetype,
      game: req.body.game || "",
      owner: req.user.username,
      createdAt: new Date().toISOString(),
      processed: false
    });
    
    await awsService.putItem(`${process.env.DYNAMODB_TABLE_PREFIX}-screenshots`, screenshotData);
    
    // 缓存元数据
    await cacheService.cacheMediaMetadata(filename, {
      filename: filename,
      game: req.body.game || "",
      owner: req.user.username,
      processed: false
    });
    
    res.json({ 
      id: filename,
      filename: filename,
      game: req.body.game || "",
      owner: req.user.username
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 处理（CPU可选）：生成 thumb/medium
 * 返回 taskId + 状态
 */
exports.processScreenshot = async (req, res) => {
  try {
    const screenshotId = req.params.id;
    
    // 从DynamoDB获取截图信息
    const screenshot = await awsService.getItem(`${process.env.DYNAMODB_TABLE_PREFIX}-screenshots`, {
      id: { S: screenshotId }
    });
    
    if (!screenshot.Item) {
      return res.status(404).json({ error: "Screenshot not found" });
    }
    
    // 权限检查
    if (req.user.role !== "admin" && screenshot.Item.owner.S !== req.user.username) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // 从S3下载原始文件
    const s3Object = await awsService.getFromS3(screenshot.Item.s3Key.S);
    const fileBuffer = await s3Object.Body.transformToByteArray();
    
    // 处理图片
    const outputs = await processImageMulti(fileBuffer, screenshotId);
    
    // 更新DynamoDB记录
    const updatedScreenshot = {
      ...screenshot.Item,
      processed: { BOOL: true },
      outputs: { S: JSON.stringify(outputs) }
    };
    
    await awsService.putItem(`${process.env.DYNAMODB_TABLE_PREFIX}-screenshots`, updatedScreenshot);
    
    // 更新缓存
    await cacheService.cacheMediaMetadata(screenshotId, {
      ...awsService.fromDynamoDBItem(screenshot.Item),
      processed: true,
      outputs: outputs
    });
    
    res.json({ 
      taskId: screenshotId, 
      status: "done", 
      outputs: outputs 
    });
  } catch (error) {
    console.error('Process error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 列表：/api/v1/screenshots?game=LoL&processed=true&page=1&limit=10&sort=-createdAt
 */
exports.listShots = async (req, res) => {
  try {
    const { page = 1, limit = 5, game, processed } = req.query;
    
    // 构建查询条件
    let filterExpression = "";
    let expressionAttributeValues = {};
    
    if (game) {
      filterExpression += "game = :game";
      expressionAttributeValues[":game"] = { S: game };
    }
    
    if (typeof processed !== "undefined") {
      if (filterExpression) filterExpression += " AND ";
      filterExpression += "processed = :processed";
      expressionAttributeValues[":processed"] = { BOOL: processed === "true" };
    }
    
    if (req.user.role !== "admin") {
      if (filterExpression) filterExpression += " AND ";
      filterExpression += "owner = :owner";
      expressionAttributeValues[":owner"] = { S: req.user.username };
    }
    
    // 从DynamoDB查询截图列表
    const result = await awsService.scanItems(
      `${process.env.DYNAMODB_TABLE_PREFIX}-screenshots`,
      filterExpression || undefined,
      expressionAttributeValues
    );
    
    const items = result.Items.map(item => awsService.fromDynamoDBItem(item));
    
    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = items.slice(startIndex, endIndex);
    
    res.json({ 
      total: items.length, 
      page: Number(page), 
      limit: Number(limit), 
      items: paginatedItems 
    });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getShot = async (req, res) => {
  try {
    const screenshotId = req.params.id;
    
    // 从DynamoDB获取截图信息
    const screenshot = await awsService.getItem(`${process.env.DYNAMODB_TABLE_PREFIX}-screenshots`, {
      id: { S: screenshotId }
    });
    
    if (!screenshot.Item) {
      return res.status(404).json({ error: "Screenshot not found" });
    }
    
    // 权限检查
    if (req.user.role !== "admin" && screenshot.Item.owner.S !== req.user.username) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const shotData = awsService.fromDynamoDBItem(screenshot.Item);
    res.json(shotData);
  } catch (error) {
    console.error('Get error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteShot = async (req, res) => {
  try {
    const screenshotId = req.params.id;
    
    // 从DynamoDB获取截图信息
    const screenshot = await awsService.getItem(`${process.env.DYNAMODB_TABLE_PREFIX}-screenshots`, {
      id: { S: screenshotId }
    });
    
    if (!screenshot.Item) {
      return res.status(404).json({ error: "Screenshot not found" });
    }
    
    // 权限检查
    if (req.user.role !== "admin" && screenshot.Item.owner.S !== req.user.username) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // 从S3删除文件
    await awsService.deleteFromS3(screenshot.Item.s3Key.S);
    
    // 删除处理后的文件
    if (screenshot.Item.outputs) {
      const outputs = JSON.parse(screenshot.Item.outputs.S);
      for (const output of outputs) {
        await awsService.deleteFromS3(output.s3Key);
      }
    }
    
    // 从DynamoDB删除记录
    await awsService.deleteItem(`${process.env.DYNAMODB_TABLE_PREFIX}-screenshots`, {
      id: { S: screenshotId }
    });
    
    // 从缓存删除
    await cacheService.delete(`media:${screenshotId}`);
    
    res.json({ message: "Screenshot deleted" });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
};
