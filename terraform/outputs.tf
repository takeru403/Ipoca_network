output "ec2_public_ip" {
  value       = aws_eip.flask_eip.public_ip
  description = "Public IP of the EC2 instance"
}

