const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath("ffmpeg");
const path = require("path");

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
exports.transcodeMultiRes = async (origFilename) => {
  const inputPath = path.join("uploads/videos", origFilename);
  const base = origFilename.replace(/\.[^/.]+$/, "");
  const outputs = [
    { res: "720p", filename: `${base}_720p.mp4`, sizeArg: "?x720" },
    { res: "480p", filename: `${base}_480p.mp4`, sizeArg: "?x480" },
    { res: "360p", filename: `${base}_360p.mp4`, sizeArg: "?x360" }
  ];

  for (const o of outputs) {
    const outPath = path.join("outputs/videos", o.filename);
    await transcodeOne(inputPath, outPath, o.sizeArg);
  }

  return outputs.map(({ res, filename }) => ({ res, filename }));
};

