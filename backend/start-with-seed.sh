#!/bin/bash

echo "🚀 Starting Railway with Seed..."
echo "📁 Current directory: $(pwd)"
echo "🌍 Environment: $NODE_ENV"
echo "🔍 Railway detected: $RAILWAY_ENVIRONMENT"

# Run the post-deploy script first
echo "🔧 Running post-deploy script..."
node railway-post-deploy.js

# Check if post-deploy was successful
if [ $? -eq 0 ]; then
    echo "✅ Post-deploy completed successfully"
    echo "🚀 Starting Medusa server..."
    pnpm run start
else
    echo "❌ Post-deploy failed, starting server anyway..."
    pnpm run start
fi
