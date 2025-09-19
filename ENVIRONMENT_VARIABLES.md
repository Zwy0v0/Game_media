# Environment Variables Used in Game Media App

## Complete List of Environment Variables

Based on your `.env` file, here are all the environment variables used in the application:

### Core Application Variables
- `PORT=8080` - Application port
- `MONGO_URI=mongodb://mongo:27017/gamemedia` - MongoDB connection string
- `JWT_SECRET=supersecret` - JWT signing secret

### AWS Configuration
- `AWS_REGION=ap-southeast-2` - AWS region
- `AWS_ACCESS_KEY_ID=your_access_key` - AWS access key (replace with actual value)
- `AWS_SECRET_ACCESS_KEY=your_secret_key` - AWS secret key (replace with actual value)

### S3 Configuration
- `S3_BUCKET_NAME=n11866632-a2` - S3 bucket name
- `S3_REGION=ap-southeast-2` - S3 region

### DynamoDB Configuration
- `DYNAMODB_TABLE_PREFIX=game-media` - DynamoDB table prefix

### Cognito Configuration
- `COGNITO_USER_POOL_ID=ap-southeast-2_mTEoQVEYX` - Cognito User Pool ID
- `COGNITO_CLIENT_ID=21i3517d7ajm6pcpjbvrldtagm` - Cognito Client ID

### Parameter Store Configuration
- `PARAMETER_STORE_PREFIX=/n11866632/demo_parameter` - Parameter Store prefix

### Secrets Manager Configuration
- `SECRETS_MANAGER_SECRET_NAME=n11866632-demosecret` - Secrets Manager secret name

## Files Using Environment Variables

### Controllers
- `src/controllers/authController.js` - Uses `JWT_SECRET`
- `src/controllers/videoController.js` - Uses `DYNAMODB_TABLE_PREFIX`
- `src/controllers/screenshotController.js` - Uses `DYNAMODB_TABLE_PREFIX`

### Services
- `src/services/awsService.js` - Uses all AWS-related variables

### Middleware
- `src/middleware/auth.js` - Uses `JWT_SECRET`

### Main Application
- `src/app.js` - Uses `PORT`, `MONGO_URI`

## Hardcoded Values (No Environment Variables)

The following values are hardcoded in the application and do not require environment variables:

- JWT token expiration: `1h` (1 hour)
- Default user role: `"user"`
- MongoDB connection options: `{ useNewUrlParser: true, useUnifiedTopology: true }`
- CORS configuration: enabled for all origins
- File upload field names: `"video"`, `"screenshot"`
- S3 key prefixes: `"videos/"`, `"screenshots/"`
- DynamoDB table suffixes: `"-videos"`, `"-screenshots"`

## Removed Variables

The following variables were removed as part of cache elimination:
- `ELASTICACHE_ENDPOINT` - No longer used
- `ELASTICACHE_PORT` - No longer used

## Notes

1. **AWS Credentials**: You need to replace `your_access_key` and `your_secret_key` with your actual AWS credentials.

2. **Fallback Values**: The application includes fallback values for critical variables:
   - `JWT_SECRET` defaults to `"supersecret"` if not provided
   - `PORT` defaults to `8080` if not provided
   - `MONGO_URI` defaults to `mongodb://mongo:27017/gamemedia` if not provided

3. **Security**: Make sure to keep your `.env` file secure and never commit it to version control.

4. **Consistency**: All configuration files (`docker-compose.yml`, `AWS_CONFIG.md`) now match your `.env` file exactly.
