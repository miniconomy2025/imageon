#!/bin/bash

# Social Media App - Local Development Setup Script
# This script sets up your entire local development environment

set -e  # Exit on any error

echo "🚀 Setting up Social Media App Local Development Environment"
echo "============================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
check_docker() {
    echo -e "${BLUE}🐳 Checking Docker...${NC}"
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Start DynamoDB Local
start_dynamodb() {
    echo -e "${BLUE}🗄️  Starting DynamoDB Local...${NC}"
    
    # Stop existing container if running
    docker stop dynamodb-local 2>/dev/null || true
    docker rm dynamodb-local 2>/dev/null || true
    
    # Create data directory if it doesn't exist
    mkdir -p ./local-dynamodb-data
    
    # Start DynamoDB Local
    docker run -d \
        --name dynamodb-local \
        -p 8000:8000 \
        -v "$PWD/local-dynamodb-data":/home/dynamodblocal/data \
        amazon/dynamodb-local \
        -jar DynamoDBLocal.jar \
        -sharedDb \
        -dbPath /home/dynamodblocal/data
    
    echo -e "${GREEN}✅ DynamoDB Local started on port 8000${NC}"
}

# Start Redis Local
start_redis() {
    echo -e "${BLUE}📦 Starting Redis Local...${NC}"
    
    # Stop existing container if running
    docker stop redis-local 2>/dev/null || true
    docker rm redis-local 2>/dev/null || true
    
    # Start Redis
    docker run -d \
        --name redis-local \
        -p 6379:6379 \
        redis:alpine
    
    echo -e "${GREEN}✅ Redis started on port 6379${NC}"
}

# Wait for services to be ready
wait_for_services() {
    echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
    
    # Wait for DynamoDB
    local dynamodb_ready=false
    for i in {1..30}; do
        if curl -s http://localhost:8000 > /dev/null 2>&1; then
            dynamodb_ready=true
            break
        fi
        sleep 1
    done
    
    if [ "$dynamodb_ready" = true ]; then
        echo -e "${GREEN}✅ DynamoDB Local is ready${NC}"
    else
        echo -e "${RED}❌ DynamoDB Local failed to start${NC}"
        exit 1
    fi
    
    # Wait for Redis
    local redis_ready=false
    for i in {1..10}; do
        if redis-cli -h localhost -p 6379 ping > /dev/null 2>&1 || nc -z localhost 6379; then
            redis_ready=true
            break
        fi
        sleep 1
    done
    
    if [ "$redis_ready" = true ]; then
        echo -e "${GREEN}✅ Redis is ready${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis connection check failed, but continuing...${NC}"
    fi
}

# Setup DynamoDB tables and sample data
setup_database() {
    echo -e "${BLUE}🗂️  Setting up database tables and sample data...${NC}"
    
    # Check if backend directory exists
    if [ -d "backend" ]; then
        cd backend
        
        # Install dependencies if node_modules doesn't exist
        if [ ! -d "node_modules" ]; then
            echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
            npm install
        fi
        
        # Run database setup
        node scripts/setup-local-dynamodb.js
        cd ..
    else
        echo -e "${YELLOW}⚠️  Backend directory not found. Skipping database setup.${NC}"
        echo -e "${YELLOW}   Please run 'node scripts/setup-local-dynamodb.js' from the backend directory later.${NC}"
    fi
}

# Setup frontend dependencies
setup_frontend() {
    echo -e "${BLUE}🎨 Setting up frontend...${NC}"
    
    if [ -d "frontend" ]; then
        cd frontend
        
        # Install dependencies if node_modules doesn't exist
        if [ ! -d "node_modules" ]; then
            echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
            npm install
        fi
        
        cd ..
        echo -e "${GREEN}✅ Frontend setup complete${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend directory not found. Skipping frontend setup.${NC}"
    fi
}

# Create environment files
setup_env_files() {
    echo -e "${BLUE}⚙️  Setting up environment files...${NC}"
    
    # Backend .env
    if [ -f ".env.example" ] && [ ! -f "backend/.env.local" ]; then
        cp .env.example backend/.env.local
        echo -e "${GREEN}✅ Created backend/.env.local${NC}"
    fi
    
    # Frontend .env
    if [ ! -f "frontend/.env.local" ]; then
        cat > frontend/.env.local << EOL
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3002
VITE_APP_NAME=Social Media App
VITE_MAX_FILE_SIZE=10485760
EOL
        echo -e "${GREEN}✅ Created frontend/.env.local${NC}"
    fi
}

# Install global tools
install_global_tools() {
    echo -e "${BLUE}🛠️  Installing global development tools...${NC}"
    
    # Check if dynamodb-admin is installed
    if ! command -v dynamodb-admin &> /dev/null; then
        echo -e "${BLUE}📊 Installing DynamoDB Admin UI...${NC}"
        npm install -g dynamodb-admin
        echo -e "${GREEN}✅ DynamoDB Admin UI installed${NC}"
    else
        echo -e "${GREEN}✅ DynamoDB Admin UI already installed${NC}"
    fi
}

# Display final instructions
show_final_instructions() {
    echo ""
    echo -e "${GREEN}🎉 Local development environment setup complete!${NC}"
    echo ""
    echo -e "${BLUE}📋 What's been set up:${NC}"
    echo "   ✅ DynamoDB Local running on port 8000"
    echo "   ✅ Redis running on port 6379" 
    echo "   ✅ Database tables created with sample data"
    echo "   ✅ Environment files configured"
    echo "   ✅ Dependencies installed"
    echo ""
    echo -e "${BLUE}🚀 Next steps:${NC}"
    echo ""
    echo -e "${YELLOW}1. Start the backend server:${NC}"
    echo "   cd backend && npm run dev"
    echo ""
    echo -e "${YELLOW}2. Start the frontend (in a new terminal):${NC}"
    echo "   cd frontend && npm run dev"
    echo ""
    echo -e "${YELLOW}3. Access your applications:${NC}"
    echo "   • Frontend: http://localhost:5173"
    echo "   • Backend API: http://localhost:3001"
    echo "   • DynamoDB Admin: http://localhost:8001 (run 'npm run db:admin' from backend)"
    echo ""
    echo -e "${BLUE}🛠️  Useful commands:${NC}"
    echo "   • Stop services: ./scripts/stop-local-dev.sh"
    echo "   • Reset database: npm run db:local:reset (from backend)"
    echo "   • View logs: docker logs dynamodb-local -f"
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${RED}🛑 Setup interrupted. Cleaning up...${NC}"
    docker stop dynamodb-local redis-local 2>/dev/null || true
    exit 1
}

# Set trap for cleanup
trap cleanup INT TERM

# Main execution
main() {
    check_docker
    start_dynamodb
    start_redis
    wait_for_services
    setup_env_files
    setup_database
    setup_frontend
    install_global_tools
    show_final_instructions
}

# Run main function
main
