output "api_url" {
  description = "Base URL of the API"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "calculate_endpoint" {
  description = "Full URL for the calculate endpoint"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}calculate"
}

output "lambda_function_name" {
  value = aws_lambda_function.calculator.function_name
}
