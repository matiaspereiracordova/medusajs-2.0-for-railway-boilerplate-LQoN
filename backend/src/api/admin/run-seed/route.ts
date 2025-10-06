import { NextRequest, NextResponse } from "next/server";
import { createMedusaContainer } from "@medusajs/framework";
import seedDemoData from "../../../scripts/seed";

export async function POST(req: NextRequest) {
  try {
    console.log("🌱 Starting seed execution...");
    
    // Create container
    const container = createMedusaContainer();
    
    // Execute seed
    await seedDemoData({ container });
    
    console.log("✅ Seed execution completed successfully!");
    
    return NextResponse.json({ 
      success: true, 
      message: "Seed executed successfully!",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error executing seed:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: "Seed endpoint ready. Use POST to execute seed.",
    timestamp: new Date().toISOString()
  });
}
