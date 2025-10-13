const path = require("path");
const fs = require("fs");
const { media } = require("../utils/dynamo");
const { fetchWikiGameInfo } = require("../utils/gameInfo");
const { createPresignedGetUrl } = require("../utils/s3");
const { putTaskStatus } = require("../utils/dynamo");
const { sendMessage } = require("../utils/sqs");

// 客户端直传完成后创建元数据
exports.createVideoRecord = async (req, res) => {
  const { key, mimeType, game } = req.body || {};
  if (!key) return res.status(400).json({ error: "key required" });

  const video = await media.createVideo({ 
    "qut-username": req.user.email,
    id: String(Date.now()), 
    filename: key, 
    mimeType: mimeType || "", 
    game: game || "", 
    owner: req.user.sub, 
    transcoded: false, 
    outputs: [], 
    createdAt: Date.now() 
  }, req);

  if (video.game) {
    const info = await fetchWikiGameInfo(video.game);
    if (info) { await media.updateVideo(video.id, { gameInfo: info }, req); }
  }

  res.json({ id: video.id, gameInfo: video.gameInfo || null });
};

/**
 * 触发转码（异步队列）：查找/创建任务 → 发送到SQS队列
 */
exports.transcode = async (req, res) => {
  const video = await media.getVideo(req.params.id, req);
  if (!video) return res.status(404).json({ error: "Video not found" });

  // 由于所有数据都使用固定的学号邮箱，Admin 可以访问所有数据，User 只能访问自己的数据
  const isAdmin = (req.user.groups || []).includes("Admin");
  const fixedUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  
  if (!isAdmin && String(video["qut-username"]) !== fixedUsername) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const taskId = String(Date.now());
  const task = { 
    taskId: taskId,
    type: "transcode", 
    targetType: "video", 
    targetId: video.id, 
    videoId: video.id, 
    owner: req.user.sub || req.user.id, 
    status: "queued", 
    params: { multi: ["720p","480p","360p"] }, 
    createdAt: Date.now(),
    filename: video.filename,
    queueName: "VIDEO_TRANSCODE"
  };

  try {
    // 创建任务记录
    await putTaskStatus({ 
      taskId: taskId, 
      status: "queued", 
      progress: 0, 
      updatedAt: Date.now() 
    }, req);

    // 发送到SQS队列
    await sendMessage("VIDEO_TRANSCODE", task, {
      videoId: {
        DataType: "String",
        StringValue: video.id
      },
      filename: {
        DataType: "String", 
        StringValue: video.filename
      }
    });

    res.json({ 
      taskId: taskId, 
      status: "queued", 
      message: "Video transcode task queued successfully" 
    });
  } catch (error) {
    console.error("Error queuing video transcode task:", error);
    return res.status(500).json({ 
      taskId: taskId, 
      status: "failed", 
      error: error.message || "Failed to queue transcode task" 
    });
  }
};

/**
 * 列表：分页/过滤/排序
 * /api/v1/videos?game=LoL&transcoded=true&page=1&limit=10&sort=-createdAt
 */
exports.listVideos = async (req, res) => {
  const { page = 1, limit = 5, sort = "-createdAt", game, transcoded } = req.query;

  // 检查用户是否为 Admin，如果不是则只显示自己的内容
  const isAdmin = (req.user.groups || []).includes("Admin");
  const fixedUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  const owner = isAdmin ? null : fixedUsername;
  const items = await media.listVideosByOwner(owner, req);
  res.json({ total: items.length, page: Number(page), limit: Number(limit), items });

};

/**
 * 单条明细
 */
exports.getVideo = async (req, res) => {
  const video = await media.getVideo(req.params.id, req);
  if (!video) return res.status(404).json({ error: "Video not found" });
  
  // 由于所有数据都使用固定的学号邮箱，Admin 可以访问所有数据，User 只能访问自己的数据
  const isAdmin = (req.user.groups || []).includes("Admin");
  const fixedUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  
  if (!isAdmin && String(video["qut-username"]) !== fixedUsername) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(video);
};

/**
 * 删除：物理文件 + 文档
 */
exports.deleteVideo = async (req, res) => {
  const video = await media.getVideo(req.params.id, req);
  if (!video) return res.status(404).json({ error: "Video not found" });
  
  // 由于所有数据都使用固定的学号邮箱，Admin 可以访问所有数据，User 只能访问自己的数据
  const isAdmin = (req.user.groups || []).includes("Admin");
  const fixedUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  
  if (!isAdmin && String(video["qut-username"]) !== fixedUsername) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await media.deleteVideo(video.id, req);
  res.json({ message: "Video deleted" });
};

exports.getDownloadUrl = async (req, res) => {
  const video = await media.getVideo(req.params.id, req);
  if (!video) return res.status(404).json({ error: "Video not found" });
  
  // 由于所有数据都使用固定的学号邮箱，Admin 可以访问所有数据，User 只能访问自己的数据
  const isAdmin = (req.user.groups || []).includes("Admin");
  const fixedUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  
  if (!isAdmin && String(video["qut-username"]) !== fixedUsername) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const url = await createPresignedGetUrl(video.filename, 3600); // 1小时有效期
  res.json({ url: url.url });
};

