variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name used for the Lambda function and related resources"
  type        = string
  default     = "lv-calculator"
}

variable "alert_email" {
  description = "Email address that receives CloudWatch alarm notifications"
  type        = string
  sensitive   = true
}
