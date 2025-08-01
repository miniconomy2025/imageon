#!/bin/bash

# Simple deployment script for Imageon

echo "🚀 Deploying Imageon Infrastructure"
echo "===================================="

# Initialize Terraform
echo "📋 Initializing Terraform..."
terraform init

# Plan deployment
echo "📋 Planning deployment..."
terraform plan

# Ask for confirmation
read -p "Deploy? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying..."
    terraform apply -auto-approve
    
    # Save the private key
    echo "🔑 Saving SSH private key..."
    terraform output -raw ssh_private_key > imageon-key.pem
    chmod 600 imageon-key.pem
    
    echo ""
    echo "✅ Imageon Deployment Complete!"
    echo "==============================="
    echo ""
    echo "📋 Your Imageon Infrastructure:"
    echo "Backend IP:  $(terraform output -raw backend_ip)"
    echo "Frontend IP: $(terraform output -raw frontend_ip)"
    echo ""
    echo "🔗 Quick Connect:"
    echo "Backend:  ssh -i imageon-key.pem ubuntu@$(terraform output -raw backend_ip)"
    echo "Frontend: ssh -i imageon-key.pem ubuntu@$(terraform output -raw frontend_ip)"
    echo ""
    echo "🌐 Services (after setup completes):"
    echo "API:      http://$(terraform output -raw backend_ip):3000"
    echo "DynamoDB: http://$(terraform output -raw backend_ip):8000"
    echo "Redis:    $(terraform output -raw backend_ip):6379"
    echo ""
    echo "⏳ Note: Services are starting up, wait 2-3 minutes before testing"
    
else
    echo "❌ Deployment cancelled"
fi
