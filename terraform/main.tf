terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # S3 backend for state 
  backend "s3" {
    bucket = "imageon-terraform-state-0529fbe1"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "random_id" "bucket" {
  byte_length = 4
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "imageon-terraform-state-${random_id.bucket.hex}"
}



# Block public access
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_default_vpc" "default_vpc" {
  tags = {
    Name = "default_vpc"
  }
}

# Create a key pair for SSH access
resource "tls_private_key" "main" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "main" {
  key_name   = "imageon-key"
  public_key = tls_private_key.main.public_key_openssh
}

# DynamoDB Table for Imageon
resource "aws_dynamodb_table" "imageon_table" {
  name           = "imageon-app"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # Global Secondary Index 1 - Username lookups, user posts
  global_secondary_index {
    name     = "GSI1"
    hash_key = "GSI1PK"
    range_key = "GSI1SK"
    projection_type = "ALL"
  }

  # Global Secondary Index 2 - Timeline, feed generation
  global_secondary_index {
    name     = "GSI2"
    hash_key = "GSI2PK"
    range_key = "GSI2SK"
    projection_type = "ALL"
  }

  # Enable point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name        = "imageon-dynamodb"
    Environment = "development"
    Project     = "imageon"
  }
}

# IAM Role for EC2 to access DynamoDB
resource "aws_iam_role" "ec2_dynamodb_role" {
  name = "imageon-ec2-dynamodb-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "imageon-ec2-role"
  }
}

# IAM Policy for DynamoDB access
resource "aws_iam_role_policy" "ec2_dynamodb_policy" {
  name = "imageon-dynamodb-policy"
  role = aws_iam_role.ec2_dynamodb_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.imageon_table.arn,
          "${aws_dynamodb_table.imageon_table.arn}/index/*"
        ]
      }
    ]
  })
}

# Instance Profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "imageon-ec2-profile"
  role = aws_iam_role.ec2_dynamodb_role.name
}

data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }

  owners = ["099720109477"]
}

# Backend EC2 Instance
resource "aws_instance" "backend" {
  ami           = data.aws_ami.ubuntu.id # Ubuntu 22.04 LTS
  instance_type = "t3.micro"
  key_name      = aws_key_pair.main.key_name
  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name
  associate_public_ip_address = true
  # Allow all traffic (no security for now as requested)
  vpc_security_group_ids = [aws_security_group.allow_all.id]

  # Simple setup script
  user_data = <<-EOF
    #!/bin/bash
    sudo apt-get update -y
    
    # Install Docker
    sudo apt-get install -y docker.io docker-compose
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Install Node.js
    sudo curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    sudo apt-get install -y nodejs
    sudo npm install -g pm2
    
    # Create simple docker-compose for Redis only
    mkdir -p /home/ubuntu/services
    sudo cat > /home/ubuntu/services/docker-compose.yml << 'COMPOSE_EOF'
version: '3'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  redis_data:
COMPOSE_EOF
    
    # Start Redis
    cd /home/ubuntu/services
    docker-compose up -d
    
    echo "Imageon backend setup complete!" > /var/log/setup.log
  EOF

  tags = {
    Name = "imageon-backend"
    Type = "backend"
  }
}

# Frontend EC2 Instance
resource "aws_instance" "frontend" {
  ami           = "ami-0c02fb55956c7d316" # Ubuntu 22.04 LTS
  instance_type = "t3.small"
  key_name      = aws_key_pair.main.key_name

  # Allow all traffic (no security for now as requested)
  vpc_security_group_ids = [aws_security_group.allow_all.id]

  # Simple setup script
  user_data = <<-EOF
    #!/bin/bash
    apt-get update -y
    
    # Install Node.js
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    echo "Imageon frontend setup complete!" > /var/log/setup.log
  EOF

  tags = {
    Name = "imageon-frontend"
    Type = "frontend"
  }
}

# Security Group - Allow everything (as requested)
resource "aws_security_group" "allow_all" {
  name        = "imageon-allow-all"
  description = "Allow all traffic - development only"
  vpc_id      = aws_default_vpc.default_vpc.id  


  # Allow all inbound traffic
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "imageon-allow-all"
  }
}

# Outputs - What you need to know after deployment
output "backend_ip" {
  description = "Backend server public IP"
  value       = aws_instance.backend.public_ip
}

output "frontend_ip" {
  description = "Frontend server public IP"
  value       = aws_instance.frontend.public_ip
}

output "terraform_state_id" {
  description = "S3 bucket id for terraform state"
  value = aws_s3_bucket.terraform_state.id
}

output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.imageon_table.name
}

output "ssh_private_key" {
  description = "SSH private key to connect to servers"
  value       = tls_private_key.main.private_key_pem
  sensitive   = true
}

output "connection_info" {
  description = "How to connect to your servers"
  value = {
    backend_ssh       = "ssh -i imageon-key.pem ubuntu@${aws_instance.backend.public_ip}"
    frontend_ssh      = "ssh -i imageon-key.pem ubuntu@${aws_instance.frontend.public_ip}"
    api_url          = "http://${aws_instance.backend.public_ip}:3000"
    redis_url        = "${aws_instance.backend.public_ip}:6379"
    dynamodb_table   = aws_dynamodb_table.imageon_table.name
    aws_region       = "us-east-1"
  }
}
