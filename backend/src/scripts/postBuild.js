const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const MEDUSA_SERVER_PATH = path.join(process.cwd(), '.medusa', 'server');

// Check if .medusa/server exists - if not, build process failed
if (!fs.existsSync(MEDUSA_SERVER_PATH)) {
  throw new Error('.medusa/server directory not found. This indicates the Medusa build process failed. Please check for build errors.');
}

// Copy pnpm-lock.yaml
fs.copyFileSync(
  path.join(process.cwd(), 'pnpm-lock.yaml'),
  path.join(MEDUSA_SERVER_PATH, 'pnpm-lock.yaml')
);

// Copy .env if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  fs.copyFileSync(
    envPath,
    path.join(MEDUSA_SERVER_PATH, '.env')
  );
}

// Install dependencies
console.log('Installing dependencies in .medusa/server...');
execSync('pnpm i --prod --frozen-lockfile', { 
  cwd: MEDUSA_SERVER_PATH,
  stdio: 'inherit'
});

// Trigger post-deploy sync and cleanup after a delay to allow server to start
console.log('Scheduling post-deploy sync and cleanup...');
setTimeout(() => {
  try {
    // This will be executed after the server starts
    console.log('🔄 Post-deploy sync and cleanup will be triggered by the scheduled jobs');
    console.log('🧹 Duplicate cleanup will run automatically at 1:00 AM daily');
  } catch (error) {
    console.error('Error in post-deploy setup:', error);
  }
}, 30000); // Wait 30 seconds for server to start