provider "aws" {
  region = "ap-southeast-2"
}

# S3 Bucket for media storage
resource "aws_s3_bucket" "media_bucket" {
  bucket = "n11866632-a2"
  
  tags = {
    Name        = "Game Media Storage"
    Environment = "production"
    Purpose     = "assessment-2"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_s3_bucket_versioning" "media_bucket_versioning" {
  bucket = aws_s3_bucket.media_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media_bucket_encryption" {
  bucket = aws_s3_bucket.media_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# DynamoDB Tables
resource "aws_dynamodb_table" "videos" {
  name           = "game-media-videos"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "qut-username"
  range_key      = "id"

  attribute {
    name = "qut-username"
    type = "S"
  }

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name        = "Game Media Videos"
    Environment = "production"
    Purpose     = "assessment-2"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_dynamodb_table" "screenshots" {
  name           = "game-media-screenshots"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "qut-username"
  range_key      = "id"

  attribute {
    name = "qut-username"
    type = "S"
  }

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name        = "Game Media Screenshots"
    Environment = "production"
    Purpose     = "assessment-2"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_dynamodb_table" "tasks" {
  name           = "game-media-tasks"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "qut-username"
  range_key      = "taskId"

  attribute {
    name = "qut-username"
    type = "S"
  }

  attribute {
    name = "taskId"
    type = "S"
  }

  tags = {
    Name        = "Game Media Tasks"
    Environment = "production"
    Purpose     = "assessment-2"
    qut-username = "n11866632@qut.edu.au"
  }
}

# Parameter Store Parameters
resource "aws_ssm_parameter" "videos_table" {
  name  = "/game-media/prod/videosTable"
  type  = "String"
  value = aws_dynamodb_table.videos.name
  
  tags = {
    Name        = "Videos Table Parameter"
    Environment = "production"
    Purpose     = "assessment-2"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_ssm_parameter" "screenshots_table" {
  name  = "/game-media/prod/screenshotsTable"
  type  = "String"
  value = aws_dynamodb_table.screenshots.name
  
  tags = {
    Name        = "Screenshots Table Parameter"
    Environment = "production"
    Purpose     = "assessment-2"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_ssm_parameter" "task_table" {
  name  = "/game-media/prod/taskTable"
  type  = "String"
  value = aws_dynamodb_table.tasks.name
  
  tags = {
    Name        = "Task Table Parameter"
    Environment = "production"
    Purpose     = "assessment-2"
    qut-username = "n11866632@qut.edu.au"
  }
}

# Secrets Manager Secret
resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "n11866632-demosecret"
  description             = "Application secrets for game media app"
  recovery_window_in_days = 7

  tags = {
    Name        = "Game Media App Secrets"
    Environment = "production"
    Purpose     = "assessment-2"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    jwt_secret = "your-super-secret-jwt-key-here"
    external_api_key = "your-external-api-key-here"
    database_password = "your-database-password-here"
  })
}

# ECR Repository for container images
resource "aws_ecr_repository" "game_media_app" {
  name                 = "game-media-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "Game Media App ECR"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

# SQS Queues
resource "aws_sqs_queue" "video_transcode_queue" {
  name                      = "game-media-video-transcode"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600
  receive_wait_time_seconds = 20
  visibility_timeout_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "Video Transcode Queue"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_sqs_queue" "image_process_queue" {
  name                      = "game-media-image-process"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600
  receive_wait_time_seconds = 20
  visibility_timeout_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "Image Process Queue"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_sqs_queue" "dlq" {
  name                      = "game-media-dlq"
  message_retention_seconds = 1209600

  tags = {
    Name        = "Dead Letter Queue"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "game_media_cluster" {
  name = "game-media-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name        = "Game Media ECS Cluster"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

# ECS Task Definition for API Gateway
resource "aws_ecs_task_definition" "api_gateway" {
  family                   = "game-media-api-gateway"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "api-gateway"
      image = "${aws_ecr_repository.game_media_app.repository_url}:latest"
      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "AWS_REGION"
          value = "ap-southeast-2"
        },
        {
          name  = "S3_BUCKET"
          value = aws_s3_bucket.media_bucket.id
        },
        {
          name  = "DDB_TASK_TABLE"
          value = aws_dynamodb_table.tasks.name
        },
        {
          name  = "VIDEO_TRANSCODE_QUEUE_URL"
          value = aws_sqs_queue.video_transcode_queue.url
        },
        {
          name  = "IMAGE_PROCESS_QUEUE_URL"
          value = aws_sqs_queue.image_process_queue.url
        },
        {
          name  = "DLQ_URL"
          value = aws_sqs_queue.dlq.url
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api_gateway_logs.name
          awslogs-region        = "ap-southeast-2"
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = {
    Name        = "API Gateway Task Definition"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

# ECS Task Definition for Video Processor
resource "aws_ecs_task_definition" "video_processor" {
  family                   = "game-media-video-processor"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "video-processor"
      image = "${aws_ecr_repository.game_media_app.repository_url}:latest"
      portMappings = [
        {
          containerPort = 8081
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "AWS_REGION"
          value = "ap-southeast-2"
        },
        {
          name  = "S3_BUCKET"
          value = aws_s3_bucket.media_bucket.id
        },
        {
          name  = "DDB_TASK_TABLE"
          value = aws_dynamodb_table.tasks.name
        },
        {
          name  = "VIDEO_TRANSCODE_QUEUE_URL"
          value = aws_sqs_queue.video_transcode_queue.url
        },
        {
          name  = "DLQ_URL"
          value = aws_sqs_queue.dlq.url
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.video_processor_logs.name
          awslogs-region        = "ap-southeast-2"
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = {
    Name        = "Video Processor Task Definition"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

# ECS Task Definition for Image Processor
resource "aws_ecs_task_definition" "image_processor" {
  family                   = "game-media-image-processor"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "image-processor"
      image = "${aws_ecr_repository.game_media_app.repository_url}:latest"
      portMappings = [
        {
          containerPort = 8082
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "AWS_REGION"
          value = "ap-southeast-2"
        },
        {
          name  = "S3_BUCKET"
          value = aws_s3_bucket.media_bucket.id
        },
        {
          name  = "DDB_TASK_TABLE"
          value = aws_dynamodb_table.tasks.name
        },
        {
          name  = "IMAGE_PROCESS_QUEUE_URL"
          value = aws_sqs_queue.image_process_queue.url
        },
        {
          name  = "DLQ_URL"
          value = aws_sqs_queue.dlq.url
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.image_processor_logs.name
          awslogs-region        = "ap-southeast-2"
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = {
    Name        = "Image Processor Task Definition"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/ecs/game-media-api-gateway"
  retention_in_days = 7

  tags = {
    Name        = "API Gateway Logs"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_cloudwatch_log_group" "video_processor_logs" {
  name              = "/ecs/game-media-video-processor"
  retention_in_days = 7

  tags = {
    Name        = "Video Processor Logs"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_cloudwatch_log_group" "image_processor_logs" {
  name              = "/ecs/game-media-image-processor"
  retention_in_days = 7

  tags = {
    Name        = "Image Processor Logs"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

# IAM Roles for ECS
resource "aws_iam_role" "ecs_execution_role" {
  name = "game-media-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "ECS Execution Role"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task_role" {
  name = "game-media-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "ECS Task Role"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

# IAM Policy for ECS Task Role
resource "aws_iam_policy" "ecs_task_policy" {
  name        = "game-media-ecs-task-policy"
  description = "Policy for ECS tasks to access AWS services"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.media_bucket.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.videos.arn,
          aws_dynamodb_table.screenshots.arn,
          aws_dynamodb_table.tasks.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.video_transcode_queue.arn,
          aws_sqs_queue.image_process_queue.arn,
          aws_sqs_queue.dlq.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.app_secrets.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter"
        ]
        Resource = [
          aws_ssm_parameter.videos_table.arn,
          aws_ssm_parameter.screenshots_table.arn,
          aws_ssm_parameter.task_table.arn
        ]
      }
    ]
  })

  tags = {
    Name        = "ECS Task Policy"
    Environment = "production"
    Purpose     = "assessment-3"
    qut-username = "n11866632@qut.edu.au"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_role_policy" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_policy.arn
}