import { createMedusaContainer } from "@medusajs/framework";
import seedDemoData from "./seed";

async function postDeploySeed() {
  console.log("🚀 Starting post-deploy seed process...");
  
  try {
    // Create container
    const container = createMedusaContainer();
    
    // Check if we're in production
    const isProduction = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT === "production";
    
    if (isProduction) {
      console.log("🌍 Production environment detected, running seed...");
      
      // Execute seed
      await seedDemoData({ container });
      
      console.log("✅ Post-deploy seed completed successfully!");
    } else {
      console.log("🔧 Development environment detected, skipping seed...");
    }
  } catch (error) {
    console.error("❌ Error during post-deploy seed:", error);
    // Don't throw error to prevent deployment failure
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  postDeploySeed();
}

export default postDeploySeed;
