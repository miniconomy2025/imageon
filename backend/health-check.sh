#!/bin/bash

# Health check script for ImageOn Backend
# Returns 0 if healthy, 1 if unhealthy

echo "🏥 Performing health check..."

# Check if PM2 process is running
if ! pm2 describe imageon-backend > /dev/null 2>&1; then
    echo "❌ PM2 process not found"
    exit 1
fi

# Check if process is online
if ! pm2 status | grep -q "imageon-backend.*online"; then
    echo "❌ Application is not online"
    pm2 status
    exit 1
fi

# Check HTTP health endpoint
if ! curl -f -s http://localhost:3000/health > /dev/null; then
    echo "❌ HTTP health check failed"
    exit 1
fi

# Check Redis connectivity
if ! docker exec imageon-redis redis-cli ping | grep -q "PONG"; then
    echo "⚠️ Redis health check failed"
    exit 1
fi

echo "✅ All health checks passed"
exit 0
