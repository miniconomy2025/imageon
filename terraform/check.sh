# Simple Check Script
# Run this after deployment to verify everything is working

echo "🔍 Checking Imageon Services"
echo "============================"

BACKEND_IP=$(terraform output -raw backend_ip)
TABLE_NAME=$(terraform output -raw dynamodb_table_name)

echo "Backend IP: $BACKEND_IP"
echo "DynamoDB Table: $TABLE_NAME"
echo ""

echo "📡 Testing services..."

# Test DynamoDB (using AWS CLI if available)
echo -n "DynamoDB Table: "
if command -v aws &> /dev/null; then
    if aws dynamodb describe-table --table-name $TABLE_NAME --region us-east-1 &> /dev/null; then
        echo "✅ Active"
    else
        echo "❌ Not found or not accessible"
    fi
else
    echo "⚠️  AWS CLI not installed (table should be created)"
fi

# Test Redis
echo -n "Redis (port 6379): "
if timeout 5 bash -c "</dev/tcp/$BACKEND_IP/6379"; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# Test API (if your app is running)
echo -n "API (port 3000): "
if curl -s http://$BACKEND_IP:3000/health > /dev/null; then
    echo "✅ Running"
else
    echo "❌ Not responding (app may not be deployed yet)"
fi

echo ""
echo "🔗 Quick SSH commands:"
echo "Backend:  ssh -i imageon-key.pem ubuntu@$BACKEND_IP"
echo "Frontend: ssh -i imageon-key.pem ubuntu@$(terraform output -raw frontend_ip)"
