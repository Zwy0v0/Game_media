const sharp = require("sharp");
const path = require("path");

/**
 * 生成 thumb(200x200) 与 medium(1280宽等比)
 * 返回 [{ size, filename }]
 */
exports.processImageMulti = async (origFilename) => {
  const inputPath = path.join("uploads/screenshots", origFilename);
  const base = origFilename.replace(/\.[^/.]+$/, "");

  const outThumb = `${base}_thumb.jpg`;
  const outMedium = `${base}_medium.jpg`;

  await sharp(inputPath).resize(200, 200).toFile(path.join("outputs/screenshots", outThumb));
  await sharp(inputPath).resize(1280).jpeg({ quality: 80 }).toFile(path.join("outputs/screenshots", outMedium));

  return [
    { size: "thumb", filename: outThumb },
    { size: "medium", filename: outMedium }
  ];
};
