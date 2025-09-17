const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Screenshot = require("../models/Screenshot");
const Task = require("../models/Task");
const { processImageMulti } = require("../utils/sharp");

const storage = multer.diskStorage({
  destination: "uploads/screenshots",
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

exports.uploadMiddleware = upload.single("screenshot");

exports.uploadScreenshot = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No screenshot uploaded. Field 'screenshot' required." });

  const shot = await Screenshot.create({
    filename: req.file.filename,
    mimeType: req.file.mimetype,
    game: req.body.game || "",
    owner: req.user.id
  });

  res.json(shot);
};

/**
 * 处理（CPU可选）：生成 thumb/medium
 * 返回 taskId + 状态
 */
exports.processScreenshot = async (req, res) => {
  const shot = await Screenshot.findById(req.params.id);
  if (!shot) return res.status(404).json({ error: "Screenshot not found" });
  if (req.user.role !== "admin" && String(shot.owner) !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const task = await Task.create({
    type: "image-process",
    targetType: "screenshot",
    targetId: shot._id,
    owner: req.user.id,
    status: "queued",
    params: { sizes: ["thumb", "medium"] }
  });

  try {
    task.status = "running";
    await task.save();

    const outs = await processImageMulti(shot.filename);
    shot.outputs = outs;
    shot.processed = true;
    await shot.save();

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
 * 列表：/api/v1/screenshots?game=LoL&processed=true&page=1&limit=10&sort=-createdAt
 */
exports.listShots = async (req, res) => {
  const { page = 1, limit = 5, sort = "-createdAt", game, processed } = req.query;

  const filter = {};
  if (game) filter.game = game;
  if (typeof processed !== "undefined") filter.processed = processed === "true";
  if (req.user.role !== "admin") filter.owner = req.user.id;

  const q = Screenshot.find(filter).populate("owner", "username role");
  if (sort) q.sort(sort);
  const total = await Screenshot.countDocuments(filter);
  const items = await q.skip((page - 1) * limit).limit(Number(limit));

  res.json({ total, page: Number(page), limit: Number(limit), items });
};

exports.getShot = async (req, res) => {
  const shot = await Screenshot.findById(req.params.id).populate("owner", "username role");
  if (!shot) return res.status(404).json({ error: "Screenshot not found" });
  if (req.user.role !== "admin" && String(shot.owner._id) !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(shot);
};


exports.deleteShot = async (req, res) => {
  const shot = await Screenshot.findById(req.params.id);
  if (!shot) return res.status(404).json({ error: "Screenshot not found" });
  if (req.user.role !== "admin" && String(shot.owner) !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const files = [
    path.join("uploads/screenshots", shot.filename),
    ...shot.outputs.map(o => path.join("outputs/screenshots", o.filename))
  ];
  files.forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) { } });

  await Screenshot.deleteOne({ _id: shot._id });
  await Task.deleteMany({ targetType: "screenshot", targetId: shot._id });
  res.json({ message: "Screenshot deleted" });
};
