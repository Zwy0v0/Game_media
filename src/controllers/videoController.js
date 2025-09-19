const path = require("path");
const fs = require("fs");
const { media } = require("../utils/dynamo");
const { transcodeMultiRes } = require("../utils/ffmpeg");
const { fetchWikiGameInfo } = require("../utils/gameInfo");
const { createPresignedGetUrl } = require("../utils/s3");
const { putTaskStatus, updateTaskStatus } = require("../utils/dynamo");

// 客户端直传完成后创建元数据
exports.createVideoRecord = async (req, res) => {
  const { key, mimeType, game } = req.body || {};
  if (!key) return res.status(400).json({ error: "key required" });

  const video = await media.createVideo({ id: String(Date.now()), filename: key, mimeType: mimeType || "", game: game || "", owner: req.user.sub, transcoded: false, outputs: [], createdAt: Date.now() });

  if (video.game) {
    const info = await fetchWikiGameInfo(video.game);
    if (info) { await media.updateVideo(video.id, { gameInfo: info }); }
  }

  res.json({ id: video.id, gameInfo: video.gameInfo || null });
};

/**
 * 触发转码（CPU密集）：查找/创建任务 → 运行 → 更新 Video.outputs
 */
exports.transcode = async (req, res) => {
  const video = await media.getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });

  // 权限：user 只能操作自己的
  if (!(req.user.groups || []).includes("Admin") && String(video.owner) !== (req.user.sub || req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const task = { _id: String(Date.now()), type: "transcode", targetType: "video", targetId: video.id, owner: req.user.sub || req.user.id, status: "queued", params: { multi: ["720p","480p","360p"] }, createdAt: Date.now() };

  // 执行
  try {
    task.status = "running";
    await putTaskStatus({ taskId: String(task._id), status: "running", progress: 0, updatedAt: Date.now() });

    const outs = await transcodeMultiRes(video.filename);
    await media.updateVideo(video.id, { outputs: outs, transcoded: true });

    task.status = "done";
    await updateTaskStatus(String(task._id), { status: "done", progress: 100, updatedAt: Date.now() });

    res.json({ taskId: task._id, status: task.status, outputs: outs });
  } catch (e) {
    task.status = "failed";
    task.error = e.message || String(e);
    await updateTaskStatus(String(task._id), { status: "failed", error: task.error, updatedAt: Date.now() });
    return res.status(500).json({ taskId: task._id, status: task.status, error: task.error });
  }
};

/**
 * 列表：分页/过滤/排序
 * /api/v1/videos?game=LoL&transcoded=true&page=1&limit=10&sort=-createdAt
 */
exports.listVideos = async (req, res) => {
  const { page = 1, limit = 5, sort = "-createdAt", game, transcoded } = req.query;

  const owner = (!(req.user.groups || []).includes("Admin")) ? (req.user.sub || req.user.id) : null;
  const items = await media.listVideosByOwner(owner);
  res.json({ total: items.length, page: Number(page), limit: Number(limit), items });

};

/**
 * 单条明细
 */
exports.getVideo = async (req, res) => {
  const video = await media.getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  if (!(req.user.groups || []).includes("Admin") && String(video.owner) !== (req.user.sub || req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(video);
};

/**
 * 删除：物理文件 + 文档
 */
exports.deleteVideo = async (req, res) => {
  const video = await media.getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  if (!(req.user.groups || []).includes("Admin") && String(video.owner) !== (req.user.sub || req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await media.deleteVideo(video.id);
  res.json({ message: "Video deleted" });
};

exports.getDownloadUrl = async (req, res) => {
  const video = await media.getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  if (!(req.user.groups || []).includes("Admin") && String(video.owner) !== (req.user.sub || req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const url = await createPresignedGetUrl(video.filename, 300);
  res.json({ downloadUrl: url.url });
};

