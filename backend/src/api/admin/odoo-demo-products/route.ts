import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { odooClient } from "../../../services/odoo-client";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🎭 Obteniendo productos de demostración de Odoo...");
    
    const { limit = 20, offset = 0 } = req.query;
    
    // Obtener solo productos de demostración (que NO tienen x_medusa_id)
    const demoProducts = await odooClient.searchRead(
      "product.template",
      [["x_medusa_id", "=", false]], // Solo productos sin x_medusa_id
      ["id", "name", "list_price", "default_code", "description", "active", "image_1920"],
      parseInt(limit as string) || 20
    );

    console.log(`🎭 Productos de demostración encontrados: ${demoProducts.length}`);

    res.status(200).json({
      success: true,
      message: "Productos de demostración obtenidos",
      data: {
        demo_products: demoProducts,
        total_found: demoProducts.length,
        limit: parseInt(limit as string) || 20,
        offset: parseInt(offset as string) || 0
      }
    });

  } catch (error: any) {
    console.error("❌ Error obteniendo productos de demostración:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo productos de demostración",
      error: error.message || error
    });
  }
}
