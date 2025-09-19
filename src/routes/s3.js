const express = require('express');
const { awsService } = require('../services/awsService');
const auth = require('../middleware/auth');
const router = express.Router();

// 生成预签名URL用于上传 (requires authentication)
router.post('/presigned-upload', auth(), async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'Filename and contentType are required' });
    }
    
    // Include user identifier in S3 key for better organization
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const s3Key = `uploads/${req.user.username}/${timestamp}-${filename}`;
    const presignedUrl = await awsService.generatePresignedUploadUrl(s3Key, contentType);

    res.json({
      presignedUrl,
      s3Key,
      expiresIn: 3600,
      uploadedBy: req.user.username
    });
  } catch (error) {
    console.error('Presigned upload URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 生成预签名URL用于下载 (requires authentication)
router.post('/presigned-download', auth(), async (req, res) => {
  try {
    const { s3Key } = req.body;
    
    if (!s3Key) {
      return res.status(400).json({ error: 'S3Key is required' });
    }
    
    const presignedUrl = await awsService.generatePresignedDownloadUrl(s3Key);
    
    res.json({ 
      presignedUrl,
      expiresIn: 3600 
    });
  } catch (error) {
    console.error('Presigned download URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 批量生成预签名URL
router.post('/presigned-batch', async (req, res) => {
  try {
    const { operations } = req.body; // [{ type: 'upload'|'download', filename?, s3Key?, contentType? }]
    
    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'Operations array is required' });
    }
    
    const results = [];
    
    for (const op of operations) {
      if (op.type === 'upload') {
        if (!op.filename || !op.contentType) {
          results.push({ error: 'Filename and contentType required for upload' });
          continue;
        }
        const s3Key = `uploads/${op.filename}`;
        const presignedUrl = await awsService.generatePresignedUploadUrl(s3Key, op.contentType);
        results.push({ type: 'upload', s3Key, presignedUrl });
      } else if (op.type === 'download') {
        if (!op.s3Key) {
          results.push({ error: 'S3Key required for download' });
          continue;
        }
        const presignedUrl = await awsService.generatePresignedDownloadUrl(op.s3Key);
        results.push({ type: 'download', s3Key: op.s3Key, presignedUrl });
      } else {
        results.push({ error: 'Invalid operation type' });
      }
    }
    
    res.json({ results });
  } catch (error) {
    console.error('Batch presigned URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取文件信息
router.get('/file-info/:s3Key', async (req, res) => {
  try {
    const s3Key = req.params.s3Key;
    
    if (!s3Key) {
      return res.status(400).json({ error: 'S3Key is required' });
    }
    
    const s3Object = await awsService.getFromS3(s3Key);
    
    res.json({
      s3Key,
      contentType: s3Object.ContentType,
      contentLength: s3Object.ContentLength,
      lastModified: s3Object.LastModified,
      etag: s3Object.ETag
    });
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      res.status(404).json({ error: 'File not found' });
    } else {
      console.error('File info error:', error);
      res.status(500).json({ error: error.message });
    }
  }
});

// 删除文件
router.delete('/file/:s3Key', async (req, res) => {
  try {
    const s3Key = req.params.s3Key;
    
    if (!s3Key) {
      return res.status(400).json({ error: 'S3Key is required' });
    }
    
    await awsService.deleteFromS3(s3Key);
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
