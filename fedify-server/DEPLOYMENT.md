# 🚀 Deploy to Render.com

This guide will help you deploy your Fedify social network to Render.com for federation with other ActivityPub servers.

## 📋 Prerequisites

1. **GitHub Account** - Your code needs to be in a GitHub repository
2. **Render.com Account** - Sign up at [render.com](https://render.com)
3. **AWS DynamoDB** - Already configured ✅
4. **Redis Cloud** (Optional) - For caching

## 🔧 Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Create a new repository on GitHub and push
git remote add origin https://github.com/yourusername/fedify-social-network.git
git push -u origin main
```

## 🌐 Step 2: Deploy on Render.com

### Option A: Using render.yaml (Recommended)

1. **Connect your GitHub repository** to Render.com
2. **Render will automatically detect** the `render.yaml` file
3. **Set environment variables** in Render dashboard:
   - `AWS_REGION` = `us-east-1` (or your region)
   - `AWS_ACCESS_KEY_ID` = Your AWS access key
   - `AWS_SECRET_ACCESS_KEY` = Your AWS secret key
   - `POSTS_TABLE` = `fedify-posts`
   - `USERS_TABLE` = `fedify-users`
   - `REDIS_URL` = Your Redis Cloud URL (optional)

### Option B: Manual Setup

1. **Create a new Web Service** on Render.com
2. **Connect your GitHub repository**
3. **Configure the service:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm run prod`
   - **Environment:** `Node`
4. **Add environment variables** (same as above)

## 🔗 Step 3: Configure Federation

Once deployed, your server will be available at:
`https://your-app-name.onrender.com`

### Test Federation Endpoints:

1. **WebFinger:** `https://your-app-name.onrender.com/.well-known/webfinger?resource=acct:username@your-app-name.onrender.com`
2. **NodeInfo:** `https://your-app-name.onrender.com/nodeinfo/2.0`
3. **User Profile:** `https://your-app-name.onrender.com/users/username`

## 🌍 Step 4: Federation with Other Servers

### From Mastodon:
1. **Search for your user:** `@username@your-app-name.onrender.com`
2. **Follow the user** to see their posts
3. **Posts will appear** in your Mastodon timeline

### From Your App:
1. **Visit your deployed app**
2. **Create posts** - they'll be federated automatically
3. **Other servers can discover** your users via WebFinger

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AWS_REGION` | Your AWS region | ✅ |
| `AWS_ACCESS_KEY_ID` | AWS access key | ✅ |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | ✅ |
| `POSTS_TABLE` | DynamoDB table name | ✅ |
| `USERS_TABLE` | Users table name | ✅ |
| `REDIS_URL` | Redis connection string | ❌ |
| `NODE_ENV` | Set to `production` | ✅ |

## 🚀 Production Features

- **HTTPS enabled** automatically
- **Auto-scaling** based on traffic
- **Global CDN** for fast access
- **Automatic deployments** on git push
- **Health checks** and monitoring

## 🔍 Monitoring

Render provides:
- **Logs** - View application logs
- **Metrics** - CPU, memory usage
- **Health checks** - Automatic restarts
- **Custom domains** - Add your own domain

## 🌟 Next Steps

1. **Test federation** with Mastodon instances
2. **Add custom domain** (optional)
3. **Monitor performance** and logs
4. **Scale up** if needed

Your federated social network is now live and ready to connect with the broader fediverse! 🌍 