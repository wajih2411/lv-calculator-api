resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  # Browsers may only call the API from the website. The CloudFront distribution
  # doesn't depend on the API, so there's no cycle.
  cors_configuration {
    allow_origins = ["https://${aws_cloudfront_distribution.site.domain_name}"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.calculator.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "calculate" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /calculate"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# $default stage with auto-deploy, plus throttling to prevent abuse.
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 10
    throttling_rate_limit  = 5
  }
}

# Allows API Gateway to invoke the Lambda function.
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.calculator.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_apigatewayv2_route" "history" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /history"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}
