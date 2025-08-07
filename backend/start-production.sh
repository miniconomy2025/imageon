#!/bin/bash

# Production startup script for ImageOn Backend
# This script ensures all dependencies are running and starts the application

set -e

echo "🚀 Starting ImageOn Backend in production mode..."

# Change to application directory
cd /home/ubuntu/imageon-backend

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found! Please copy .env.production to .env and configure it."
    exit 1
fi

# Source environment variables
set -o allexport
source .env
set +o allexport

# Ensure Redis is running
echo "🔴 Ensuring Redis is running..."
if ! docker ps | grep -q imageon-redis; then
    echo "Starting Redis container..."
    docker run --name imageon-redis -p 6379:6379 -d redis:7-alpine || \
    docker start imageon-redis
else
    echo "✅ Redis is already running"
fi

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
timeout=30
while [ $timeout -gt 0 ]; do
    if docker exec imageon-redis redis-cli ping | grep -q "PONG"; then
        echo "✅ Redis is ready"
        break
    fi
    sleep 1
    timeout=$((timeout-1))
done

if [ $timeout -eq 0 ]; then
    echo "❌ Redis failed to start within 30 seconds"
    exit 1
fi

# Check DynamoDB connectivity (for native AWS DynamoDB)
echo "🗄️ Checking DynamoDB connectivity..."
if [ -n "$AWS_REGION" ] && [ -z "$DYNAMODB_ENDPOINT" ]; then
    echo "✅ Using native AWS DynamoDB in region: ${AWS_REGION}"
    echo "📋 Table: ${DYNAMODB_TABLE_NAME:-imageonapp}"
    # Note: DynamoDB connectivity will be verified when the application starts
elif [ -n "$DYNAMODB_ENDPOINT" ]; then
    echo "🏠 Using local DynamoDB at: ${DYNAMODB_ENDPOINT}"
else
    echo "⚠️ DynamoDB configuration not found. Please check your environment variables."
fi

# Create logs directory
mkdir -p logs

# Start application with PM2
echo "🚀 Starting application with PM2..."
if pm2 describe imageon-backend > /dev/null 2>&1; then
    echo "Restarting existing application..."
    pm2 restart imageon-backend
else
    echo "Starting new application..."
    pm2 start ecosystem.config.cjs --env production
fi

# Save PM2 process list
pm2 save

echo "✅ Application started successfully!"

# Show status
pm2 status
echo ""
echo "📊 Application logs (last 10 lines):"
pm2 logs imageon-backend --lines 10 --nostream

echo ""
echo "🌐 Application should be available at: http://localhost:${PORT:-3000}"
echo "🏥 Health check: http://localhost:${PORT:-3000}/health"
