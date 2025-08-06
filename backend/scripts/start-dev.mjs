#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🚀 Starting ImageOn development environment...\n');

try {
  // Start DynamoDB
  console.log('📊 Starting DynamoDB Local...');
  execSync('docker-compose -f ../databases/docker-compose.yml up -d', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });

  // Start Redis
  console.log('🔴 Starting Redis...');
  try {
    // Stop existing Redis container if it exists
    // Use /dev/null for cross-platform compatibility; suppress errors if the container doesn't exist.
    execSync('docker stop imageon-redis 2>/dev/null || true', { stdio: 'pipe' });
    execSync('docker rm imageon-redis 2>/dev/null || true', { stdio: 'pipe' });
  } catch (e) {
    // Ignore errors - container might not exist
  }
  
  execSync('docker run --name imageon-redis -p 6379:6379 -d redis:7-alpine', { 
    stdio: 'inherit' 
  });

  // Wait for services to start
  console.log('⏳ Waiting for services to initialize...');
  await setTimeout(3000);

  // Check if services are running
  console.log('🔍 Checking service status...');
  try {
    execSync('docker ps --filter "name=dynamodb-local" --filter "name=imageon-redis" --format "table {{.Names}}\\t{{.Status}}"', { 
      stdio: 'inherit' 
    });
  } catch (e) {
    console.log('Warning: Could not check service status');
  }

  console.log('\n✅ Services started successfully!');
  console.log('📊 DynamoDB Local: http://localhost:8000');
  console.log('� DynamoDB Admin UI: Run `npm run db:admin` in another terminal');
  console.log('�🔴 Redis: localhost:6379');
  console.log('🌐 Federation Server will start on: http://localhost:3000');
  console.log('\n🚀 Starting development server...\n');

  // Start the development server
  const devServer = spawn('npm', ['run', 'dev'], { 
    stdio: 'inherit',
    shell: true 
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down services...');
    devServer.kill();
    
    try {
      execSync('docker-compose -f ../databases/docker-compose.yml down', { stdio: 'inherit' });
      execSync('docker stop imageon-redis && docker rm imageon-redis', { stdio: 'inherit' });
    } catch (e) {
      console.log('Warning: Error stopping services');
    }
    
    console.log('👋 Goodbye!');
    process.exit();
  });

  devServer.on('close', (code) => {
    console.log(`Dev server exited with code ${code}`);
  });

} catch (error) {
  console.error('❌ Error starting services:', error.message);
  process.exit(1);
}
