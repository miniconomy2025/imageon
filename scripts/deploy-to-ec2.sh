#!/bin/bash
set -e

APP_DIR="$1"
PM2_APP_NAME="$2"
FEDERATION_DOMAIN="$3"
AWS_REGION="$4"

echo "🚀 Starting deployment..."

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
  cp .env.example .env 2>/dev/null || touch .env
  
  # Configure production environment variables
  echo "🔧 Configuring production environment..."
  cat > .env << 'ENV_VARS'
NODE_ENV=production
PORT=3000
FEDERATION_PROTOCOL=https
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
sudo docker start imageon-redis || sudo docker run --name imageon-redis -p 6379:6379 -d redis:7-alpine

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
