# ImageOn Development Environment Startup Script
# Run with: .\scripts\start-dev.ps1

Write-Host "🚀 Starting ImageOn development environment..." -ForegroundColor Green
Write-Host ""

try {
    # Start DynamoDB
    Write-Host "📊 Starting DynamoDB Local..." -ForegroundColor Yellow
    docker-compose -f ..\databases\docker-compose.yml up -d
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start DynamoDB"
    }

    # Start Redis (stop existing first)
    Write-Host "🔴 Starting Redis..." -ForegroundColor Yellow
    docker stop imageon-redis 2>$null | Out-Null
    docker rm imageon-redis 2>$null | Out-Null
    docker run --name imageon-redis -p 6379:6379 -d redis:7-alpine
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start Redis"
    }

    # Wait for services
    Write-Host "⏳ Waiting for services to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3

    # Check service status
    Write-Host "🔍 Checking service status..." -ForegroundColor Yellow
    docker ps --filter "name=dynamodb-local" --filter "name=imageon-redis" --format "table {{.Names}}`t{{.Status}}"

    Write-Host ""
    Write-Host "✅ Services started successfully!" -ForegroundColor Green
    Write-Host "📊 DynamoDB Local: http://localhost:8000" -ForegroundColor Cyan
    Write-Host "� DynamoDB Admin UI: Run 'npm run db:admin' in another terminal" -ForegroundColor Cyan
    Write-Host "�🔴 Redis: localhost:6379" -ForegroundColor Cyan
    Write-Host "🌐 Federation Server: http://localhost:3000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🚀 Starting development server..." -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
    Write-Host ""

    # Start development server
    npm run dev

} catch {
    Write-Host "❌ Error starting services: $_" -ForegroundColor Red
    exit 1
} finally {
    # Cleanup on exit
    Write-Host ""
    Write-Host "🛑 Shutting down services..." -ForegroundColor Yellow
    docker-compose -f ..\databases\docker-compose.yml down 2>$null | Out-Null
    docker stop imageon-redis 2>$null | Out-Null
    docker rm imageon-redis 2>$null | Out-Null
    Write-Host "👋 Goodbye!" -ForegroundColor Green
}
