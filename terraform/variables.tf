variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "qut_username" {
  description = "QUT username"
  type        = string
  default     = "n11866632@qut.edu.au"
}

variable "bucket_name" {
  description = "S3 bucket name"
  type        = string
  default     = "n11866632-a2"
}

variable "table_prefix" {
  description = "DynamoDB table prefix"
  type        = string
  default     = "game-media"
}
