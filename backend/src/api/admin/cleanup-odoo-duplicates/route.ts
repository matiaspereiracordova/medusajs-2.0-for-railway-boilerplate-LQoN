import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { cleanupOdooDuplicates, identifyOdooDuplicates } from "../../../scripts/cleanup-odoo-duplicates";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🧹 Iniciando limpieza de productos duplicados en Odoo desde API...");

    const result = await cleanupOdooDuplicates();

    res.status(200).json({
      success: true,
      message: "Limpieza de duplicados de Odoo completada",
      data: {
        total_products: result.totalProducts,
        duplicate_groups: result.duplicateGroups,
        products_deleted: result.productsDeleted,
        errors: result.errors,
        error_details: result.errorDetails,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error("❌ Error en limpieza de duplicados de Odoo:", error);
    res.status(500).json({
      success: false,
      message: "Error en limpieza de duplicados de Odoo",
      error: error.message || error,
      timestamp: new Date().toISOString()
    });
  }
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { action } = req.query;

    if (action === "identify") {
      console.log("🔍 Identificando duplicados en Odoo...");
      
      const result = await identifyOdooDuplicates();

      res.status(200).json({
        success: true,
        message: "Identificación de duplicados completada",
        data: {
          total_products: result.totalProducts,
          duplicates_found: result.duplicatesFound,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Información de la API
    res.status(200).json({
      success: true,
      message: "API de limpieza de duplicados de Odoo",
      usage: {
        identify: "GET /admin/cleanup-odoo-duplicates?action=identify",
        cleanup: "POST /admin/cleanup-odoo-duplicates"
      },
      description: {
        identify: "Identifica productos duplicados en Odoo sin eliminarlos",
        cleanup: "Identifica y elimina productos duplicados en Odoo"
      }
    });

  } catch (error: any) {
    console.error("❌ Error en identificación de duplicados:", error);
    res.status(500).json({
      success: false,
      message: "Error identificando duplicados de Odoo",
      error: error.message || error,
      timestamp: new Date().toISOString()
    });
  }
}
