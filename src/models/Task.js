const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  type: { type: String, enum: ["transcode", "image-process"], required: true },
  targetType: { type: String, enum: ["video", "screenshot"], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["queued", "running", "done", "failed"], default: "queued" },
  params: { type: Object, default: {} },
  error: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

taskSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Task", taskSchema);
