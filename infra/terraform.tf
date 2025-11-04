terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# EC2 needs an operating system (aws ubuntu)
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

# security group
data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "web_sg" {
  name        = "hanna-sg"
  description = "Allow API and SSH"
  vpc_id      = data.aws_vpc.default.id

  ingress {
      description = "API port"
      from_port   = 4241
      to_port     = 4241
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
      ipv6_cidr_blocks = []
      prefix_list_ids  = []
      security_groups  = []
      self             = false
      }
  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = []
    prefix_list_ids  = []
    security_groups  = []
    self             = false
  }
  egress {
    description      = "Allow all outbound traffic"
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = []
    prefix_list_ids  = []
    security_groups  = []
    self             = false
  }
}

resource "aws_instance" "web_app_server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
  vpc_security_group_ids = [aws_security_group.web_sg.id]
  key_name               = var.key_name
  user_data              = file("${path.module}/user_data.sh")
  associate_public_ip_address = true

  tags = {
    Name = "hannas_website"
  }
}

# S3 bucket for storage (in my case - photo)
module "photo_bucket" {
  source = "terraform-aws-modules/s3-bucket/aws"

  bucket = "hannas-photo-bucket"
  acl    = "private"

  control_object_ownership = true
  object_ownership         = "ObjectWriter"

  versioning = {
    enabled = true
  }
}

# Photo upload
resource "null_resource" "upload_photo" {
  depends_on = [module.photo_bucket]

  provisioner "local-exec" {
    command = "aws s3 cp ../assets/profile.jpg s3://${module.photo_bucket.s3_bucket_id}/profile.jpg --region ${var.region}"
  }
}

# S3 bucket - hosting frontent as static website
resource "aws_s3_bucket" "frontend" {
  bucket = "hannas-frontend-bucket"

  versioning {
    enabled = true
  }

  tags = {
    Name = "hannas_frontend_bucket"
  }
  website {
  index_document = "index.html"
  error_document = "index.html"
  } 
}

# --- Allow CloudFront to read from this bucket ---
resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "Access Identity for CloudFront to S3"
}

# --- S3 Bucket Policy: only CloudFront can read ---
resource "aws_s3_bucket_policy" "frontend_policy" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly",
        Effect    = "Allow",
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.oai.iam_arn
        },
        Action    = "s3:GetObject",
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}

# --- CloudFront distribution serving the bucket ---
resource "aws_cloudfront_distribution" "frontend_cdn" {
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "frontend-s3"
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  enabled             = true
  default_root_object = "index.html"

  default_cache_behavior {
    target_origin_id       = "frontend-s3"
    viewer_protocol_policy = "redirect-to-https"

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  price_class = "PriceClass_100" # (lowest-cost regions)

  tags = {
    Name = "hannas_frontend_cloudfront"
  }
}

output "backend_public_ip" {
  description = "Public IP address of the backend EC2 instance"
  value       = aws_instance.web_app_server.public_ip
}

output "backend_url" {
  description = "Backend API URL"
  value       = "http://${aws_instance.web_app_server.public_ip}:4241"
}

output "frontend_website_url" {
  description = "Frontend CloudFront distribution URL"
  value       = "https://${aws_cloudfront_distribution.frontend_cdn.domain_name}"
}