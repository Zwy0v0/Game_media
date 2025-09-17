const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Video = require("../models/Video");
const Task = require("../models/Task");
const { transcodeMultiRes } = require("../utils/ffmpeg");
const { fetchWikiGameInfo } = require("../utils/gameInfo");

const storage = multer.diskStorage({
  destination: "uploads/videos",
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

exports.uploadMiddleware = upload.single("video");

/**
 * 上传视频：创建 Video，并创建一个“转码任务(queued)” → 返回 taskId
 */
exports.uploadVideo = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No video file uploaded. Field name must be 'video'." });

  const video = await Video.create({
    filename: req.file.filename,
    mimeType: req.file.mimetype,
    game: req.body.game || "",
    owner: req.user.id
  });

  if (video.game) {
    const info = await fetchWikiGameInfo(video.game);
    if (info) { video.gameInfo = info; await video.save(); }
  }

  const task = await Task.create({
    type: "transcode",
    targetType: "video",
    targetId: video._id,
    owner: req.user.id,
    status: "queued",
    params: { multi: ["720p", "480p", "360p"] }
  });

  res.json({ videoId: video._id, taskId: task._id, gameInfo: video.gameInfo || null });
};

/**
 * 触发转码（CPU密集）：查找/创建任务 → 运行 → 更新 Video.outputs
 */
exports.transcode = async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });

  // 权限：user 只能操作自己的
  if (req.user.role !== "admin" && String(video.owner) !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // 找到最近一个 queued 任务（否则新建一个）
  let task = await Task.findOne({ targetType: "video", targetId: video._id, type: "transcode", status: "queued" })
    .sort({ createdAt: -1 });

  if (!task) {
    task = await Task.create({
      type: "transcode",
      targetType: "video",
      targetId: video._id,
      owner: req.user.id,
      status: "queued",
      params: { multi: ["720p", "480p", "360p"] }
    });
  }

  // 执行
  try {
    task.status = "running";
    await task.save();

    const outs = await transcodeMultiRes(video.filename);
    video.outputs = outs;
    video.transcoded = true;
    await video.save();

    task.status = "done";
    await task.save();

    res.json({ taskId: task._id, status: task.status, outputs: outs });
  } catch (e) {
    task.status = "failed";
    task.error = e.message || String(e);
    await task.save();
    return res.status(500).json({ taskId: task._id, status: task.status, error: task.error });
  }
};

/**
 * 列表：分页/过滤/排序
 * /api/v1/videos?game=LoL&transcoded=true&page=1&limit=10&sort=-createdAt
 */
exports.listVideos = async (req, res) => {
  const { page = 1, limit = 5, sort = "-createdAt", game, transcoded } = req.query;

  const filter = {};
  if (game) filter.game = game;
  if (typeof transcoded !== "undefined") filter.transcoded = transcoded === "true";

  // 权限：user 只看自己的
  if (req.user.role !== "admin") filter.owner = req.user.id;

  const q = Video.find(filter).populate("owner", "username role");
  if (sort) q.sort(sort);
  const total = await Video.countDocuments(filter);
  const items = await q.skip((page - 1) * limit).limit(Number(limit));

  res.json({ total, page: Number(page), limit: Number(limit), items });

};

/**
 * 单条明细
 */
exports.getVideo = async (req, res) => {
  const video = await Video.findById(req.params.id).populate("owner", "username role");
  if (!video) return res.status(404).json({ error: "Video not found" });
  if (req.user.role !== "admin" && String(video.owner._id) !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(video);
};

/**
 * 删除：物理文件 + 文档
 */
exports.deleteVideo = async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  if (req.user.role !== "admin" && String(video.owner) !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // 删除磁盘文件（容错）
  const files = [
    path.join("uploads/videos", video.filename),
    ...video.outputs.map(o => path.join("outputs/videos", o.filename))
  ];
  files.forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) { } });

  await Video.deleteOne({ _id: video._id });
  await Task.deleteMany({ targetType: "video", targetId: video._id });
  res.json({ message: "Video deleted" });
};

