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

