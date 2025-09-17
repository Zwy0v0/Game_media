const mongoose = require("mongoose");

const outputSchema = new mongoose.Schema({
  size: String,          // "thumb" | "medium"
  filename: String       // 例如 1692522000000_thumb.jpg
}, { _id: false });

const screenshotSchema = new mongoose.Schema({
  filename: String,                  // 原始文件名
  mimeType: String,
  game: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  processed: { type: Boolean, default: false },
  outputs: { type: [outputSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Screenshot", screenshotSchema);

