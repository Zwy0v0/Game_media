const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { region } = require("./config");

const s3 = new S3Client({ region });

/**
 * 生成 thumb(200x200) 与 medium(1280宽等比)
 * 返回 [{ size, filename }]
 */
exports.processImageMulti = async (s3Key) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "img-"));
  const base = path.basename(s3Key).replace(/\.[^/.]+$/, "");
  const inputPath = path.join(tmpDir, path.basename(s3Key));

  // 下载原图
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

  const outThumb = `${base}_thumb.jpg`;
  const outMedium = `${base}_medium.jpg`;

  const outThumbPath = path.join(tmpDir, outThumb);
  const outMediumPath = path.join(tmpDir, outMedium);

  await sharp(inputPath).resize(200, 200).toFile(outThumbPath);
  await sharp(inputPath).resize(1280).jpeg({ quality: 80 }).toFile(outMediumPath);

  // 上传到S3
  const outThumbKey = `outputs/screenshots/${outThumb}`;
  const outMediumKey = `outputs/screenshots/${outMedium}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: outThumbKey, Body: fs.createReadStream(outThumbPath), ContentType: "image/jpeg" }));
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: outMediumKey, Body: fs.createReadStream(outMediumPath), ContentType: "image/jpeg" }));

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}

  return [
    { size: "thumb", filename: outThumbKey },
    { size: "medium", filename: outMediumKey }
  ];
};
