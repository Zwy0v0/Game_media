const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const shotCtrl = require("../controllers/screenshotController");
const { createPresignedPutUrl } = require("../utils/s3");

// 申请上传URL（客户端直传S3）
router.post("/upload-url", auth(), async (req, res) => {
  const { fileName = "image.jpg", contentType = "image/jpeg" } = req.body || {};
  const key = `uploads/screenshots/${Date.now()}_${fileName}`;
  const out = await createPresignedPutUrl(key, 300, contentType);
  res.json({ key, uploadUrl: out.url });
});

// 客户端上传完成后创建元数据
router.post("/", auth(), shotCtrl.createScreenshotRecord);

// 处理（CPU可选）
router.post("/:id/process", auth(), shotCtrl.processScreenshot);

// 列表/详情/下载/删除
router.get("/", auth(), shotCtrl.listShots);
router.get("/:id", auth(), shotCtrl.getShot);
router.delete("/:id", auth(), shotCtrl.deleteShot);

module.exports = router;
