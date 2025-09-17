const sharp = require("sharp");
const { awsService } = require("../services/awsService");

/**
 * 生成 thumb(200x200) 与 medium(1280宽等比)
 * 返回 [{ size, filename, s3Key }]
 */
exports.processImageMulti = async (fileBuffer, filename) => {
  const base = filename.replace(/\.[^/.]+$/, "");

  const outThumb = `${base}_thumb.jpg`;
  const outMedium = `${base}_medium.jpg`;

  // 生成缩略图
  const thumbBuffer = await sharp(fileBuffer)
    .resize(200, 200)
    .jpeg({ quality: 80 })
    .toBuffer();
  
  const thumbKey = `outputs/screenshots/${outThumb}`;
  await awsService.uploadToS3(thumbKey, thumbBuffer, 'image/jpeg');

  // 生成中等尺寸图片
  const mediumBuffer = await sharp(fileBuffer)
    .resize(1280)
    .jpeg({ quality: 80 })
    .toBuffer();
  
  const mediumKey = `outputs/screenshots/${outMedium}`;
  await awsService.uploadToS3(mediumKey, mediumBuffer, 'image/jpeg');

  return [
    { size: "thumb", filename: outThumb, s3Key: thumbKey },
    { size: "medium", filename: outMedium, s3Key: mediumKey }
  ];
};
