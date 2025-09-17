const jwt = require("jsonwebtoken");
const { awsService } = require("../services/awsService");
const { cacheService } = require("../services/cacheService");

// 用户注册
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // 验证输入
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required" });
    }

    // 使用Cognito注册用户
    const result = await awsService.createUser(username, email, password);
    
    res.json({ 
      message: "User registered successfully",
      username: result.User.Username,
      userStatus: result.User.UserStatus
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'UsernameExistsException') {
      res.status(409).json({ error: "Username already exists" });
    } else if (error.name === 'InvalidParameterException') {
      res.status(400).json({ error: "Invalid parameters provided" });
    } else {
      res.status(500).json({ error: "Registration failed" });
    }
  }
};

// 用户登录
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // 使用Cognito验证用户
    const result = await awsService.authenticateUser(username, password);
    
    if (result.AuthenticationResult) {
      // 获取用户信息
      const userInfo = await awsService.getUser(username);
      
      // 生成JWT token
      const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
      const token = jwt.sign(
        { 
          username: username, 
          role: userInfo.UserAttributes.find(attr => attr.Name === 'custom:role')?.Value || "user",
          cognitoSub: result.AuthenticationResult.AccessToken
        },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      // 缓存用户会话
      await cacheService.cacheUserSession(username, token, 3600);
      
      res.json({ 
        token,
        username: username,
        role: userInfo.UserAttributes.find(attr => attr.Name === 'custom:role')?.Value || "user"
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error('Login error:', error);
    if (error.name === 'NotAuthorizedException') {
      res.status(401).json({ error: "Invalid credentials" });
    } else if (error.name === 'UserNotFoundException') {
      res.status(404).json({ error: "User not found" });
    } else {
      res.status(500).json({ error: "Login failed" });
    }
  }
};

// 用户登出
exports.logout = async (req, res) => {
  try {
    const { username } = req.body;
    
    if (username) {
      // 删除缓存中的用户会话
      await cacheService.deleteUserSession(username);
    }
    
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: "Logout failed" });
  }
};

// 验证token
exports.verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
    const decoded = jwt.verify(token, JWT_SECRET);
    
    res.json({ 
      valid: true, 
      user: {
        username: decoded.username,
        role: decoded.role
      }
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};
