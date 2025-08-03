#!/bin/bash
set -e

APP_DIR="$1"
PM2_APP_NAME="$2"
FEDERATION_DOMAIN="$3"
AWS_REGION="$4"

echo "🚀 Starting deployment..."

# Check Node.js version
echo "📋 Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

# Verify Node.js version is 20 or higher
NODE_MAJOR=$(node --version | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "⚠️ Warning: Node.js version $NODE_VERSION detected. Recommended version is 20 or higher."
  echo "Consider updating Node.js on the EC2 instance for better compatibility."
fi

# Create application directory if it doesn't exist
sudo mkdir -p "$APP_DIR"
sudo chown ubuntu:ubuntu "$APP_DIR"

# Backup current deployment (if exists)
if [ -d "$APP_DIR/current" ]; then
  echo "📦 Creating backup..."
  sudo rm -rf "$APP_DIR/backup"
  sudo mv "$APP_DIR/current" "$APP_DIR/backup"
fi

# Extract new deployment
mkdir -p "$APP_DIR/current"
cd "$APP_DIR/current"
tar -xzf /tmp/imageon-backend.tar.gz

# Install production dependencies
echo "📚 Installing dependencies..."
npm ci --only=production

# Setup environment variables
if [ ! -f ".env" ]; then
  echo "⚙️ Setting up environment file..."
  
  # Configure production environment variables
  echo "🔧 Configuring production environment..."
  cat > .env << 'ENV_VARS'
NODE_ENV=production
PORT=3000
FEDERATION_PROTOCOL=http
DYNAMODB_TABLE_NAME=imageonapp
REDIS_HOST=localhost
REDIS_PORT=6379
LOG_LEVEL=info
ACTIVITY_CACHE_TTL=3600
RATE_LIMIT_WINDOW=900
RATE_LIMIT_MAX=100
ENV_VARS
  
  # Add dynamic values
  echo "FEDERATION_DOMAIN=$FEDERATION_DOMAIN" >> .env
  echo "AWS_REGION=$AWS_REGION" >> .env
  
  echo "✅ Production environment configured"
else
  echo "⚙️ Environment file exists, updating production values..."
  # Update specific values for production
  sed -i 's/NODE_ENV=.*/NODE_ENV=production/' .env
  sed -i 's/FEDERATION_PROTOCOL=.*/FEDERATION_PROTOCOL=https/' .env
  sed -i "s/FEDERATION_DOMAIN=.*/FEDERATION_DOMAIN=$FEDERATION_DOMAIN/" .env
  sed -i "s/AWS_REGION=.*/AWS_REGION=$AWS_REGION/" .env
  sed -i 's/DYNAMODB_TABLE_NAME=.*/DYNAMODB_TABLE_NAME=imageonapp/' .env
  # Remove DYNAMO_ENDPOINT for production (use native DynamoDB)
  sed -i 's/^DYNAMO_ENDPOINT=/#DYNAMO_ENDPOINT=/' .env
fi

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2..."
  sudo npm install -g pm2
fi

# Stop existing application
echo "⏹️ Stopping existing application..."
pm2 stop "$PM2_APP_NAME" || true
pm2 delete "$PM2_APP_NAME" || true

# Start Redis if not running
echo "🔴 Starting Redis..."

# Check if Redis container exists and is running
if docker ps --format "table {{.Names}}" | grep -q "^imageon-redis$"; then
  echo "✅ Redis container is already running"
elif docker ps -a --format "table {{.Names}}" | grep -q "^imageon-redis$"; then
  echo "📦 Starting existing Redis container..."
  sudo docker start imageon-redis
else
  # Check if port 6379 is already in use
  if sudo netstat -tulpn | grep -q ":6379 "; then
    echo "⚠️ Port 6379 is already in use. Checking if it's Redis..."
    if sudo docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -q "6379"; then
      echo "✅ Another Redis container is already running on port 6379"
    else
      echo "❌ Port 6379 is occupied by another service. Please check your Redis configuration."
      exit 1
    fi
  else
    echo "🚀 Creating new Redis container..."
    sudo docker run --name imageon-redis -p 6379:6379 -d redis:7-alpine
  fi
fi

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
timeout=30
while [ $timeout -gt 0 ]; do
  if sudo docker exec imageon-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "✅ Redis is ready"
    break
  elif redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "✅ Redis is ready (external instance)"
    break
  fi
  sleep 1
  timeout=$((timeout-1))
done

if [ $timeout -eq 0 ]; then
  echo "❌ Redis failed to be ready within 30 seconds"
  exit 1
fi

# Start application with PM2
echo "🚀 Starting application..."
pm2 start server.js --name "$PM2_APP_NAME" --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "✅ Deployment completed successfully!"

# Show application status
pm2 status
pm2 logs "$PM2_APP_NAME" --lines 10
