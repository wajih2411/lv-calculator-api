locals {
  web_dir = "${path.module}/../web"

  # Content type per file extension. Only files with these extensions are uploaded.
  site_content_types = {
    html = "text/html; charset=utf-8"
    css  = "text/css; charset=utf-8"
    js   = "text/javascript; charset=utf-8"
    svg  = "image/svg+xml"
    png  = "image/png"
    ico  = "image/x-icon"
    txt  = "text/plain; charset=utf-8"
  }

  # config.js is generated below, so a local copy (used for local testing) is never uploaded.
  site_files = setsubtract(
    fileset(local.web_dir, "**/*.{${join(",", keys(local.site_content_types))}}"),
    ["config.js"],
  )
}

# Private bucket: only CloudFront can read it (see the bucket policy below).
resource "aws_s3_bucket" "site" {
  bucket        = "${var.project_name}-site-${data.aws_caller_identity.current.account_id}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Origin Access Control: CloudFront signs its requests to S3 with SigV4.
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.project_name}-site"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "Managed-SecurityHeadersPolicy"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  comment             = "${var.project_name} website"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    origin_id                = "s3-site"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id           = "s3-site"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# Only this one distribution may read objects from the bucket.
resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontRead"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.site.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site.arn }
      }
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.site]
}

# max-age=60: changes show within a minute, so no cache invalidation is needed.
resource "aws_s3_object" "site" {
  for_each = local.site_files

  bucket        = aws_s3_bucket.site.id
  key           = each.value
  source        = "${local.web_dir}/${each.value}"
  etag          = filemd5("${local.web_dir}/${each.value}")
  content_type  = local.site_content_types[reverse(split(".", each.value))[0]]
  cache_control = "max-age=60"
}

# Tells the frontend where the API lives.
resource "aws_s3_object" "config" {
  bucket        = aws_s3_bucket.site.id
  key           = "config.js"
  content       = "window.LV_API_URL = \"${aws_apigatewayv2_stage.default.invoke_url}\";\n"
  content_type  = "text/javascript; charset=utf-8"
  cache_control = "max-age=60"
}
