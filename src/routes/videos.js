const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const videoCtrl = require("../controllers/videoController");

// 上传原始视频（返回 taskId）
router.post("/upload", auth(), videoCtrl.uploadMiddleware, videoCtrl.uploadVideo);

// 触发多分辨率转码（CPU）
router.post("/:id/transcode", auth(), videoCtrl.transcode);

// 列表/详情/下载/删除
router.get("/", auth(), videoCtrl.listVideos);
router.get("/:id", auth(), videoCtrl.getVideo);
router.delete("/:id", auth(), videoCtrl.deleteVideo);

module.exports = router;
