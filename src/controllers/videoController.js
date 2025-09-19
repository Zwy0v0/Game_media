const multer = require("multer");
const { awsService } = require("../services/awsService");
const { transcodeMultiRes } = require("../utils/ffmpeg");
const { fetchWikiGameInfo } = require("../utils/gameInfo");

// 修改multer配置，使用内存存储
const storage = multer.memoryStorage();
const upload = multer({ storage });

exports.uploadMiddleware = upload.single("video");

/**
 * 上传视频：创建 Video，并创建一个“转码任务(queued)” → 返回 taskId
 */
exports.uploadVideo = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No video file uploaded. Field name must be 'video'." });

  try {
    // 生成唯一文件名
    const filename = Date.now() + '_' + req.file.originalname;
    const s3Key = `videos/${filename}`;
    
    // 上传到S3
    await awsService.uploadToS3(s3Key, req.file.buffer, req.file.mimetype);
    
    // 保存元数据到DynamoDB
    const videoData = awsService.toDynamoDBItem({
      id: filename,
      filename: filename,
      s3Key: s3Key,
      mimeType: req.file.mimetype,
      game: req.body.game || "",
      owner: req.user.username,
      createdAt: new Date().toISOString(),
      transcoded: false
    });
    
    await awsService.putItem(`${process.env.DYNAMODB_TABLE_PREFIX}-videos`, videoData);
    
    // 获取游戏信息（如果有）
    let gameInfo = null;
    if (req.body.game) {
      gameInfo = await fetchWikiGameInfo(req.body.game);
      if (gameInfo) {
        const updatedVideoData = {
          ...videoData,
          gameInfo: { S: JSON.stringify(gameInfo) }
        };
        await awsService.putItem(`${process.env.DYNAMODB_TABLE_PREFIX}-videos`, updatedVideoData);
      }
    }
    
    // Cache removed - metadata stored in DynamoDB only
    
    res.json({ 
      videoId: filename, 
      taskId: filename, 
      gameInfo: gameInfo 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 触发转码（CPU密集）：查找/创建任务 → 运行 → 更新 Video.outputs
 */
exports.transcode = async (req, res) => {
  try {
    const videoId = req.params.id;
    
    // 从DynamoDB获取视频信息
    const video = await awsService.getItem(`${process.env.DYNAMODB_TABLE_PREFIX}-videos`, {
      id: { S: videoId }
    });
    
    if (!video.Item) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    // 权限检查
    if (req.user.role !== "admin" && video.Item.owner.S !== req.user.username) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // 从S3下载原始文件
    const s3Object = await awsService.getFromS3(video.Item.s3Key.S);
    const fileBuffer = await s3Object.Body.transformToByteArray();
    
    // 转码视频
    const outputs = await transcodeMultiRes(fileBuffer, videoId);
    
    // 更新DynamoDB记录
    const updatedVideo = {
      ...video.Item,
      transcoded: { BOOL: true },
      outputs: { S: JSON.stringify(outputs) }
    };
    
    await awsService.putItem(`${process.env.DYNAMODB_TABLE_PREFIX}-videos`, updatedVideo);
    
    // Cache removed - metadata updated in DynamoDB only
    
    res.json({ 
      taskId: videoId, 
      status: "done", 
      outputs: outputs 
    });
  } catch (error) {
    console.error('Transcode error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * 列表：分页/过滤/排序
 * /api/v1/videos?game=LoL&transcoded=true&page=1&limit=10&sort=-createdAt
 */
exports.listVideos = async (req, res) => {
  try {
    const { page = 1, limit = 5, game, transcoded } = req.query;
    
    // 构建查询条件
    let filterExpression = "";
    let expressionAttributeValues = {};
    
    if (game) {
      filterExpression += "game = :game";
      expressionAttributeValues[":game"] = { S: game };
    }
    
    if (typeof transcoded !== "undefined") {
      if (filterExpression) filterExpression += " AND ";
      filterExpression += "transcoded = :transcoded";
      expressionAttributeValues[":transcoded"] = { BOOL: transcoded === "true" };
    }
    
    if (req.user.role !== "admin") {
      if (filterExpression) filterExpression += " AND ";
      filterExpression += "owner = :owner";
      expressionAttributeValues[":owner"] = { S: req.user.username };
    }
    
    // 从DynamoDB查询视频列表
    const result = await awsService.scanItems(
      `${process.env.DYNAMODB_TABLE_PREFIX}-videos`,
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

/**
 * 单条明细
 */
exports.getVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    
    // 从DynamoDB获取视频信息
    const video = await awsService.getItem(`${process.env.DYNAMODB_TABLE_PREFIX}-videos`, {
      id: { S: videoId }
    });
    
    if (!video.Item) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    // 权限检查
    if (req.user.role !== "admin" && video.Item.owner.S !== req.user.username) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const videoData = awsService.fromDynamoDBItem(video.Item);
    res.json(videoData);
  } catch (error) {
    console.error('Get error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    
    // 从DynamoDB获取视频信息
    const video = await awsService.getItem(`${process.env.DYNAMODB_TABLE_PREFIX}-videos`, {
      id: { S: videoId }
    });
    
    if (!video.Item) {
      return res.status(404).json({ error: "Video not found" });
    }
    
    // 权限检查
    if (req.user.role !== "admin" && video.Item.owner.S !== req.user.username) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // 从S3删除文件
    await awsService.deleteFromS3(video.Item.s3Key.S);
    
    // 删除转码后的文件
    if (video.Item.outputs) {
      const outputs = JSON.parse(video.Item.outputs.S);
      for (const output of outputs) {
        await awsService.deleteFromS3(output.s3Key);
      }
    }
    
    // 从DynamoDB删除记录
    await awsService.deleteItem(`${process.env.DYNAMODB_TABLE_PREFIX}-videos`, {
      id: { S: videoId }
    });
    
    // Cache removed - data deleted from DynamoDB only
    
    res.json({ message: "Video deleted" });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
};

