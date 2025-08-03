#!/bin/bash

PM2_APP_NAME="$1"

echo "🏥 Performing health check..."

# Check if application is running
if pm2 status | grep -q "$PM2_APP_NAME.*online"; then
  echo "✅ Application is running"
else
  echo "❌ Application is not running"
  pm2 logs "$PM2_APP_NAME" --lines 20
  exit 1
fi

# Check HTTP health endpoint
sleep 5
if curl -f http://localhost:3000/health 2>/dev/null; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed"
  pm2 logs "$PM2_APP_NAME" --lines 20
  exit 1
fi

# Check Redis connectivity
if docker exec imageon-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
  echo "✅ Redis is healthy"
else
  echo "⚠️ Redis health check failed"
fi

echo "✅ All health checks passed!"
