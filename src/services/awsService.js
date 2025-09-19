const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand, DeleteItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminInitiateAuthCommand, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class AWSService {
  constructor() {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    this.cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
    this.ssmClient = new SSMClient({ region: process.env.AWS_REGION });
    this.secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
  }

  // S3操作
  async uploadToS3(key, body, contentType) {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType
    });
    return await this.s3Client.send(command);
  }

  async getFromS3(key) {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    });
    return await this.s3Client.send(command);
  }

  async deleteFromS3(key) {
    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    });
    return await this.s3Client.send(command);
  }

  // 生成预签名上传URL
  async generatePresignedUploadUrl(key, contentType, expiresIn = 3600) {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  // 生成预签名下载URL
  async generatePresignedDownloadUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  // DynamoDB操作
  async putItem(tableName, item) {
    const command = new PutItemCommand({
      TableName: tableName,
      Item: item
    });
    return await this.dynamoClient.send(command);
  }

  async getItem(tableName, key) {
    const command = new GetItemCommand({
      TableName: tableName,
      Key: key
    });
    return await this.dynamoClient.send(command);
  }

  async queryItems(tableName, keyConditionExpression, expressionAttributeValues) {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues
    });
    return await this.dynamoClient.send(command);
  }

  async scanItems(tableName, filterExpression, expressionAttributeValues) {
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues
    });
    return await this.dynamoClient.send(command);
  }

  async deleteItem(tableName, key) {
    const command = new DeleteItemCommand({
      TableName: tableName,
      Key: key
    });
    return await this.dynamoClient.send(command);
  }

  // Cognito操作
  async createUser(username, email, password) {
    const command = new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID||'ap-southeast-2_W4wRp7w0P',
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' }
      ],
      TemporaryPassword: password,
      MessageAction: 'SUPPRESS'
    });
    return await this.cognitoClient.send(command);
  }

  async authenticateUser(username, password) {
    const command = new AdminInitiateAuthCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    });
    return await this.cognitoClient.send(command);
  }

  async getUser(username) {
    const command = new AdminGetUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username
    });
    return await this.cognitoClient.send(command);
  }

  // Parameter Store操作
  async getParameter(name) {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true
    });
    const result = await this.ssmClient.send(command);
    return result.Parameter.Value;
  }

  // Secrets Manager操作
  async getSecret(secretName) {
    const command = new GetSecretValueCommand({
      SecretId: secretName
    });
    const result = await this.secretsClient.send(command);
    return JSON.parse(result.SecretString);
  }

  // 工具方法：转换DynamoDB属性
  static toDynamoDBItem(obj) {
    const item = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        item[key] = { S: value };
      } else if (typeof value === 'number') {
        item[key] = { N: value.toString() };
      } else if (typeof value === 'boolean') {
        item[key] = { BOOL: value };
      } else if (Array.isArray(value)) {
        item[key] = { SS: value };
      } else if (typeof value === 'object' && value !== null) {
        item[key] = { S: JSON.stringify(value) };
      }
    }
    return item;
  }

  static fromDynamoDBItem(item) {
    const obj = {};
    for (const [key, value] of Object.entries(item)) {
      if (value.S) {
        obj[key] = value.S;
      } else if (value.N) {
        obj[key] = Number(value.N);
      } else if (value.BOOL !== undefined) {
        obj[key] = value.BOOL;
      } else if (value.SS) {
        obj[key] = value.SS;
      }
    }
    return obj;
  }
}

const awsService = new AWSService();

async function initializeAWSServices() {
  try {
    // 测试连接
    await awsService.getParameter(`${process.env.PARAMETER_STORE_PREFIX}/app-url`);
    console.log('AWS services connected successfully');
  } catch (error) {
    console.error('AWS services initialization failed:', error);
  }
}

module.exports = { awsService, initializeAWSServices };
