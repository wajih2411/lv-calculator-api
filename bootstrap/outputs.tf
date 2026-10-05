output "deploy_role_arn" {
  description = "Paste this into GitHub as the AWS_ROLE_ARN secret"
  value       = aws_iam_role.github_deploy.arn
}

output "state_bucket_name" {
  value = aws_s3_bucket.tfstate.id
}

output "app_boundary_arn" {
  value = aws_iam_policy.app_boundary.arn
}
