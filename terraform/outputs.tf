output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.media_bucket.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.media_bucket.arn
}

output "videos_table_name" {
  description = "Name of the videos DynamoDB table"
  value       = aws_dynamodb_table.videos.name
}

output "screenshots_table_name" {
  description = "Name of the screenshots DynamoDB table"
  value       = aws_dynamodb_table.screenshots.name
}

output "tasks_table_name" {
  description = "Name of the tasks DynamoDB table"
  value       = aws_dynamodb_table.tasks.name
}

output "secrets_manager_secret_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "parameter_store_prefix" {
  description = "Parameter Store prefix"
  value       = "/game-media/prod"
}

# ECR Repository Outputs
output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.game_media_app.repository_url
}

# SQS Queue Outputs
output "video_transcode_queue_url" {
  description = "URL of the video transcode SQS queue"
  value       = aws_sqs_queue.video_transcode_queue.url
}

output "image_process_queue_url" {
  description = "URL of the image process SQS queue"
  value       = aws_sqs_queue.image_process_queue.url
}

output "dlq_url" {
  description = "URL of the dead letter queue"
  value       = aws_sqs_queue.dlq.url
}

# ECS Cluster Outputs
output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.game_media_cluster.name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.game_media_cluster.arn
}

# ECS Task Definition Outputs
output "api_gateway_task_definition_arn" {
  description = "ARN of the API Gateway task definition"
  value       = aws_ecs_task_definition.api_gateway.arn
}

output "video_processor_task_definition_arn" {
  description = "ARN of the Video Processor task definition"
  value       = aws_ecs_task_definition.video_processor.arn
}

output "image_processor_task_definition_arn" {
  description = "ARN of the Image Processor task definition"
  value       = aws_ecs_task_definition.image_processor.arn
}

# IAM Role ARNs
output "ecs_execution_role_arn" {
  description = "ARN of the ECS execution role"
  value       = aws_iam_role.ecs_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

# Lambda Function Outputs
output "s3_event_handler_lambda_arn" {
  description = "ARN of the S3 event handler Lambda function"
  value       = aws_lambda_function.s3_event_handler.arn
}

output "custom_scaling_metric_lambda_arn" {
  description = "ARN of the custom scaling metric Lambda function"
  value       = aws_lambda_function.custom_scaling_metric.arn
}

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_role.arn
}

# CloudWatch Event Rule Output
output "custom_scaling_event_rule_arn" {
  description = "ARN of the custom scaling CloudWatch event rule"
  value       = aws_cloudwatch_event_rule.custom_scaling.arn
}