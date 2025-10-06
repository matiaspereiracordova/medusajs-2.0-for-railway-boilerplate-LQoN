#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Railway Post-Deploy Script Starting...');
console.log('🔍 Environment variables:');
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
console.log('  - RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID);

// Check if we're in Railway production
const isRailwayProduction = process.env.RAILWAY_ENVIRONMENT === 'production' || 
                           process.env.RAILWAY_ENVIRONMENT === 'main' ||
                           process.env.NODE_ENV === 'production';

console.log('🌍 Is Railway production?', isRailwayProduction);

if (!isRailwayProduction) {
  console.log('🔧 Not in Railway production environment, skipping seed...');
  process.exit(0);
}

console.log('🌍 Railway production environment detected, running seed...');

try {
  // Check if seed has already been run by looking for a marker file
  const seedMarkerPath = path.join(__dirname, '.seed-completed');
  
  if (fs.existsSync(seedMarkerPath)) {
    console.log('✅ Seed already completed, skipping...');
    process.exit(0);
  }

  // Run the seed command
  console.log('🌱 Running database seed...');
  execSync('npx medusa exec ./src/scripts/seed.ts', { 
    stdio: 'inherit',
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'production' }
  });

  // Create marker file to prevent re-running
  fs.writeFileSync(seedMarkerPath, new Date().toISOString());
  
  console.log('✅ Post-deploy seed completed successfully!');
  
} catch (error) {
  console.error('❌ Error during post-deploy seed:', error.message);
  // Don't fail the deployment
  process.exit(0);
}
