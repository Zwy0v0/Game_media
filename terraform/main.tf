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
