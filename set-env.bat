@echo off
REM Batch script to set environment variables for CAB432 project

REM AWS Configuration
set AWS_REGION=ap-southeast-2
set AWS_DEFAULT_REGION=ap-southeast-2

REM Cognito Configuration - 需要替换为实际的User Pool ID
set COGNITO_USER_POOL_ID=ap-southeast-2_XXXXXXXXX
set COGNITO_CLIENT_ID=3496lr6poistit3vtqgh79qtrm

REM DynamoDB Tables
set DDB_TASK_TABLE=game-media-tasks
set DDB_VIDEOS_TABLE=game-media-videos
set DDB_SCREENSHOTS_TABLE=game-media-screenshots

REM Fixed Username for CAB432
set QUT_USERNAME=n11866632@qut.edu.au

REM Parameter Store Configuration
set PARAMETER_STORE_PREFIX=/game-media/prod
set PARAM_DDB_TASK_TABLE=/game-media/prod/taskTable
set PARAM_DDB_VIDEOS_TABLE=/game-media/prod/videosTable
set PARAM_DDB_SCREENSHOTS_TABLE=/game-media/prod/screenshotsTable

REM Secrets Manager
set SECRETS_MANAGER_SECRET_NAME=n11866632-demosecret

REM Server Configuration
set PORT=8080

echo Environment variables set successfully!
echo Please update COGNITO_USER_POOL_ID with your actual User Pool ID
echo You can find it in AWS Cognito Console -^> User Pools -^> Your Pool -^> General Settings
