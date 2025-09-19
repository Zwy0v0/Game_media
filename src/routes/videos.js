const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const videoCtrl = require("../controllers/videoController");
const { createPresignedPutUrl } = require("../utils/s3");

// 申请上传URL（客户端直传S3）
router.post("/upload-url", auth(), async (req, res) => {
  const { fileName = "video.mp4", contentType = "video/mp4" } = req.body || {};
  const key = `uploads/videos/${Date.now()}_${fileName}`;
  const out = await createPresignedPutUrl(key, 300, contentType);
  res.json({ key, uploadUrl: out.url });
});

// 客户端上传完成后创建元数据
router.post("/", auth(), videoCtrl.createVideoRecord);

// 触发多分辨率转码（CPU）
router.post("/:id/transcode", auth(), videoCtrl.transcode);

// 列表/详情/下载/删除
router.get("/", auth(), videoCtrl.listVideos);
router.get("/:id", auth(), videoCtrl.getVideo);
router.get("/:id/download-url", auth(), videoCtrl.getDownloadUrl);
router.delete("/:id", auth(), videoCtrl.deleteVideo);

module.exports = router;
