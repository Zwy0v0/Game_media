#!/bin/bash

# 手动部署脚本 - 第一阶段：微服务架构
# 适用于手动创建SQS队列的情况

set -e

PROFILE="Game_media"
echo "🚀 开始部署游戏媒体应用微服务架构..."

AWS="/c/Program Files/Amazon/AWSCLIV2/aws.exe"

if ! "$AWS" sts get-caller-identity --profile "$PROFILE" > /dev/null 2>&1; then
    echo "❌ AWS CLI未配置或凭证无效 (profile=$PROFILE)"
    exit 1
fi

echo "✅ AWS CLI 已配置 (profile=$PROFILE)"

# 从.env文件读取SQS队列URL
if [ -f .env ]; then
    source .env
    echo "✅ 从.env文件加载SQS队列URL"
    echo "   Video Queue: $VIDEO_TRANSCODE_QUEUE_URL"
    echo "   Image Queue: $IMAGE_PROCESS_QUEUE_URL"
    echo "   DLQ: $DLQ_URL"
else
    echo "❌ .env文件不存在，请先创建并填入SQS队列URL"
    exit 1
fi

# 1. 创建ECR仓库
echo "📦 创建ECR仓库..."
ECR_URL=$("$AWS" ecr create-repository --repository-name game-media-app --region ap-southeast-2 --profile "$PROFILE" --query "repository.repositoryUri" --output text 2>/dev/null || \
          "$AWS" ecr describe-repositories --repository-names game-media-app --region ap-southeast-2 --profile "$PROFILE" --query "repositories[0].repositoryUri" --output text)

echo "✅ ECR Repository: $ECR_URL"

# 2. 创建ECS集群
echo "📦 创建ECS集群..."
"$AWS" ecs create-cluster --cluster-name game-media-cluster --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || echo "ECS集群已存在"

# 3. 创建IAM角色
echo "📦 创建IAM角色..."

# 创建执行角色
"$AWS" iam create-role --role-name game-media-ecs-execution-role --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}' --profile "$PROFILE" 2>/dev/null || echo "执行角色已存在"

"$AWS" iam attach-role-policy --role-name game-media-ecs-execution-role --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy --profile "$PROFILE" 2>/dev/null || echo "执行角色策略已附加"

# 创建任务角色
"$AWS" iam create-role --role-name game-media-ecs-task-role --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}' --profile "$PROFILE" 2>/dev/null || echo "任务角色已存在"

# 获取账户ID
ACCOUNT_ID=$("$AWS" sts get-caller-identity --profile "$PROFILE" --query "Account" --output text)
EXECUTION_ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/game-media-ecs-execution-role"
TASK_ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/game-media-ecs-task-role"

# 4. 创建CloudWatch日志组
echo "📦 创建CloudWatch日志组..."
"$AWS" logs create-log-group --log-group-name "/ecs/game-media-api-gateway" --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || echo "API Gateway日志组已存在"
"$AWS" logs create-log-group --log-group-name "/ecs/game-media-video-processor" --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || echo "Video Processor日志组已存在"
"$AWS" logs create-log-group --log-group-name "/ecs/game-media-image-processor" --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || echo "Image Processor日志组已存在"

# 5. 构建和推送Docker镜像
echo "🐳 构建和推送Docker镜像..."

# 登录ECR
"$AWS" ecr get-login-password --region ap-southeast-2 --profile "$PROFILE" | docker login --username AWS --password-stdin $ECR_URL

# 构建API Gateway镜像
echo "构建API Gateway镜像..."
docker build -f Dockerfile.api-gateway -t game-media-api-gateway .
docker tag game-media-api-gateway:latest "$ECR_URL:api-gateway-latest"
docker push "$ECR_URL:api-gateway-latest"

# 构建Video Processor镜像
echo "构建Video Processor镜像..."
docker build -f Dockerfile.video-processor -t game-media-video-processor .
docker tag game-media-video-processor:latest "$ECR_URL:video-processor-latest"
docker push "$ECR_URL:video-processor-latest"

# 构建Image Processor镜像
echo "构建Image Processor镜像..."
docker build -f Dockerfile.image-processor -t game-media-image-processor .
docker tag game-media-image-processor:latest "$ECR_URL:image-processor-latest"
docker push "$ECR_URL:image-processor-latest"

echo "✅ Docker镜像构建和推送完成"

# 6. 创建任务定义
echo "🔄 创建ECS任务定义..."

# API Gateway任务定义
cat > api-gateway-task-def.json << EOF
{
  "family": "game-media-api-gateway",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$EXECUTION_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "api-gateway",
      "image": "$ECR_URL:api-gateway-latest",
      "portMappings": [{"containerPort": 8080, "protocol": "tcp"}],
      "environment": [
        {"name": "AWS_REGION", "value": "ap-southeast-2"},
        {"name": "S3_BUCKET", "value": "n11866632-a2"},
        {"name": "DDB_TASK_TABLE", "value": "game-media-tasks"},
        {"name": "VIDEO_TRANSCODE_QUEUE_URL", "value": "$VIDEO_TRANSCODE_QUEUE_URL"},
        {"name": "IMAGE_PROCESS_QUEUE_URL", "value": "$IMAGE_PROCESS_QUEUE_URL"},
        {"name": "DLQ_URL", "value": "$DLQ_URL"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/game-media-api-gateway",
          "awslogs-region": "ap-southeast-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Video Processor任务定义
cat > video-processor-task-def.json << EOF
{
  "family": "game-media-video-processor",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "$EXECUTION_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "video-processor",
      "image": "$ECR_URL:video-processor-latest",
      "portMappings": [{"containerPort": 8081, "protocol": "tcp"}],
      "environment": [
        {"name": "AWS_REGION", "value": "ap-southeast-2"},
        {"name": "S3_BUCKET", "value": "n11866632-a2"},
        {"name": "DDB_TASK_TABLE", "value": "game-media-tasks"},
        {"name": "VIDEO_TRANSCODE_QUEUE_URL", "value": "$VIDEO_TRANSCODE_QUEUE_URL"},
        {"name": "DLQ_URL", "value": "$DLQ_URL"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/game-media-video-processor",
          "awslogs-region": "ap-southeast-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Image Processor任务定义
cat > image-processor-task-def.json << EOF
{
  "family": "game-media-image-processor",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "$EXECUTION_ROLE_ARN",
  "taskRoleArn": "$TASK_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "image-processor",
      "image": "$ECR_URL:image-processor-latest",
      "portMappings": [{"containerPort": 8082, "protocol": "tcp"}],
      "environment": [
        {"name": "AWS_REGION", "value": "ap-southeast-2"},
        {"name": "S3_BUCKET", "value": "n11866632-a2"},
        {"name": "DDB_TASK_TABLE", "value": "game-media-tasks"},
        {"name": "IMAGE_PROCESS_QUEUE_URL", "value": "$IMAGE_PROCESS_QUEUE_URL"},
        {"name": "DLQ_URL", "value": "$DLQ_URL"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/game-media-image-processor",
          "awslogs-region": "ap-southeast-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# 注册任务定义
"$AWS" ecs register-task-definition --cli-input-json file://api-gateway-task-def.json --region ap-southeast-2 --profile "$PROFILE"
"$AWS" ecs register-task-definition --cli-input-json file://video-processor-task-def.json --region ap-southeast-2 --profile "$PROFILE"
"$AWS" ecs register-task-definition --cli-input-json file://image-processor-task-def.json --region ap-southeast-2 --profile "$PROFILE"

# 清理临时文件
rm -f api-gateway-task-def.json video-processor-task-def.json image-processor-task-def.json

echo "✅ ECS任务定义创建完成"

# 7. 创建ECS服务
echo "🚀 创建ECS服务..."

# 获取VPC和子网信息
VPC_ID=$("$AWS" ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region ap-southeast-2 --profile "$PROFILE")
SUBNET_ID=$("$AWS" ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[0].SubnetId" --output text --region ap-southeast-2 --profile "$PROFILE")

echo "使用VPC: $VPC_ID, 子网: $SUBNET_ID"

# 创建安全组
SG_ID=$("$AWS" ec2 create-security-group --group-name game-media-sg --description "Security group for game media app" --vpc-id $VPC_ID --query "GroupId" --output text --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || \
        "$AWS" ec2 describe-security-groups --filters "Name=group-name,Values=game-media-sg" --query "SecurityGroups[0].GroupId" --output text --region ap-southeast-2 --profile "$PROFILE")

echo "✅ 安全组ID: $SG_ID"

# 允许HTTP流量
"$AWS" ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 8080 --cidr 0.0.0.0/0 --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || echo "端口8080规则已存在"
"$AWS" ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 8081 --cidr 0.0.0.0/0 --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || echo "端口8081规则已存在"
"$AWS" ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 8082 --cidr 0.0.0.0/0 --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || echo "端口8082规则已存在"

# 创建ECS服务
echo "创建API Gateway服务..."
"$AWS" ecs create-service --cluster game-media-cluster --service-name api-gateway-service --task-definition game-media-api-gateway --desired-count 1 --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || echo "API Gateway服务已存在"

echo "创建Video Processor服务..."
"$AWS" ecs create-service --cluster game-media-cluster --service-name video-processor-service --task-definition game-media-video-processor --desired-count 2 --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || echo "Video Processor服务已存在"

echo "创建Image Processor服务..."
"$AWS" ecs create-service --cluster game-media-cluster --service-name image-processor-service --task-definition game-media-image-processor --desired-count 2 --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" --region ap-southeast-2 --profile "$PROFILE" 2>/dev/null || echo "Image Processor服务已存在"

echo "🎉 第一阶段部署完成！"
echo ""
echo "📋 部署摘要:"
echo "   ECS Cluster: game-media-cluster"
echo "   ECR Repository: $ECR_URL"
echo "   Video Queue: $VIDEO_TRANSCODE_QUEUE_URL"
echo "   Image Queue: $IMAGE_PROCESS_QUEUE_URL"
echo "   DLQ: $DLQ_URL"
echo "   Security Group: $SG_ID"
echo ""
echo "🔍 验证部署:"
echo "   aws ecs list-services --cluster game-media-cluster --region ap-southeast-2 --profile $PROFILE"
echo "   aws ecs describe-services --cluster game-media-cluster --services api-gateway-service video-processor-service image-processor-service --region ap-southeast-2 --profile $PROFILE"
echo ""
echo "📋 下一步需要做的:"
echo "1. 配置Application Load Balancer"
echo "2. 设置Auto Scaling Group"
echo "3. 实现自定义扩缩容指标"
echo "4. 申请ACM证书和配置HTTPS"
echo "5. 设置Route53域名"





