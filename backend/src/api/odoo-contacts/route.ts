import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { odooClient } from "../../services/odoo-client";
import { ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD } from "../../lib/constants";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🔍 Obteniendo contactos de Odoo...");
    
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
    
    // Obtener todos los partners con más campos
    const partners = await odooClient.searchRead(
      "res.partner",
      [],
      [
        "name", 
        "email", 
        "phone", 
        "mobile", 
        "street", 
        "city", 
        "state_id", 
        "country_id", 
        "is_company", 
        "parent_id",
        "create_date",
        "write_date"
      ],
      100 // Límite de 100 contactos
    );
    
    // Formatear los datos para una mejor presentación
    const formattedPartners = partners.map((partner: any) => ({
      id: partner.id,
      name: partner.name,
      email: partner.email || null,
      phone: partner.phone || null,
      mobile: partner.mobile || null,
      address: {
        street: partner.street || null,
        city: partner.city || null,
        state: partner.state_id ? partner.state_id[1] : null, // [id, name]
        country: partner.country_id ? partner.country_id[1] : null, // [id, name]
      },
      is_company: partner.is_company || false,
      parent_company: partner.parent_id ? partner.parent_id[1] : null, // [id, name]
      created_at: partner.create_date,
      updated_at: partner.write_date
    }));
    
    res.json({
      success: true,
      message: "✅ Contactos obtenidos exitosamente",
      data: {
        contacts: formattedPartners,
        count: formattedPartners.length,
        companies: formattedPartners.filter(p => p.is_company).length,
        individuals: formattedPartners.filter(p => !p.is_company).length
      },
      config: {
        url: ODOO_URL,
        database: ODOO_DATABASE,
        username: ODOO_USERNAME
      }
    });
  } catch (error: any) {
    console.error("❌ Error al obtener contactos de Odoo:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener contactos de Odoo",
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
