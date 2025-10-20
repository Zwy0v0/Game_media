#!/bin/bash

# Lambda Deployment Script for Game Media Application
# This script packages and deploys Lambda functions

set -e

echo "=== Lambda Deployment Script ==="
echo "Packaging and deploying Lambda functions..."

# Create lambda directory if it doesn't exist
mkdir -p lambda

# Install dependencies for Lambda functions
echo "Installing Lambda dependencies..."
cd lambda
npm install

# Create deployment packages
echo "Creating deployment packages..."

# Package S3 Event Handler
echo "Packaging S3 Event Handler..."
zip -r s3-event-handler.zip s3-event-handler.js node_modules/

# Package Custom Scaling Metric
echo "Packaging Custom Scaling Metric..."
zip -r custom-scaling-metric.zip custom-scaling-metric.js node_modules/

echo "Lambda packages created successfully!"
echo "Files created:"
echo "  - lambda/s3-event-handler.zip"
echo "  - lambda/custom-scaling-metric.zip"

echo ""
echo "Next steps:"
echo "1. Run 'terraform plan' to review changes"
echo "2. Run 'terraform apply' to deploy Lambda functions"
echo "3. Test Lambda functions in AWS Console"
echo ""
echo "Lambda functions will be deployed with the following features:"
echo "  - S3 Event Handler: Processes file uploads and sends to SQS queues"
echo "  - Custom Scaling Metric: Monitors SQS queue depth and publishes metrics"
echo "  - CloudWatch Events: Triggers custom scaling every minute"
echo ""
echo "=== Deployment Script Complete ==="


