const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getParameter, region } = require("./config");

const s3 = new S3Client({ region });

async function getBucketName() {
  // Adjust parameter path to your environment
  const name = process.env.S3_BUCKET || await getParameter(process.env.PARAM_S3_BUCKET || "/game-media/prod/bucket", false);
  return name;
}

async function createPresignedPutUrl(key, expiresSeconds = 300, contentType = "application/octet-stream") {
  const Bucket = await getBucketName();
  const cmd = new PutObjectCommand({ Bucket, Key: key, ContentType: contentType });
  const url = await getSignedUrl(s3, cmd, { expiresIn: expiresSeconds });
  return { bucket: Bucket, key, url };
}

async function createPresignedGetUrl(key, expiresSeconds = 300) {
  const Bucket = await getBucketName();
  const cmd = new GetObjectCommand({ Bucket, Key: key });
  const url = await getSignedUrl(s3, cmd, { expiresIn: expiresSeconds });
  return { bucket: Bucket, key, url };
}

module.exports = { createPresignedPutUrl, createPresignedGetUrl };




