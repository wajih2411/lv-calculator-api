variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "github_repo" {
  description = "GitHub repo allowed to deploy, as owner/name"
  type        = string
  default     = "wajih2411/lv-calculator-api"
}

variable "state_bucket_name" {
  description = "S3 bucket names are global across all AWS accounts, so this must be unique"
  type        = string
  default     = "wajih2411-lv-calculator-tfstate"
}
