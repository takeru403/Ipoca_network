variable "aws_region" {
  default = "ap-northeast-1"
}

variable "key_name" {
  description = "SSH key pair name"
  type        = string
}

variable "instance_type" {
  default = "t2.micro"
}

variable "ami_id" {
  description = "AMI ID for EC2"
  type        = string
}

