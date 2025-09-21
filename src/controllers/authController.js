const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, AdminAddUserToGroupCommand, AssociateSoftwareTokenCommand, VerifySoftwareTokenCommand, AdminSetUserMFAPreferenceCommand, AdminRespondToAuthChallengeCommand } = require("@aws-sdk/client-cognito-identity-provider");

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-2";
const client = new CognitoIdentityProviderClient({ region });

// 临时存储用户注册时的角色选择（在生产环境中应使用数据库）
const pendingUserRoles = new Map();

exports.register = async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: "username, email, password, role required" });
  }
  
  // 验证角色
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: "role must be 'user' or 'admin'" });
  }
  
  try {
    const cmd = new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: username,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email }
      ]
    });
    const out = await client.send(cmd);
    
    // 存储用户角色，等待确认后添加到相应的 User Group
    pendingUserRoles.set(username, role);
    
    res.json({ 
      userSub: out.UserSub, 
      codeDelivery: out.CodeDeliveryDetails, 
      role,
      message: "User registered successfully. Please confirm your email."
    });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
};

exports.confirm = async (req, res) => {
  const { username, code } = req.body;
  if (!username || !code) return res.status(400).json({ error: "username, code required" });
  try {
    const cmd = new ConfirmSignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: username,
      ConfirmationCode: code
    });
    await client.send(cmd);
    
    // 用户确认成功后，将其添加到相应的 User Group
    const userRole = pendingUserRoles.get(username);
    if (userRole) {
      try {
        const groupName = userRole === 'admin' ? 'Admin' : 'User';
        const addToGroupCmd = new AdminAddUserToGroupCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username: username,
          GroupName: groupName
        });
        await client.send(addToGroupCmd);
        
        // 清理临时存储
        pendingUserRoles.delete(username);
        
        res.json({ 
          ok: true, 
          message: `User confirmed and added to ${groupName} group`,
          role: userRole
        });
      } catch (groupError) {
        console.log('Error adding user to group:', groupError.message);
        res.json({ 
          ok: true, 
          message: "User confirmed but failed to add to group. Please contact administrator.",
          role: userRole
        });
      }
    } else {
      res.json({ 
        ok: true, 
        message: "User confirmed successfully"
      });
    }
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username, password required" });
  try {
    const cmd = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: username, PASSWORD: password }
    });
    const out = await client.send(cmd);
    
    // 从ID Token中解析用户角色和组信息
    let role = 'user'; // 默认角色
    let groups = [];
    if (out.AuthenticationResult.IdToken) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(out.AuthenticationResult.IdToken);
        groups = decoded['cognito:groups'] || [];
        
        // 根据组信息确定角色
        if (groups.includes('Admin')) {
          role = 'admin';
        } else if (groups.includes('User')) {
          role = 'user';
        }
      } catch (e) {
        console.log('Error decoding token:', e.message);
      }
    }
    
    // 返回统一的响应格式
    res.json({
      IdToken: out.AuthenticationResult.IdToken,
      AccessToken: out.AuthenticationResult.AccessToken,
      RefreshToken: out.AuthenticationResult.RefreshToken,
      TokenType: "Bearer",
      ExpiresIn: out.AuthenticationResult.ExpiresIn,
      role: role,
      groups: groups
    });
  } catch (e) {
    res.status(401).json({ error: e.message || String(e) });
  }
};

// MFA 相关函数
exports.setupMFA = async (req, res) => {
  try {
    // 从Authorization header获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "No valid authorization header" });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }
    
    const cmd = new AssociateSoftwareTokenCommand({
      AccessToken: token
    });
    const result = await client.send(cmd);
    
    res.json({
      secretCode: result.SecretCode,
      session: result.Session,
      qrCodeUrl: `otpauth://totp/${req.user.username}?secret=${result.SecretCode}&issuer=GameMedia`
    });
  } catch (error) {
    console.log('MFA setup error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

exports.verifyMFA = async (req, res) => {
  const { userCode, session } = req.body;
  if (!userCode || !session) {
    return res.status(400).json({ error: "userCode and session required" });
  }
  
  try {
    const cmd = new VerifySoftwareTokenCommand({
      AccessToken: req.headers.authorization?.split(' ')[1],
      UserCode: userCode,
      Session: session
    });
    const result = await client.send(cmd);
    
    if (result.Status === 'SUCCESS') {
      // 启用MFA偏好设置
      const mfaCmd = new AdminSetUserMFAPreferenceCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: req.user.username,
        SoftwareTokenMfaSettings: {
          Enabled: true,
          PreferredMfa: true
        }
      });
      await client.send(mfaCmd);
      
      res.json({ 
        message: "MFA setup completed successfully",
        status: result.Status
      });
    } else {
      res.status(400).json({ error: "MFA verification failed" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.respondToMFAChallenge = async (req, res) => {
  const { username, mfaCode, session } = req.body;
  if (!username || !mfaCode || !session) {
    return res.status(400).json({ error: "username, mfaCode, and session required" });
  }
  
  try {
    const cmd = new AdminRespondToAuthChallengeCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      ClientId: process.env.COGNITO_CLIENT_ID,
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: session,
      ChallengeResponses: {
        USERNAME: username,
        SOFTWARE_TOKEN_MFA_CODE: mfaCode
      }
    });
    const result = await client.send(cmd);
    
    if (result.AuthenticationResult) {
      // 从ID Token中解析用户角色和组信息
      let role = 'user';
      let groups = [];
      if (result.AuthenticationResult.IdToken) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.decode(result.AuthenticationResult.IdToken);
          groups = decoded['cognito:groups'] || [];
          
          if (groups.includes('Admin')) {
            role = 'admin';
          } else if (groups.includes('User')) {
            role = 'user';
          }
        } catch (e) {
          console.log('Error decoding token:', e.message);
        }
      }
      
      res.json({
        IdToken: result.AuthenticationResult.IdToken,
        AccessToken: result.AuthenticationResult.AccessToken,
        RefreshToken: result.AuthenticationResult.RefreshToken,
        TokenType: "Bearer",
        ExpiresIn: result.AuthenticationResult.ExpiresIn,
        role: role,
        groups: groups
      });
    } else {
      res.status(400).json({ error: "MFA challenge failed" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
