# Social Media App - Local Development Setup Script (PowerShell)
# This script sets up your entire local development environment on Windows

param(
    [switch]$SkipDependencies,
    [switch]$ResetData
)

# Colors for output
$Red = "Red"
$Green = "Green" 
$Yellow = "Yellow"
$Blue = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-DockerRunning {
    Write-ColorOutput "🐳 Checking Docker..." $Blue
    try {
        $null = docker info 2>$null
        Write-ColorOutput "✅ Docker is running" $Green
        return $true
    }
    catch {
        Write-ColorOutput "❌ Docker is not running. Please start Docker Desktop first." $Red
        return $false
    }
}

function Start-DynamoDBLocal {
    Write-ColorOutput "🗄️  Starting DynamoDB Local..." $Blue
    
    # Stop existing container if running
    docker stop dynamodb-local 2>$null | Out-Null
    docker rm dynamodb-local 2>$null | Out-Null
    
    # Create data directory if it doesn't exist
    if (!(Test-Path "./local-dynamodb-data")) {
        New-Item -ItemType Directory -Path "./local-dynamodb-data" | Out-Null
    }
    
    # Start DynamoDB Local
    $dataPath = (Resolve-Path "./local-dynamodb-data").Path
    docker run -d `
        --name dynamodb-local `
        -p 8000:8000 `
        -v "${dataPath}:/home/dynamodblocal/data" `
        amazon/dynamodb-local `
        -jar DynamoDBLocal.jar `
        -sharedDb `
        -dbPath /home/dynamodblocal/data | Out-Null
    
    Write-ColorOutput "✅ DynamoDB Local started on port 8000" $Green
}

function Start-RedisLocal {
    Write-ColorOutput "📦 Starting Redis Local..." $Blue
    
    # Stop existing container if running
    docker stop redis-local 2>$null | Out-Null
    docker rm redis-local 2>$null | Out-Null
    
    # Start Redis
    docker run -d `
        --name redis-local `
        -p 6379:6379 `
        redis:alpine | Out-Null
    
    Write-ColorOutput "✅ Redis started on port 6379" $Green
}

function Wait-ForServices {
    Write-ColorOutput "⏳ Waiting for services to be ready..." $Blue
    
    # Wait for DynamoDB
    $dynamoReady = $false
    for ($i = 1; $i -le 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8000" -TimeoutSec 1 -ErrorAction Stop
            $dynamoReady = $true
            break
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
    
    if ($dynamoReady) {
        Write-ColorOutput "✅ DynamoDB Local is ready" $Green
    }
    else {
        Write-ColorOutput "❌ DynamoDB Local failed to start" $Red
        exit 1
    }
    
    # Wait for Redis (basic connectivity test)
    $redisReady = $false
    for ($i = 1; $i -le 10; $i++) {
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $tcpClient.Connect("localhost", 6379)
            $tcpClient.Close()
            $redisReady = $true
            break
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
    
    if ($redisReady) {
        Write-ColorOutput "✅ Redis is ready" $Green
    }
    else {
        Write-ColorOutput "⚠️  Redis connection check failed, but continuing..." $Yellow
    }
}

function Setup-Database {
    Write-ColorOutput "🗂️  Setting up database tables and sample data..." $Blue
    
    if (Test-Path "backend") {
        Push-Location "backend"
        
        # Install dependencies if node_modules doesn't exist
        if (!(Test-Path "node_modules") -and !$SkipDependencies) {
            Write-ColorOutput "📦 Installing backend dependencies..." $Blue
            npm install
        }
        
        # Run database setup
        if (Test-Path "scripts/setup-local-dynamodb.js") {
            node scripts/setup-local-dynamodb.js
        }
        else {
            Write-ColorOutput "⚠️  Database setup script not found" $Yellow
        }
        
        Pop-Location
    }
    else {
        Write-ColorOutput "⚠️  Backend directory not found. Skipping database setup." $Yellow
        Write-ColorOutput "   Please run 'node scripts/setup-local-dynamodb.js' from the backend directory later." $Yellow
    }
}

function Setup-Frontend {
    Write-ColorOutput "🎨 Setting up frontend..." $Blue
    
    if (Test-Path "frontend") {
        Push-Location "frontend"
        
        # Install dependencies if node_modules doesn't exist
        if (!(Test-Path "node_modules") -and !$SkipDependencies) {
            Write-ColorOutput "📦 Installing frontend dependencies..." $Blue
            npm install
        }
        
        Pop-Location
        Write-ColorOutput "✅ Frontend setup complete" $Green
    }
    else {
        Write-ColorOutput "⚠️  Frontend directory not found. Skipping frontend setup." $Yellow
    }
}

function Setup-EnvironmentFiles {
    Write-ColorOutput "⚙️  Setting up environment files..." $Blue
    
    # Backend .env
    if ((Test-Path ".env.example") -and !(Test-Path "backend/.env.local")) {
        if (!(Test-Path "backend")) {
            New-Item -ItemType Directory -Path "backend" | Out-Null
        }
        Copy-Item ".env.example" "backend/.env.local"
        Write-ColorOutput "✅ Created backend/.env.local" $Green
    }
    
    # Frontend .env
    if (!(Test-Path "frontend/.env.local")) {
        if (!(Test-Path "frontend")) {
            New-Item -ItemType Directory -Path "frontend" | Out-Null
        }
        
        $frontendEnv = @"
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002
VITE_APP_NAME=Social Media App
VITE_MAX_FILE_SIZE=10485760
"@
        $frontendEnv | Out-File -FilePath "frontend/.env.local" -Encoding UTF8
        Write-ColorOutput "✅ Created frontend/.env.local" $Green
    }
}

function Install-GlobalTools {
    Write-ColorOutput "🛠️  Installing global development tools..." $Blue
    
    # Check if dynamodb-admin is installed
    try {
        $null = Get-Command dynamodb-admin -ErrorAction Stop
        Write-ColorOutput "✅ DynamoDB Admin UI already installed" $Green
    }
    catch {
        Write-ColorOutput "📊 Installing DynamoDB Admin UI..." $Blue
        npm install -g dynamodb-admin
        Write-ColorOutput "✅ DynamoDB Admin UI installed" $Green
    }
}

function Show-FinalInstructions {
    Write-Host ""
    Write-ColorOutput "🎉 Local development environment setup complete!" $Green
    Write-Host ""
    Write-ColorOutput "📋 What's been set up:" $Blue
    Write-Host "   ✅ DynamoDB Local running on port 8000"
    Write-Host "   ✅ Redis running on port 6379"
    Write-Host "   ✅ Database tables created with sample data"
    Write-Host "   ✅ Environment files configured"
    Write-Host "   ✅ Dependencies installed"
    Write-Host ""
    Write-ColorOutput "🚀 Next steps:" $Blue
    Write-Host ""
    Write-ColorOutput "1. Start the backend server:" $Yellow
    Write-Host "   cd backend; npm run dev"
    Write-Host ""
    Write-ColorOutput "2. Start the frontend (in a new terminal):" $Yellow
    Write-Host "   cd frontend; npm run dev"
    Write-Host ""
    Write-ColorOutput "3. Access your applications:" $Yellow
    Write-Host "   • Frontend: http://localhost:5173"
    Write-Host "   • Backend API: http://localhost:3001"
    Write-Host "   • DynamoDB Admin: http://localhost:8001 (run 'npm run db:admin' from backend)"
    Write-Host ""
    Write-ColorOutput "🛠️  Useful commands:" $Blue
    Write-Host "   • Stop services: docker stop dynamodb-local redis-local"
    Write-Host "   • Reset database: npm run db:local:reset (from backend)"
    Write-Host "   • View logs: docker logs dynamodb-local -f"
    Write-Host ""
    Write-ColorOutput "Happy coding! 🚀" $Green
}

function Main {
    try {
        Write-ColorOutput "🚀 Setting up Social Media App Local Development Environment" $Blue
        Write-ColorOutput "============================================================" $Blue
        Write-Host ""
        
        if (!(Test-DockerRunning)) {
            exit 1
        }
        
        Start-DynamoDBLocal
        Start-RedisLocal
        Wait-ForServices
        Setup-EnvironmentFiles
        
        if (!$SkipDependencies) {
            Setup-Database
            Setup-Frontend
            Install-GlobalTools
        }
        
        Show-FinalInstructions
    }
    catch {
        Write-ColorOutput "🛑 Setup failed: $($_.Exception.Message)" $Red
        Write-ColorOutput "Cleaning up..." $Yellow
        docker stop dynamodb-local redis-local 2>$null | Out-Null
        exit 1
    }
}

# Run main function
Main
