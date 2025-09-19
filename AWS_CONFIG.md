# AWS 配置说明

请在项目根目录创建 `.env` 文件，包含以下配置：

```env
# 现有配置
PORT=8080
MONGO_URI=mongodb://mongo:27017/gamemedia
JWT_SECRET=supersecret

# AWS配置
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# S3配置
S3_BUCKET_NAME=n11866632-a2
S3_REGION=ap-southeast-2

# DynamoDB配置
DYNAMODB_TABLE_PREFIX=game-media

# Cognito配置
COGNITO_USER_POOL_ID=ap-southeast-2_mTEoQVEYX
COGNITO_CLIENT_ID=21i3517d7ajm6pcpjbvrldtagm

# Parameter Store配置
PARAMETER_STORE_PREFIX=/n11866632/demo_parameter

# Secrets Manager配置
SECRETS_MANAGER_SECRET_NAME=n11866632-demosecret
```

## 配置说明

- `PORT`: 应用端口，默认8080
- `MONGO_URI`: MongoDB连接字符串
- `JWT_SECRET`: JWT签名密钥
- `AWS_REGION`: AWS区域，建议使用 ap-southeast-2 (悉尼)
- `S3_BUCKET_NAME`: S3存储桶名称，用于存储媒体文件
- `S3_REGION`: S3存储桶区域
- `DYNAMODB_TABLE_PREFIX`: DynamoDB表名前缀
- `COGNITO_USER_POOL_ID`: Cognito用户池ID
- `COGNITO_CLIENT_ID`: Cognito客户端ID
- `PARAMETER_STORE_PREFIX`: Parameter Store参数前缀
- `SECRETS_MANAGER_SECRET_NAME`: Secrets Manager密钥名称
