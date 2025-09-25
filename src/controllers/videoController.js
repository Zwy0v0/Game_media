const path = require("path");
const fs = require("fs");
const { media } = require("../utils/dynamo");
const { transcodeMultiRes } = require("../utils/ffmpeg");
const { fetchWikiGameInfo } = require("../utils/gameInfo");
const { createPresignedGetUrl } = require("../utils/s3");
const { putTaskStatus, updateTaskStatus } = require("../utils/dynamo");

// 小工具：刚创建即读取时，做一次轻量重试以防抖动
async function getVideoWithRetry(id, req, times = 3, delayMs = 120) {
  for (let i = 0; i < times; i++) {
    const v = await media.getVideo(id, req);
    if (v) return v;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

// 客户端直传完成后创建元数据
exports.createVideoRecord = async (req, res) => {
  const { key, mimeType, game } = req.body || {};
  if (!key) return res.status(400).json({ error: "key required" });

  const video = await media.createVideo(
    {
      "qut-username": req.user?.email, // 会被 utils/dynamo 中固定邮箱覆盖，留存无妨
      id: String(Date.now()),
      filename: key,
      mimeType: mimeType || "",
      game: game || "",
      owner: (req.user && (req.user.sub || req.user.id)) || "",
      transcoded: false,
      outputs: [],
      createdAt: Date.now(),
    },
    req
  );

  if (video.game) {
    try {
      const info = await fetchWikiGameInfo(video.game);
      if (info) {
        await media.updateVideo(video.id, { gameInfo: info }, req);
      }
    } catch (_) {}
  }

  res.json({ id: video.id, gameInfo: video.gameInfo || null });
};

/**
 * 触发转码（CPU密集）：查找/创建任务 → 运行 → 更新 Video.outputs
 */
exports.transcode = async (req, res) => {
  const videoId = String(req.params.id);
  const video = await getVideoWithRetry(videoId, req);
  if (!video) return res.status(404).json({ error: "Video not found" });

  // 所有数据使用固定学号邮箱；Admin 可访问所有数据，User 只能访问自己的数据
  const isAdmin = (req.user?.groups || []).includes("Admin");
  const fixedUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  if (!isAdmin && String(video["qut-username"]) !== fixedUsername) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const task = {
    _id: String(Date.now()),
    type: "transcode",
    targetType: "video",
    targetId: video.id,
    owner: (req.user && (req.user.sub || req.user.id)) || "",
    status: "queued",
    params: { multi: ["720p", "480p", "360p"] },
    createdAt: Date.now(),
  };

  try {
    task.status = "running";
    await putTaskStatus(
      { taskId: String(task._id), status: "running", progress: 0, updatedAt: Date.now() },
      req
    );

    const outs = await transcodeMultiRes(video.filename);
    await media.updateVideo(video.id, { outputs: outs, transcoded: true }, req);

    task.status = "done";
    await updateTaskStatus(String(task._id), { status: "done", progress: 100, updatedAt: Date.now() }, req);

    res.json({ taskId: task._id, status: task.status, outputs: outs });
  } catch (e) {
    task.status = "failed";
    task.error = e.message || String(e);
    await updateTaskStatus(String(task._id), { status: "failed", error: task.error, updatedAt: Date.now() }, req);
    return res.status(500).json({ taskId: task._id, status: task.status, error: task.error });
  }
};

/**
 * 列表：分页/过滤/排序
 * /api/v1/videos?game=LoL&transcoded=true&page=1&limit=10&sort=-createdAt
 */
exports.listVideos = async (req, res) => {
  const { page = 1, limit = 5 } = req.query;
  const isAdmin = (req.user?.groups || []).includes("Admin");
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

  const isAdmin = (req.user?.groups || []).includes("Admin");
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

  const isAdmin = (req.user?.groups || []).includes("Admin");
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

  const isAdmin = (req.user?.groups || []).includes("Admin");
  const fixedUsername = process.env.QUT_USERNAME || "n11866632@qut.edu.au";
  if (!isAdmin && String(video["qut-username"]) !== fixedUsername) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const url = await createPresignedGetUrl(video.filename, 3600);
  res.json({ url: url.url });
};
