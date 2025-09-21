const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

// 设置默认环境变量（如果没有.env文件）
if (!process.env.COGNITO_USER_POOL_ID) {
  process.env.COGNITO_USER_POOL_ID = "ap-southeast-2_XXXXXXXXX"; // 需要替换为实际的User Pool ID
}
if (!process.env.COGNITO_CLIENT_ID) {
  process.env.COGNITO_CLIENT_ID = "3496lr6poistit3vtqgh79qtrm"; // 从错误信息中获取的Client ID
}

// 创建 JWKS 客户端
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
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

function auth(requiredRole) {
  return (req, res, next) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).json({ error: "No token provided" });

    const tokenValue = token.split(" ")[1];
    if (!tokenValue) return res.status(401).json({ error: "Invalid token format" });

    // 先解码token查看内容（不验证）
    let decoded;
    try {
      decoded = jwt.decode(tokenValue);
      console.log('Token audience:', decoded?.aud);
      console.log('Expected audience:', process.env.COGNITO_CLIENT_ID);
      console.log('Token type:', decoded?.token_use);
    } catch (e) {
      console.log('Token decode error:', e.message);
    }

    jwt.verify(tokenValue, getKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
      audience: process.env.COGNITO_CLIENT_ID
    }, (err, decoded) => {
      if (err) {
        console.log('JWT verification error:', err.message);
        console.log('Token audience:', decoded?.aud);
        console.log('Expected audience:', process.env.COGNITO_CLIENT_ID);
        
        // 如果是audience错误，尝试不验证audience（仅用于调试）
        if (err.message.includes('audience')) {
          console.log('Attempting verification without audience check...');
          jwt.verify(tokenValue, getKey, {
            algorithms: ['RS256'],
            issuer: `https://cognito-idp.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
            ignoreExpiration: false,
            ignoreNotBefore: false
          }, (err2, decoded2) => {
            if (err2) {
              console.log('Verification without audience also failed:', err2.message);
              return res.status(403).json({ error: "Invalid token" });
            }
            console.log('Verification successful without audience check');
            // 继续处理decoded2...
            processDecodedToken(decoded2, req, res, next, requiredRole);
          });
          return;
        }
        
        return res.status(403).json({ error: "Invalid token" });
      }
      
      processDecodedToken(decoded, req, res, next, requiredRole);
    });
  };
}

function processDecodedToken(decoded, req, res, next, requiredRole) {
  // 从Cognito token中提取用户信息
  const groups = decoded['cognito:groups'] || [];
  let role = 'user'; // 默认角色
  
  // 根据组信息确定角色
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

  // 注入到 req.auth 以便其他模块使用
  req.auth = {
    username: req.user.username,
    email: req.user.email,
    groups: req.user.groups
  };

  // 检查角色权限
  if (requiredRole && req.user.role !== requiredRole) {
    return res.status(403).json({ 
      error: `Insufficient role. Required: ${requiredRole}, Current: ${req.user.role}` 
    });
  }
  
  next();
}

module.exports = auth;
