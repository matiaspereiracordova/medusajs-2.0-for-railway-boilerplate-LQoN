import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { odooClient } from "../../../services/odoo-client";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🔍 Probando obtención de precios desde Odoo...");
    
    const { product_ids, quantity = 1, partner_id } = req.query;
    
    if (!product_ids) {
      res.status(400).json({
        success: false,
        message: "Se requiere product_ids como parámetro"
      });
      return;
    }

    // Convertir product_ids a array de números
    const productIds = Array.isArray(product_ids) 
      ? product_ids.map(id => parseInt(id as string))
      : [parseInt(product_ids as string)];

    console.log(`💰 Obteniendo precios para productos: ${productIds.join(', ')}`);
    
    // Usar el nuevo método para obtener precios
    const prices = await odooClient.getProductsPrice(
      productIds,
      parseInt(quantity as string) || 1,
      partner_id ? parseInt(partner_id as string) : undefined
    );

    res.status(200).json({
      success: true,
      message: "Precios obtenidos exitosamente",
      data: {
        product_ids: productIds,
        quantity: parseInt(quantity as string) || 1,
        partner_id: partner_id ? parseInt(partner_id as string) : null,
        prices: prices,
        total_products: Object.keys(prices).length
      }
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo precios de Odoo:", error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo precios de Odoo",
      error: error.message || error
    });
  }
}
