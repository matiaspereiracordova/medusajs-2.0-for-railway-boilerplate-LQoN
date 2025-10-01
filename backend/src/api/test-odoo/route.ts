import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { odooClient } from "../../services/odoo-client";
import { ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD } from "../../lib/constants";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🔍 Probando conexión con Odoo...");
    
    // Verificar configuración de variables de entorno
    const configStatus = {
      url: !!ODOO_URL,
      database: !!ODOO_DATABASE,
      username: !!ODOO_USERNAME,
      password: !!ODOO_PASSWORD
    };
    
    const missingVars = Object.entries(configStatus)
      .filter(([_, configured]) => !configured)
      .map(([key, _]) => key);
    
    if (missingVars.length > 0) {
      res.status(400).json({
        success: false,
        message: "Variables de entorno de Odoo no configuradas",
        error: `Variables faltantes: ${missingVars.join(', ')}`,
        config: {
          ...configStatus,
          url_value: ODOO_URL ? `${ODOO_URL.substring(0, 20)}...` : 'No configurado',
          database_value: ODOO_DATABASE || 'No configurado',
          username_value: ODOO_USERNAME || 'No configurado',
          password_configured: !!ODOO_PASSWORD
        }
      });
      return;
    }
    
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
      },
      config: {
        url: ODOO_URL,
        database: ODOO_DATABASE,
        username: ODOO_USERNAME
      }
    });
  } catch (error: any) {
    console.error("❌ Error al conectar con Odoo:", error);
    res.status(500).json({
      success: false,
      message: "Error al conectar con Odoo",
      error: error.message,
      config: {
        url: ODOO_URL || 'No configurado',
        database: ODOO_DATABASE || 'No configurado',
        username: ODOO_USERNAME || 'No configurado',
        password_configured: !!ODOO_PASSWORD
      }
    });
  }
}