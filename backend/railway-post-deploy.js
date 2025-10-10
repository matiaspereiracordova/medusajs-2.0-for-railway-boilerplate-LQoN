#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Railway Post-Deploy Script Starting...');
  console.log('🔍 Environment variables:');
  console.log('  - NODE_ENV:', process.env.NODE_ENV);
  console.log('  - RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
  console.log('  - RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID);
  console.log('  - RAILWAY_SERVICE_NAME:', process.env.RAILWAY_SERVICE_NAME);
  console.log('  - RAILWAY_DEPLOYMENT_ID:', process.env.RAILWAY_DEPLOYMENT_ID);

  // Check if we're in Railway
  const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;

  console.log('🌍 Is Railway?', !!isRailway);

  if (!isRailway) {
    console.log('🔧 Not in Railway environment, skipping seed...');
    process.exit(0);
  }

  console.log('🌍 Railway environment detected, proceeding...');

  try {
    // First, initialize the backend
    console.log('🔧 Initializing backend...');
    try {
      execSync('npx init-backend', { 
        stdio: 'inherit',
        cwd: __dirname,
        env: { ...process.env }
      });
      console.log('✅ Backend initialized successfully!');
    } catch (initError) {
      console.log('⚠️ Backend initialization error (may already be initialized):', initError.message);
    }

    // Check if seed has already been run by looking for a marker file
    const seedMarkerPath = path.join(__dirname, '.seed-completed');
    
    // Force seed to run based on environment variable
    const forceSeed = process.env.FORCE_SEED === 'true';
    
    if (fs.existsSync(seedMarkerPath) && !forceSeed) {
      console.log('✅ Seed already completed, skipping...');
      console.log('ℹ️ To force seed, set FORCE_SEED=true environment variable');
    } else {
      if (forceSeed) {
        console.log('🔄 FORCE_SEED=true, running seed even if marker exists...');
      }
      
      // Run the seed command
      console.log('🌱 Running database seed...');
      console.log('📁 Current directory:', __dirname);
      console.log('📂 Seed file path: ./src/scripts/seed.ts');
      
      execSync('npx medusa exec ./src/scripts/seed.ts', { 
        stdio: 'inherit',
        cwd: __dirname,
        env: { ...process.env, FORCE_SEED: forceSeed ? 'true' : 'false' }
      });

      // Create marker file to prevent re-running
      fs.writeFileSync(seedMarkerPath, new Date().toISOString());
      console.log('✅ Post-deploy seed completed successfully!');
    }

    // Run price synchronization to Odoo (always run after seed)
    console.log('💰 Running price synchronization to Odoo...');
    console.log('ℹ️ Note: Price sync will be triggered by the scheduled job or manual API call');
    console.log('ℹ️ To manually sync prices, use: POST /admin/sync-prices-to-odoo');
    console.log('ℹ️ Scheduled job runs every 6 hours automatically');
    
    console.log('🎉 Post-deploy tasks completed!');
    
  } catch (error) {
    console.error('❌ Error during post-deploy tasks:', error.message);
    console.error('Stack:', error.stack);
    // Don't fail the deployment
    process.exit(0);
  }
}

main();
