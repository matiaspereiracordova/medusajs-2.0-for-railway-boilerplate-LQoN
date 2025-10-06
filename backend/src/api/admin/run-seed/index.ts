import { Request, Response } from "express";
import { createMedusaContainer } from "@medusajs/framework";
import seedDemoData from "../../../scripts/seed";

export async function POST(req: Request, res: Response) {
  try {
    console.log("🌱 Starting seed execution...");
    
    // Create container
    const container = createMedusaContainer();
    
    // Execute seed
    await seedDemoData({ container, args: [] });
    
    console.log("✅ Seed execution completed successfully!");
    
    res.json({ 
      success: true, 
      message: "Seed executed successfully!",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error executing seed:", error);
    res.status(500).json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      }
    );
  }
}

export async function GET(req: Request, res: Response) {
  res.json({ 
    message: "Seed endpoint ready. Use POST to execute seed.",
    timestamp: new Date().toISOString()
  });
}
