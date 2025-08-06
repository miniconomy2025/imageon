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
