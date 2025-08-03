#!/bin/bash

echo "🔧 Setting up EC2 instance for ImageOn deployment..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt update

# Install required packages
echo "📦 Installing required packages..."
sudo apt install -y curl wget git

# Install Node.js 20
echo "📦 Installing Node.js 20..."
if ! command -v node >/dev/null 2>&1 || [ "$(node --version | cut -d'.' -f1 | sed 's/v//')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Node.js version: $(node --version)"

# Install Docker if not present
echo "🐳 Setting up Docker..."
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get install -y docker.io
  sudo systemctl start docker
  sudo systemctl enable docker
fi

# Add ubuntu user to docker group
echo "👥 Adding ubuntu user to docker group..."
sudo usermod -aG docker ubuntu

# Install PM2 globally
echo "⚙️ Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /home/ubuntu/imageon-backend
sudo chown ubuntu:ubuntu /home/ubuntu/imageon-backend

# Create logs directory
mkdir -p /home/ubuntu/imageon-backend/logs

# Clean up any existing conflicting containers
echo "🧹 Cleaning up existing Redis containers..."
sudo docker rm -f imageon-redis 2>/dev/null || true

# Set up PM2 startup script
echo "🚀 Setting up PM2 startup..."
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo ""
echo "✅ EC2 setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Logout and login again for docker group changes to take effect"
echo "2. Test Docker access: docker ps"
echo "3. Deploy your application using GitHub Actions"
echo ""
echo "💡 To verify setup, run:"
echo "   docker --version"
echo "   node --version"
echo "   pm2 --version"
