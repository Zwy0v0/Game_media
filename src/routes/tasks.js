const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getTaskStatus } = require("../utils/dynamo");

// 设置默认环境变量（如果没有.env文件）
if (!process.env.COGNITO_USER_POOL_ID) {
  process.env.COGNITO_USER_POOL_ID = "ap-southeast-2_XXXXXXXXX"; // 需要替换为实际的User Pool ID
}
if (!process.env.COGNITO_CLIENT_ID) {
  process.env.COGNITO_CLIENT_ID = "3496lr6poistit3vtqgh79qtrm"; // 从错误信息中获取的Client ID
}

// SSE 流式传输任务进度
router.get("/:taskId/stream", async (req, res) => {
  // 从查询参数获取token
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  
  // 手动验证token
  try {
    const jwt = require("jsonwebtoken");
    const jwksClient = require("jwks-rsa");
    
    // 创建 JWKS 客户端
    const client = jwksClient({
      jwksUri: `https://cognito-idp.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000,
      rateLimit: true,
      jwksRequestsPerMinute: 5
    });
    
    function getKey(header, callback) {
      client.getSigningKey(header.kid, (err, key) => {
        if (err) {
          callback(err);
          return;
        }
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
      });
    }
    
    // 验证token
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
        audience: process.env.COGNITO_CLIENT_ID
      }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });
    
    // 设置用户信息
    const groups = decoded['cognito:groups'] || [];
    let role = 'user';
    if (groups.includes('Admin')) {
      role = 'admin';
    } else if (groups.includes('User')) {
      role = 'user';
    }
    
    req.user = {
      username: decoded['cognito:username'] || decoded.username,
      email: decoded.email,
      role: role,
      sub: decoded.sub,
      groups: groups
    };
    
  } catch (error) {
    return res.status(403).json({ error: "Invalid token" });
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const taskId = req.params.taskId;
  let interval;
  let isConnected = true;

  const sendUpdate = async () => {
    if (!isConnected) return;
    
    try {
      const task = await getTaskStatus(taskId, req);
      if (task) {
        res.write(`data: ${JSON.stringify(task)}\n\n`);
        
        // 任务完成或失败时关闭连接
        if (task.status === 'done' || task.status === 'failed') {
          clearInterval(interval);
          res.end();
          return;
        }
      } else {
        res.write(`data: ${JSON.stringify({error: "Task not found"})}\n\n`);
        clearInterval(interval);
        res.end();
        return;
      }
    } catch (error) {
      res.write(`data: ${JSON.stringify({error: error.message})}\n\n`);
      clearInterval(interval);
      res.end();
      return;
    }
  };

  // 每秒发送一次更新
  interval = setInterval(sendUpdate, 1000);

  // 处理客户端断开连接
  req.on('close', () => {
    isConnected = false;
    clearInterval(interval);
    console.log(`SSE connection closed for task ${taskId}`);
  });

  req.on('error', (error) => {
    isConnected = false;
    clearInterval(interval);
    console.log(`SSE connection error for task ${taskId}:`, error.message);
  });

  // 发送初始连接确认
  res.write(`data: ${JSON.stringify({status: "connected", taskId})}\n\n`);
});

module.exports = router;
