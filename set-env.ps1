# PowerShell script to set environment variables for CAB432 project

# AWS Configuration
$env:AWS_REGION = "ap-southeast-2"
$env:AWS_DEFAULT_REGION = "ap-southeast-2"

# Cognito Configuration - 需要替换为实际的User Pool ID
$env:COGNITO_USER_POOL_ID = "ap-southeast-2_XXXXXXXXX"  # 请替换为实际的User Pool ID
$env:COGNITO_CLIENT_ID = "3496lr6poistit3vtqgh79qtrm"

# DynamoDB Tables
$env:DDB_TASK_TABLE = "game-media-tasks"
$env:DDB_VIDEOS_TABLE = "game-media-videos"
$env:DDB_SCREENSHOTS_TABLE = "game-media-screenshots"

# Fixed Username for CAB432
$env:QUT_USERNAME = "n11866632@qut.edu.au"

# Parameter Store Configuration
$env:PARAMETER_STORE_PREFIX = "/game-media/prod"
$env:PARAM_DDB_TASK_TABLE = "/game-media/prod/taskTable"
$env:PARAM_DDB_VIDEOS_TABLE = "/game-media/prod/videosTable"
$env:PARAM_DDB_SCREENSHOTS_TABLE = "/game-media/prod/screenshotsTable"

# Secrets Manager
$env:SECRETS_MANAGER_SECRET_NAME = "n11866632-demosecret"

# Server Configuration
$env:PORT = "8080"

Write-Host "Environment variables set successfully!"
Write-Host "Please update COGNITO_USER_POOL_ID with your actual User Pool ID"
Write-Host "You can find it in AWS Cognito Console -> User Pools -> Your Pool -> General Settings"
