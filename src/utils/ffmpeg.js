const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath("ffmpeg");
const { awsService } = require("../services/awsService");
const fs = require("fs");
const path = require("path");

function transcodeOne(inputBuffer, sizeArg) {
  return new Promise((resolve, reject) => {
    const tempInputPath = path.join("/tmp", `input_${Date.now()}.mp4`);
    const tempOutputPath = path.join("/tmp", `output_${Date.now()}.mp4`);
    
    // 写入临时文件
    fs.writeFileSync(tempInputPath, inputBuffer);
    
    ffmpeg(tempInputPath)
      .size(sizeArg) // "?x720" | "?x480" | "?x360"
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-preset veryfast", "-crf 23"])
      .output(tempOutputPath)
      .on("end", () => {
        const outputBuffer = fs.readFileSync(tempOutputPath);
        // 清理临时文件
        fs.unlinkSync(tempInputPath);
        fs.unlinkSync(tempOutputPath);
        resolve(outputBuffer);
      })
      .on("error", (err) => {
        // 清理临时文件
        try { fs.unlinkSync(tempInputPath); } catch (_) {}
        try { fs.unlinkSync(tempOutputPath); } catch (_) {}
        reject(err);
      })
      .run();
  });
}

/**
 * 返回输出 { res, filename, s3Key } 数组
 */
exports.transcodeMultiRes = async (fileBuffer, filename) => {
  const base = filename.replace(/\.[^/.]+$/, "");
  const outputs = [
    { res: "720p", filename: `${base}_720p.mp4`, sizeArg: "?x720" },
    { res: "480p", filename: `${base}_480p.mp4`, sizeArg: "?x480" },
    { res: "360p", filename: `${base}_360p.mp4`, sizeArg: "?x360" }
  ];

  const results = [];
  for (const o of outputs) {
    const outputBuffer = await transcodeOne(fileBuffer, o.sizeArg);
    const s3Key = `outputs/videos/${o.filename}`;
    
    // 上传到S3
    await awsService.uploadToS3(s3Key, outputBuffer, 'video/mp4');
    
    results.push({
      res: o.res,
      filename: o.filename,
      s3Key: s3Key
    });
  }

  return results;
};

