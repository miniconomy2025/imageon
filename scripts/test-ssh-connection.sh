#!/bin/bash

# Test script to verify SSH connection and commands don't hang
# This script mimics the GitHub Actions workflow commands

set -e

echo "🧪 Testing SSH connection and commands..."

if [ -z "$EC2_HOST" ]; then
    echo "❌ Please set EC2_HOST environment variable"
    exit 1
fi

if [ -z "$EC2_PRIVATE_KEY_PATH" ]; then
    echo "❌ Please set EC2_PRIVATE_KEY_PATH environment variable"
    exit 1
fi

echo "📡 Testing basic SSH connection..."
ssh -i "$EC2_PRIVATE_KEY_PATH" \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o ConnectTimeout=30 \
    ubuntu@"$EC2_HOST" \
    "echo 'SSH connection successful'; uptime; exit 0"

echo "🔧 Testing PM2 status command..."
ssh -i "$EC2_PRIVATE_KEY_PATH" \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o ConnectTimeout=30 \
    ubuntu@"$EC2_HOST" \
    "timeout 10 pm2 status; echo 'PM2 status check completed'"

echo "📝 Testing PM2 logs command (non-streaming)..."
ssh -i "$EC2_PRIVATE_KEY_PATH" \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o ConnectTimeout=30 \
    ubuntu@"$EC2_HOST" \
    "timeout 10 pm2 logs --lines 5 --nostream; echo 'PM2 logs check completed'"

echo "🏥 Testing health check script..."
ssh -i "$EC2_PRIVATE_KEY_PATH" \
    -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o ConnectTimeout=30 \
    ubuntu@"$EC2_HOST" \
    "if [ -f /tmp/health-check.sh ]; then timeout 60 /tmp/health-check.sh imageon-backend; else echo 'Health check script not found'; fi"

echo "✅ All SSH tests completed successfully!"
