import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { odooClient } from "../../services/odoo-client";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🔍 Probando conexión con Odoo...");
    
    // Intentar autenticar
    await odooClient.authenticate();
    
    // Obtener algunos partners como prueba
    const partners = await odooClient.searchRead(
      "res.partner",
      [],
      ["name", "email"],
      5
    );
    
    res.json({
      success: true,
      message: "✅ Conexión exitosa con Odoo",
      data: {
        partners: partners,
        count: partners.length
      }
    });
  } catch (error: any) {
    console.error("❌ Error al conectar con Odoo:", error);
    res.status(500).json({
      success: false,
      message: "Error al conectar con Odoo",
      error: error.message
    });
  }
}