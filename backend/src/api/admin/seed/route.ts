import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    console.log("🌱 Manual seed execution started...");
    
    // Import and execute the seed function
    const { execSync } = require('child_process');
    
    execSync('npx medusa exec ./src/scripts/seed.ts', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env }
    });
    
    console.log("✅ Manual seed execution completed!");
    
    res.json({
      success: true,
      message: "Seed executed successfully!",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Error during manual seed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({
    message: "Seed endpoint ready. Use POST to execute seed.",
    timestamp: new Date().toISOString()
  });
}
