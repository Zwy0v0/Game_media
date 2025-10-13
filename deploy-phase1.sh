#!/bin/bash

# 部署脚本 - 第一阶段：微服务架构
# 这个脚本将部署三个独立的服务到ECS

set -e

PROFILE="Game_media"
echo "🚀 开始部署游戏媒体应用微服务架构..."

AWS="/c/Program Files/Amazon/AWSCLIV2/aws.exe"

if ! "$AWS" sts get-caller-identity --profile "$PROFILE" > /dev/null 2>&1; then
    echo "❌ AWS CLI未配置或凭证无效 (profile=$PROFILE)"
    exit 1
fi

echo "✅ AWS CLI 已配置 (profile=$PROFILE)"

# 1. 部署Terraform基础设施
echo "📦 部署Terraform基础设施..."
cd terraform

# 初始化Terraform
terraform init

# 计划部署
terraform plan -out=tfplan

# 应用部署
terraform apply tfplan

# 获取输出值
ECR_REPO_URL=$(terraform output -raw ecr_repository_url)
VIDEO_QUEUE_URL=$(terraform output -raw video_transcode_queue_url)
IMAGE_QUEUE_URL=$(terraform output -raw image_process_queue_url)
DLQ_URL=$(terraform output -raw dlq_url)
ECS_CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)

echo "✅ Terraform基础设施部署完成"
echo "   ECR Repository: $ECR_REPO_URL"
echo "   Video Queue: $VIDEO_QUEUE_URL"
echo "   Image Queue: $IMAGE_QUEUE_URL"
echo "   DLQ: $DLQ_URL"
echo "   ECS Cluster: $ECS_CLUSTER_NAME"

cd ..

# 2. 构建和推送Docker镜像
echo "🐳 构建和推送Docker镜像..."

# 登录ECR
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin $ECR_REPO_URL

# 构建API Gateway镜像
echo "构建API Gateway镜像..."
docker build -f Dockerfile.api-gateway -t game-media-api-gateway .
docker tag game-media-api-gateway:latest $ECR_REPO_URL:api-gateway-latest
docker push $ECR_REPO_URL:api-gateway-latest

# 构建Video Processor镜像
echo "构建Video Processor镜像..."
docker build -f Dockerfile.video-processor -t game-media-video-processor .
docker tag game-media-video-processor:latest $ECR_REPO_URL:video-processor-latest
docker push $ECR_REPO_URL:video-processor-latest

# 构建Image Processor镜像
echo "构建Image Processor镜像..."
docker build -f Dockerfile.image-processor -t game-media-image-processor .
docker tag game-media-image-processor:latest $ECR_REPO_URL:image-processor-latest
docker push $ECR_REPO_URL:image-processor-latest

echo "✅ Docker镜像构建和推送完成"

# 3. 更新ECS任务定义
echo "🔄 更新ECS任务定义..."

# 更新API Gateway任务定义
aws ecs register-task-definition \
    --family game-media-api-gateway \
    --network-mode awsvpc \
    --requires-compatibilities FARGATE \
    --cpu 256 \
    --memory 512 \
    --execution-role-arn $(terraform -chdir=terraform output -raw ecs_execution_role_arn) \
    --task-role-arn $(terraform -chdir=terraform output -raw ecs_task_role_arn) \
    --container-definitions '[
        {
            "name": "api-gateway",
            "image": "'$ECR_REPO_URL':api-gateway-latest",
            "portMappings": [{"containerPort": 8080, "protocol": "tcp"}],
            "environment": [
                {"name": "AWS_REGION", "value": "ap-southeast-2"},
                {"name": "S3_BUCKET", "value": "'$(terraform -chdir=terraform output -raw s3_bucket_name)'"},
                {"name": "DDB_TASK_TABLE", "value": "'$(terraform -chdir=terraform output -raw tasks_table_name)'"},
                {"name": "VIDEO_TRANSCODE_QUEUE_URL", "value": "'$VIDEO_QUEUE_URL'"},
                {"name": "IMAGE_PROCESS_QUEUE_URL", "value": "'$IMAGE_QUEUE_URL'"},
                {"name": "DLQ_URL", "value": "'$DLQ_URL'"}
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
    ]'

# 更新Video Processor任务定义
aws ecs register-task-definition \
    --family game-media-video-processor \
    --network-mode awsvpc \
    --requires-compatibilities FARGATE \
    --cpu 1024 \
    --memory 2048 \
    --execution-role-arn $(terraform -chdir=terraform output -raw ecs_execution_role_arn) \
    --task-role-arn $(terraform -chdir=terraform output -raw ecs_task_role_arn) \
    --container-definitions '[
        {
            "name": "video-processor",
            "image": "'$ECR_REPO_URL':video-processor-latest",
            "portMappings": [{"containerPort": 8081, "protocol": "tcp"}],
            "environment": [
                {"name": "AWS_REGION", "value": "ap-southeast-2"},
                {"name": "S3_BUCKET", "value": "'$(terraform -chdir=terraform output -raw s3_bucket_name)'"},
                {"name": "DDB_TASK_TABLE", "value": "'$(terraform -chdir=terraform output -raw tasks_table_name)'"},
                {"name": "VIDEO_TRANSCODE_QUEUE_URL", "value": "'$VIDEO_QUEUE_URL'"},
                {"name": "DLQ_URL", "value": "'$DLQ_URL'"}
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
    ]'

# 更新Image Processor任务定义
aws ecs register-task-definition \
    --family game-media-image-processor \
    --network-mode awsvpc \
    --requires-compatibilities FARGATE \
    --cpu 512 \
    --memory 1024 \
    --execution-role-arn $(terraform -chdir=terraform output -raw ecs_execution_role_arn) \
    --task-role-arn $(terraform -chdir=terraform output -raw ecs_task_role_arn) \
    --container-definitions '[
        {
            "name": "image-processor",
            "image": "'$ECR_REPO_URL':image-processor-latest",
            "portMappings": [{"containerPort": 8082, "protocol": "tcp"}],
            "environment": [
                {"name": "AWS_REGION", "value": "ap-southeast-2"},
                {"name": "S3_BUCKET", "value": "'$(terraform -chdir=terraform output -raw s3_bucket_name)'"},
                {"name": "DDB_TASK_TABLE", "value": "'$(terraform -chdir=terraform output -raw tasks_table_name)'"},
                {"name": "IMAGE_PROCESS_QUEUE_URL", "value": "'$IMAGE_QUEUE_URL'"},
                {"name": "DLQ_URL", "value": "'$DLQ_URL'"}
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
    ]'

echo "✅ ECS任务定义更新完成"

echo "🎉 第一阶段部署完成！"
echo ""
echo "📋 下一步需要做的："
echo "1. 创建ECS服务来运行这些任务定义"
echo "2. 配置VPC和子网"
echo "3. 设置安全组"
echo "4. 配置负载均衡器"
echo "5. 设置自动扩缩容"
echo ""
echo "🔍 检查部署状态："
echo "   ECS Cluster: $ECS_CLUSTER_NAME"
echo "   ECR Repository: $ECR_REPO_URL"
echo "   SQS Queues: 已创建"
echo "   CloudWatch Logs: 已创建"
