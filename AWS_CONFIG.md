# AWS 配置说明

请在项目根目录创建 `.env` 文件，包含以下配置：

```env
# 现有配置
MONGO_URI=mongodb://mongo:27017/gamemedia
JWT_SECRET=supersecret
PORT=8080

# AWS配置
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# S3配置
S3_BUCKET_NAME=your-game-media-bucket
S3_REGION=ap-southeast-2

# DynamoDB配置
DYNAMODB_TABLE_PREFIX=game-media

# Cognito配置
COGNITO_USER_POOL_ID=your_user_pool_id
COGNITO_CLIENT_ID=your_client_id

# Parameter Store配置
PARAMETER_STORE_PREFIX=/game-media-app

# Secrets Manager配置
SECRETS_MANAGER_SECRET_NAME=game-media-app-secrets
```

## 配置说明

- `AWS_REGION`: AWS区域，建议使用 ap-southeast-2 (悉尼)
- `S3_BUCKET_NAME`: S3存储桶名称，用于存储媒体文件
- `DYNAMODB_TABLE_PREFIX`: DynamoDB表名前缀
- `COGNITO_USER_POOL_ID`: Cognito用户池ID
- `COGNITO_CLIENT_ID`: Cognito客户端ID
- `PARAMETER_STORE_PREFIX`: Parameter Store参数前缀
- `SECRETS_MANAGER_SECRET_NAME`: Secrets Manager密钥名称
