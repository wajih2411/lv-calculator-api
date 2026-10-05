terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Store state in S3 so GitHub Actions and my Mac share the same state.
  # use_lockfile = S3-native locking, prevents two applies at once.
  backend "s3" {
    bucket       = "wajih2411-lv-calculator-tfstate"
    key          = "lv-calculator/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "lv-calculator-api"
      ManagedBy = "terraform"
    }
  }
}
