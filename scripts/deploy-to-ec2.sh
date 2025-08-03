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
if pm2 list | grep -q "$PM2_APP_NAME"; then
  echo "Stopping PM2 process: $PM2_APP_NAME"
  pm2 stop "$PM2_APP_NAME" || true
  pm2 delete "$PM2_APP_NAME" || true
else
  echo "No existing PM2 process found for: $PM2_APP_NAME"
fi

# Start Redis if not running
echo "🔴 Starting Redis..."

# Check if Redis container exists and is running
if sudo docker ps --format "table {{.Names}}" | grep -q "^imageon-redis$"; then
  echo "✅ Redis container is already running"
elif sudo docker ps -a --format "table {{.Names}}" | grep -q "^imageon-redis$"; then
  echo "📦 Starting existing Redis container..."
  sudo docker start imageon-redis
else
  # Check if port 6379 is already in use (using ss instead of netstat)
  if command -v ss >/dev/null 2>&1; then
    if ss -tulpn | grep -q ":6379 "; then
      echo "⚠️ Port 6379 is already in use. Removing conflicting containers..."
      # Remove any containers using port 6379
      sudo docker ps -a --filter "publish=6379" --format "{{.Names}}" | xargs -r sudo docker rm -f
      # Also remove imageon-redis if it exists but is conflicted
      sudo docker rm -f imageon-redis 2>/dev/null || true
    fi
  else
    echo "⚠️ Cannot check port usage (ss/netstat not available). Removing any existing imageon-redis container..."
    sudo docker rm -f imageon-redis 2>/dev/null || true
  fi
  
  echo "🚀 Creating new Redis container..."
  sudo docker run --name imageon-redis -p 6379:6379 -d redis:7-alpine
fi

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
timeout=30
while [ $timeout -gt 0 ]; do
  if sudo docker exec imageon-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "✅ Redis is ready"
    break
  elif command -v redis-cli >/dev/null 2>&1 && redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "✅ Redis is ready (external instance)"
    break
  fi
  sleep 1
  timeout=$((timeout-1))
done

if [ $timeout -eq 0 ]; then
  echo "❌ Redis failed to be ready within 30 seconds"
  # Show Redis container status for debugging
  echo "Redis container status:"
  sudo docker ps -a --filter "name=imageon-redis" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  exit 1
fi

# Start application with PM2
echo "🚀 Starting application..."
if [ -f "ecosystem.config.cjs" ]; then
  echo "Using ecosystem.config.cjs for PM2 configuration"
  pm2 start ecosystem.config.cjs --env production
elif [ -f "ecosystem.config.js" ]; then
  echo "Using ecosystem.config.js for PM2 configuration"
  pm2 start ecosystem.config.js --env production
else
  echo "Using direct PM2 start"
  pm2 start src/server.js --name "$PM2_APP_NAME" --env production
fi

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
echo "🔧 Setting up PM2 startup script..."
PM2_PATH=$(which pm2)
if [ -n "$PM2_PATH" ]; then
  sudo env PATH=$PATH:$(dirname $PM2_PATH) $PM2_PATH startup systemd -u ubuntu --hp /home/ubuntu || echo "⚠️ PM2 startup script setup failed, but application is running"
else
  echo "⚠️ PM2 path not found, skipping startup script setup"
fi

echo "✅ Deployment completed successfully!"

# Show application status
pm2 status
pm2 logs "$PM2_APP_NAME" --lines 10
