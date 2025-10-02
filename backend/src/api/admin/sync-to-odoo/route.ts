import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncToOdooWorkflow from "../../../workflows/sync-to-odoo.js"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { productIds, limit = 50, offset = 0 } = req.body as {
      productIds?: string[]
      limit?: number
      offset?: number
    }

    console.log("🚀 Iniciando sincronización manual hacia ODOO...")
    console.log(`📋 Parámetros de sincronización:`, { limit, offset, productIds })

    const result = await syncToOdooWorkflow(req.scope).run({
      input: {
        productIds,
        limit,
        offset,
      },
    })

    const response = {
      success: true,
      message: "Sincronización completada exitosamente",
      data: {
        syncedProducts: result.result.syncedProducts,
        createdProducts: result.result.createdProducts,
        updatedProducts: result.result.updatedProducts,
        errorCount: result.result.errorCount,
        errors: result.result.errors,
        timestamp: new Date().toISOString(),
      },
    }

    console.log("✅ Sincronización manual completada:", response.data)

    res.json(response)
  } catch (error: any) {
    console.error("❌ Error en sincronización manual:", error)
    
    res.status(500).json({
      success: false,
      message: "Error en sincronización hacia ODOO",
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { action } = req.query

    if (action === "test-connection") {
      res.json({
        success: true,
        message: "Endpoint de sincronización disponible",
        endpoints: {
          sync: "POST /admin/sync-to-odoo",
          test: "GET /admin/sync-to-odoo?action=test-connection"
        }
      })
      return
    }

    res.json({
      success: true,
      message: "API de sincronización con ODOO",
      usage: {
        method: "POST",
        endpoint: "/admin/sync-to-odoo",
        body: {
          limit: "number (opcional, default: 50)",
          offset: "number (opcional, default: 0)",
          productIds: "string[] (opcional, IDs específicos de productos)"
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error obteniendo información de la API",
      error: error.message,
    })
  }
}
