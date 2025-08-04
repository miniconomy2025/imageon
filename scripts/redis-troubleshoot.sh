#!/bin/bash

echo "🔍 Redis Troubleshooting Script"
echo "================================"

# Check if Redis is running on port 6379
echo "1. Checking port 6379..."
if command -v ss >/dev/null 2>&1; then
  if ss -tulpn | grep -q ":6379 "; then
    echo "✅ Port 6379 is in use"
    ss -tulpn | grep ":6379 "
  else
    echo "❌ Port 6379 is not in use"
  fi
elif command -v netstat >/dev/null 2>&1; then
  if netstat -tulpn | grep -q ":6379 "; then
    echo "✅ Port 6379 is in use"
    netstat -tulpn | grep ":6379 "
  else
    echo "❌ Port 6379 is not in use"
  fi
else
  echo "⚠️ Neither ss nor netstat available, cannot check port usage"
fi

echo ""

# Check Docker containers
echo "2. Checking Docker containers..."
echo "All containers:"
sudo docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Redis-related containers:"
sudo docker ps -a --filter "name=redis" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""

# Test Redis connectivity
echo "3. Testing Redis connectivity..."

# Try connecting to imageon-redis container
if sudo docker exec imageon-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
  echo "✅ imageon-redis container is responding"
else
  echo "❌ imageon-redis container is not responding"
fi

# Try connecting to Redis on localhost
if redis-cli ping 2>/dev/null | grep -q "PONG"; then
  echo "✅ Redis on localhost:6379 is responding"
else
  echo "❌ Redis on localhost:6379 is not responding"
fi

echo ""

# Provide recommendations
echo "4. Recommendations:"

if sudo docker ps --format "table {{.Names}}" | grep -q "^imageon-redis$"; then
  echo "✅ imageon-redis is running properly"
elif sudo docker ps -a --format "table {{.Names}}" | grep -q "^imageon-redis$"; then
  echo "🔧 imageon-redis exists but is stopped. Run: sudo docker start imageon-redis"
else
  if sudo netstat -tulpn | grep -q ":6379 "; then
    echo "⚠️ Port 6379 is occupied by another service"
    echo "   Options:"
    echo "   1. Stop the other service: sudo systemctl stop redis-server"
    echo "   2. Remove conflicting containers: sudo docker rm -f \$(sudo docker ps -aq --filter 'publish=6379')"
    echo "   3. Use a different port in your configuration"
  else
    echo "🚀 Create new Redis container: sudo docker run --name imageon-redis -p 6379:6379 -d redis:7-alpine"
  fi
fi

echo ""

# Show cleanup commands
echo "5. Cleanup commands (if needed):"
echo "Remove all stopped containers: sudo docker container prune -f"
echo "Remove imageon-redis specifically: sudo docker rm -f imageon-redis"
echo "Remove all Redis containers: sudo docker rm -f \$(sudo docker ps -aq --filter 'ancestor=redis')"
echo "Kill process on port 6379: sudo lsof -ti:6379 | xargs sudo kill -9"
