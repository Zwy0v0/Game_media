const path = require("path");
const fs = require("fs");
const { media } = require("../utils/dynamo");
const { processImageMulti } = require("../utils/sharp");
const { createPresignedGetUrl } = require("../utils/s3");
const { putTaskStatus, updateTaskStatus } = require("../utils/dynamo");

exports.createScreenshotRecord = async (req, res) => {
  const { key, mimeType, game } = req.body || {};
  if (!key) return res.status(400).json({ error: "key required" });

  const shot = await media.createScreenshot({ id: String(Date.now()), filename: key, mimeType: mimeType || "", game: game || "", owner: req.user.sub || req.user.id, processed: false, outputs: [], createdAt: Date.now() });
  res.json({ id: shot.id });
};

/**
 * 处理（CPU可选）：生成 thumb/medium
 * 返回 taskId + 状态
 */
exports.processScreenshot = async (req, res) => {
  const shot = await media.getScreenshot(req.params.id);
  if (!shot) return res.status(404).json({ error: "Screenshot not found" });
  if (!(req.user.groups || []).includes("Admin") && String(shot.owner) !== (req.user.sub || req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const task = { _id: String(Date.now()), type: "image-process", targetType: "screenshot", targetId: shot.id, owner: req.user.sub || req.user.id, status: "queued", params: { sizes: ["thumb","medium"] }, createdAt: Date.now() };

  try {
    task.status = "running";
    await task.save();
    await putTaskStatus({ taskId: String(task._id), status: "running", progress: 0, updatedAt: Date.now() });

    const outs = await processImageMulti(shot.filename);
    await media.updateScreenshot(shot.id, { outputs: outs, processed: true });

    task.status = "done";
    await task.save();
    await updateTaskStatus(String(task._id), { status: "done", progress: 100, updatedAt: Date.now() });

    res.json({ taskId: task._id, status: task.status, outputs: outs });
  } catch (e) {
    task.status = "failed";
    task.error = e.message || String(e);
    await task.save();
    await updateTaskStatus(String(task._id), { status: "failed", error: task.error, updatedAt: Date.now() });
    return res.status(500).json({ taskId: task._id, status: task.status, error: task.error });
  }
};

/**
 * 列表：/api/v1/screenshots?game=LoL&processed=true&page=1&limit=10&sort=-createdAt
 */
exports.listShots = async (req, res) => {
  const { page = 1, limit = 5, sort = "-createdAt", game, processed } = req.query;

  const owner = (!(req.user.groups || []).includes("Admin")) ? (req.user.sub || req.user.id) : null;
  const items = await media.listScreenshotsByOwner(owner);
  res.json({ total: items.length, page: Number(page), limit: Number(limit), items });
};

exports.getShot = async (req, res) => {
  const shot = await media.getScreenshot(req.params.id);
  if (!shot) return res.status(404).json({ error: "Screenshot not found" });
  if (!(req.user.groups || []).includes("Admin") && String(shot.owner) !== (req.user.sub || req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(shot);
};


exports.deleteShot = async (req, res) => {
  const shot = await media.getScreenshot(req.params.id);
  if (!shot) return res.status(404).json({ error: "Screenshot not found" });
  if (!(req.user.groups || []).includes("Admin") && String(shot.owner) !== (req.user.sub || req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await media.deleteScreenshot(shot.id);
  res.json({ message: "Screenshot deleted" });
};
