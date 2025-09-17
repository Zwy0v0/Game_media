const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const shotCtrl = require("../controllers/screenshotController");

// 上传
router.post("/upload", auth(), shotCtrl.uploadMiddleware, shotCtrl.uploadScreenshot);

// 处理（CPU可选）
router.post("/:id/process", auth(), shotCtrl.processScreenshot);

// 列表/详情/下载/删除
router.get("/", auth(), shotCtrl.listShots);
router.get("/:id", auth(), shotCtrl.getShot);
router.delete("/:id", auth(), shotCtrl.deleteShot);

module.exports = router;
