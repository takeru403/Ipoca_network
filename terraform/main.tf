# ----------------------------
# VPC
# ----------------------------
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"

  tags = {
    Name = "flask_vpc"
  }
}

# ----------------------------
# Internet Gateway
# ----------------------------
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "flask_igw"
  }
}

# ----------------------------
# Subnet（パブリック）
# ----------------------------
resource "aws_subnet" "public_subnet" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "flask_subnet"
  }
}

# ----------------------------
# Route Table（外部アクセス用）
# ----------------------------
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "flask_rt"
  }
}

# ルートテーブルとサブネットの関連付け
resource "aws_route_table_association" "a" {
  subnet_id      = aws_subnet.public_subnet.id
  route_table_id = aws_route_table.public_rt.id
}

# ----------------------------
# Security Group（HTTP & SSH）
# ----------------------------
resource "aws_security_group" "flask_sg" {
  name   = "flask_sg"
  vpc_id = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "Flask App Port 5000"
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "flask_sg"
  }
}

# ----------------------------
# EC2 Instance（Flask App）
# ----------------------------
resource "aws_instance" "flask_app" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public_subnet.id
  vpc_security_group_ids = [aws_security_group.flask_sg.id]
  key_name               = var.key_name

  # 起動時に Flask アプリをインストール＆起動
  user_data = file("${path.module}/user_data.sh")

  tags = {
    Name = "flask_app"
  }
}

# ----------------------------
# Elastic IP の割り当て（固定IP）
# ----------------------------
resource "aws_eip" "flask_eip" {
  instance = aws_instance.flask_app.id
  domain   = "vpc"

  tags = {
    Name = "flask_eip"
  }
}

# SNSトピックとサブスクリプション
resource "aws_sns_topic" "alert_topic" {
  name = "ec2-alert-topic"
}

resource "aws_sns_topic_subscription" "alert_email" {
  topic_arn = aws_sns_topic.alert_topic.arn
  protocol  = "email"
  endpoint  = "tuwujian0@gmail.com"
}

# CPU使用率アラーム
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "HighCPUUtilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "EC2のCPU使用率が80%を超えました"
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.alert_topic.arn]
  ok_actions          = [aws_sns_topic.alert_topic.arn]
  dimensions = {
    InstanceId = aws_instance.flask_app.id
  }
}

# メモリ使用率アラーム（CloudWatch Agentでカスタムメトリクス送信が必要）
resource "aws_cloudwatch_metric_alarm" "high_mem" {
  alarm_name          = "HighMemoryUtilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "mem_used_percent"
  namespace           = "CWAgent"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "EC2のメモリ使用率が80%を超えました"
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.alert_topic.arn]
  ok_actions          = [aws_sns_topic.alert_topic.arn]
  dimensions = {
    InstanceId = aws_instance.flask_app.id
  }
}

# S3バケット（Reactビルド成果物用）
resource "aws_s3_bucket" "frontend" {
  bucket = "asushiru-pos-frontend"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  block_public_acls   = true
  block_public_policy = true
  ignore_public_acls  = true
  restrict_public_buckets = true
}

# ACM証明書（us-east-1、CloudFront用）
provider "aws" {
  alias  = "virginia"
  region = "us-east-1"
}

resource "aws_acm_certificate" "cert" {
  provider          = aws.virginia
  domain_name       = "asushiru-pos.com"
  validation_method = "DNS"
}

# CloudFrontディストリビューション
resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3Origin"
  }
  enabled = true
  default_root_object = "index.html"
  aliases = ["asushiru-pos.com"]
  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.cert.arn
    ssl_support_method  = "sni-only"
  }
  # SPA 404対策
  custom_error_response {
    error_code = 404
    response_code = 200
    response_page_path = "/index.html"
  }
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"
    viewer_protocol_policy = "redirect-to-https"
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

# Route53 Aレコード（CloudFrontエイリアス）
resource "aws_route53_record" "cloudfront" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "asushiru-pos.com"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.cdn.domain_name
    zone_id                = aws_cloudfront_distribution.cdn.hosted_zone_id
    evaluate_target_health = false
  }
}

# Lambda（Flask, OpenAI API呼び出し用）
# Lambda本体はZappaやServerless Frameworkでデプロイする前提
resource "aws_lambda_function" "flask_api" {
  function_name = "flask-api"
  s3_bucket     = aws_s3_bucket.lambda.id
  s3_key        = "flask-api.zip"       # Lambdaデプロイ用zipファイル
  handler       = "app.handler"         # Zappa/Serverless Frameworkで自動生成されるハンドラ名
  runtime       = "python3.11"
  memory_size   = 1024
  timeout       = 30
  role          = aws_iam_role.lambda_exec.arn
}

resource "aws_iam_role" "lambda_exec" {
  name = "lambda_exec_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "api" {
  name        = "asushiru-pos-api"
  description = "API Gateway for Flask Lambda"
}

# /prod/api パス
resource "aws_api_gateway_resource" "api_resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "prod"
}
resource "aws_api_gateway_resource" "api_sub" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.api_resource.id
  path_part   = "api"
}

# /prod/api/{proxy+} で全てのAPIリクエストをLambdaに転送
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.api_sub.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
  request_parameters = {
    "method.request.path.proxy" = true
  }
}

resource "aws_api_gateway_integration" "lambda_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.flask_api.invoke_arn
}

# CORS対応（OPTIONSメソッド追加）
resource "aws_api_gateway_method" "options_method" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.options_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.options_method.http_method
  status_code = "200"
  response_models = {
    "application/json" = "Empty"
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.options_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  response_templates = {
    "application/json" = ""
  }
  depends_on = [aws_api_gateway_integration.options_integration, aws_api_gateway_method_response.options_response]
}

# LambdaにAPI Gatewayからのinvoke権限を付与
resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.flask_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# API Gatewayデプロイ
resource "aws_api_gateway_deployment" "api_deploy" {
  depends_on = [aws_api_gateway_integration.lambda_integration]
  rest_api_id = aws_api_gateway_rest_api.api.id
}

resource "aws_api_gateway_stage" "prod" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  deployment_id = aws_api_gateway_deployment.api_deploy.id
  stage_name    = "prod"
}

# Route53 ホストゾーン
resource "aws_route53_zone" "main" {
  name = "asushiru-pos.com"
}

# Lambdaデプロイ用S3バケット
resource "aws_s3_bucket" "lambda" {
  bucket = "asushiru-pos-lambda"
  force_destroy = true
}

