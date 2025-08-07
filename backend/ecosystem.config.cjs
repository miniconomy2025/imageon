module.exports = {
  apps: [{
    name: 'imageon-backend',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      FEDERATION_PROTOCOL: 'https',
      
      // DynamoDB Configuration for Production
      AWS_REGION: 'us-east-1',
      DYNAMODB_TABLE_NAME: 'imageon-app',
      // DYNAMO_ENDPOINT is intentionally omitted for production DynamoDB
      // AWS SDK will automatically use IAM role credentials
      
      // Redis Configuration
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      
      // Federation Configuration - Hardcoded for production
      FEDERATION_DOMAIN: 'team7-todo.xyz',
      
      // Firebase Configuration (non-sensitive values)
      FIREBASE_TYPE: 'service_account',
      FIREBASE_PROJECT_ID: 'imageon-cc2e2',
      FIREBASE_CLIENT_ID: '114126417811598938971',
      FIREBASE_AUTH_URI: 'https://accounts.google.com/o/oauth2/auth',
      FIREBASE_TOKEN_URI: 'https://oauth2.googleapis.com/token',
      FIREBASE_AUTH_PROVIDER_X509_CERT_URL: 'https://www.googleapis.com/oauth2/v1/certs',
      FIREBASE_CLIENT_X509_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40imageon-cc2e2.iam.gserviceaccount.com',
      FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-fbsvc@imageon-cc2e2.iam.gserviceaccount.com',
      
      // Activity and Rate Limiting Configuration
      ACTIVITY_CACHE_TTL: 3600,
      RATE_LIMIT_WINDOW: 900,
      RATE_LIMIT_MAX: 100,
      
      // Logging
      LOG_LEVEL: 'info'
    },
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto-restart configuration
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_memory_restart: '500M',
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 8000,
    
    // Health monitoring
    health_check_grace_period: 10000,
    
    // Advanced settings
    node_args: '--max-old-space-size=256',
    merge_logs: true,
    
    // Auto-restart on crashes
    autorestart: true,
    max_restarts: 5,
    min_uptime: '10s'
  }]
};
