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
