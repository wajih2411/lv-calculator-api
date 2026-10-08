terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "lv-calculator-api"
      ManagedBy = "terraform-bootstrap"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = var.aws_region
}

# ---------- S3 bucket for Terraform state ----------

resource "aws_s3_bucket" "tfstate" {
  bucket = var.state_bucket_name

  # Terraform will refuse to delete this bucket - losing state is very bad.
  lifecycle {
    prevent_destroy = true
  }
}

# Keeps every version of the state file so we can roll back.
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------- GitHub Actions OIDC ----------

# Lets AWS trust identity tokens issued by GitHub Actions.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# Permissions boundary: the MAXIMUM any lv-calculator app role can ever do,
# no matter what policies get attached to it. Blocks privilege escalation.
resource "aws_iam_policy" "app_boundary" {
  name        = "lv-calculator-app-boundary"
  description = "Maximum permissions for lv-calculator application roles"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "LambdaLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/lambda/lv-calculator*"
      },
      {
        Sid      = "AppTables"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"]
        Resource = "arn:aws:dynamodb:${local.region}:${local.account_id}:table/lv-calculator-*"
      },
    ]
  })
}

# The role GitHub Actions assumes. Only this repo, only main branch.
# Named so it does NOT match "lv-calculator*", so it can't modify its own permissions.
resource "aws_iam_role" "github_deploy" {
  name = "github-actions-lv-calculator-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          # The second value is GitHub's immutable, ID-based subject (owner and repo IDs),
          # which this repo's tokens use; it survives renames.
          "token.actions.githubusercontent.com:sub" = [
            "repo:${var.github_repo}:ref:refs/heads/main",
            "repo:wajih2411@149012294/lv-calculator-api@1389740334:ref:refs/heads/main",
          ]
        }
      }
    }]
  })
}

# Least privilege: only what's needed to deploy this project's resources.
resource "aws_iam_role_policy" "github_deploy" {
  name = "lv-calculator-deploy-permissions"
  role = aws_iam_role.github_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "TerraformStateBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.tfstate.arn
      },
      {
        Sid      = "TerraformStateObjects"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.tfstate.arn}/*"
      },
      {
        Sid      = "Lambda"
        Effect   = "Allow"
        Action   = ["lambda:*"]
        Resource = "arn:aws:lambda:${local.region}:${local.account_id}:function:lv-calculator*"
      },
      {
        Sid      = "ApiGateway"
        Effect   = "Allow"
        Action   = ["apigateway:*"]
        Resource = "arn:aws:apigateway:${local.region}::/*"
      },
      {
        Sid      = "DynamoDB"
        Effect   = "Allow"
        Action   = ["dynamodb:*"]
        Resource = "arn:aws:dynamodb:${local.region}:${local.account_id}:table/lv-calculator-*"
      },
      {
        Sid      = "LogsDescribe"
        Effect   = "Allow"
        Action   = ["logs:DescribeLogGroups"]
        Resource = "*"
      },
      {
        Sid      = "LogsManage"
        Effect   = "Allow"
        Action   = ["logs:*"]
        Resource = "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/lambda/lv-calculator*"
      },
      {
        Sid      = "Alerts"
        Effect   = "Allow"
        Action   = ["sns:*"]
        Resource = "arn:aws:sns:${local.region}:${local.account_id}:lv-calculator-*"
      },
      {
        Sid      = "AlarmsManage"
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricAlarm", "cloudwatch:DeleteAlarms", "cloudwatch:TagResource", "cloudwatch:UntagResource", "cloudwatch:ListTagsForResource"]
        Resource = "arn:aws:cloudwatch:${local.region}:${local.account_id}:alarm:lv-calculator-*"
      },
      {
        Sid      = "AlarmsDescribe"
        Effect   = "Allow"
        Action   = ["cloudwatch:DescribeAlarms"]
        Resource = "*"
      },
      {
        Sid      = "AppIamRolesMustHaveBoundary"
        Effect   = "Allow"
        Action   = ["iam:CreateRole", "iam:PutRolePolicy", "iam:AttachRolePolicy"]
        Resource = "arn:aws:iam::${local.account_id}:role/lv-calculator-*"
        Condition = {
          StringEquals = { "iam:PermissionsBoundary" = aws_iam_policy.app_boundary.arn }
        }
      },
      {
        Sid    = "AppIamRolesManage"
        Effect = "Allow"
        Action = [
          "iam:GetRole", "iam:DeleteRole", "iam:UpdateRole", "iam:UpdateAssumeRolePolicy",
          "iam:TagRole", "iam:UntagRole", "iam:PassRole",
          "iam:GetRolePolicy", "iam:DeleteRolePolicy", "iam:ListRolePolicies",
          "iam:DetachRolePolicy", "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole",
        ]
        Resource = "arn:aws:iam::${local.account_id}:role/lv-calculator-*"
      },
      {
        Sid      = "SiteBucket"
        Effect   = "Allow"
        Action   = ["s3:*"]
        Resource = ["arn:aws:s3:::lv-calculator-site-*", "arn:aws:s3:::lv-calculator-site-*/*"]
      },
      {
        # CloudFront IDs are random, so distributions can't be scoped by name.
        Sid      = "CloudFront"
        Effect   = "Allow"
        Action   = ["cloudfront:*"]
        Resource = "*"
      },
    ]
  })
}
