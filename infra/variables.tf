variable "region" {
  description = "AWS region for deployment"
  type        = string
  default     = "eu-north-1"
}

variable "photo_bucket" {
  description = "Name of the S3 bucket for profile photo"
  type        = string
  default     = "hannas-web-bucket"
}

variable "photo_key" {
  description = "Key (filename) of the photo in S3"
  type        = string
  default     = "profile.jpg"
}

variable "key_name" {
  description = "Name of existing EC2 key pair for SSH"
  type        = string
  default     = "hannas-key"
}

variable "port" {
  description = "Backend port"
  type        = number
  default     = 4241
}
