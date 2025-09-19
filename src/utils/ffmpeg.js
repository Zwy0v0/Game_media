const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath("ffmpeg");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { region } = require("./config");
const { createPresignedGetUrl } = require("./s3");

const s3 = new S3Client({ region });

function transcodeOne(inputPath, outputPath, sizeArg) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .size(sizeArg) // "?x720" | "?x480" | "?x360"
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-preset veryfast", "-crf 23"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

/**
 * 返回输出 { res, filename } 数组
 */
exports.transcodeMultiRes = async (s3Key) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vid-"));
  const base = path.basename(s3Key).replace(/\.[^/.]+$/, "");
  const inputPath = path.join(tmpDir, path.basename(s3Key));

  // 下载原视频到临时文件
  const bucket = process.env.S3_BUCKET;
  const getCmd = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
  const data = await s3.send(getCmd);
  await new Promise((resolve, reject) => {
    const write = fs.createWriteStream(inputPath);
    data.Body.pipe(write);
    data.Body.on("error", reject);
    write.on("finish", resolve);
    write.on("error", reject);
  });
  const outputs = [
    { res: "720p", filename: `${base}_720p.mp4`, sizeArg: "?x720" },
    { res: "480p", filename: `${base}_480p.mp4`, sizeArg: "?x480" },
    { res: "360p", filename: `${base}_360p.mp4`, sizeArg: "?x360" }
  ];

  for (const o of outputs) {
    const outPath = path.join(tmpDir, o.filename);
    await transcodeOne(inputPath, outPath, o.sizeArg);
    // 上传到S3 outputs
    const outKey = `outputs/videos/${o.filename}`;
    const body = fs.createReadStream(outPath);
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: outKey, Body: body, ContentType: "video/mp4" }));
  }

  // 清理临时目录（容错）
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}

  return outputs.map(({ res, filename }) => ({ res, filename: `outputs/videos/${filename}` }));
};

