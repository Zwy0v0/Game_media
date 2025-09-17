const mongoose = require("mongoose");

const outputSchema = new mongoose.Schema({
  res: String,           // "720p" | "480p" | "360p"
  filename: String       // 例如 1692522000000_720p.mp4
}, { _id: false });

const videoSchema = new mongoose.Schema({
  filename: String,                  // 原始文件名（磁盘上的）
  mimeType: String,
  game: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  transcoded: { type: Boolean, default: false },
  outputs: { type: [outputSchema], default: [] },  // 多分辨率输出
  gameInfo: {
    title: String,
    summary: String,
    thumbnail: String
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Video", videoSchema);

