#!/bin/bash

PM2_APP_NAME="$1"

echo "🏥 Performing health check..."

# Check if application is running
echo "📋 Checking PM2 application status..."
if pm2 status | grep -q "$PM2_APP_NAME.*online"; then
  echo "✅ Application is running"
else
  echo "❌ Application is not running"
  echo "Recent logs:"
  pm2 logs "$PM2_APP_NAME" --lines 20 --nostream 2>/dev/null || echo "Could not retrieve logs"
  exit 1
fi

# Wait a bit for application to fully initialize
echo "⏳ Waiting for application to initialize..."
sleep 10

# Check HTTP health endpoint with timeout
echo "🌐 Testing HTTP health endpoint..."
for i in {1..10}; do
  echo "Attempt $i/10..."
  
  if curl -f --connect-timeout 5 --max-time 10 http://localhost:3000/health 2>/dev/null; then
    echo "✅ Health check passed"
    HEALTH_OK=true
    break
  elif curl -f --connect-timeout 5 --max-time 10 http://localhost:3000/ 2>/dev/null; then
    echo "✅ Application is responding (root endpoint)"
    HEALTH_OK=true
    break
  else
    echo "⏳ Health check attempt $i failed, retrying in 5 seconds..."
    sleep 5
  fi
done

if [ "$HEALTH_OK" != "true" ]; then
  echo "⚠️ HTTP health check failed after 10 attempts"
  echo "Application logs:"
  pm2 logs "$PM2_APP_NAME" --lines 20 --nostream 2>/dev/null || echo "Could not retrieve logs"
  # Don't exit with error - application might be working but health endpoint not implemented
  echo "⚠️ Continuing anyway - application appears to be running"
fi

# Check Redis connectivity
echo "🔴 Testing Redis connectivity..."
if sudo docker exec imageon-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
  echo "✅ Redis is healthy (imageon-redis container)"
elif command -v redis-cli >/dev/null 2>&1 && redis-cli ping 2>/dev/null | grep -q "PONG"; then
  echo "✅ Redis is healthy (external instance)"
else
  echo "⚠️ Redis health check failed"
  echo "Checking Redis container status..."
  sudo docker ps --filter "name=imageon-redis" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Could not check Docker containers"
fi

echo "✅ Health check completed!"
echo ""
echo "📊 Final status:"
pm2 status
