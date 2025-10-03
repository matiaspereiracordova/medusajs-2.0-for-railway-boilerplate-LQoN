import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncToOdooWorkflow from "../../../workflows/sync-to-odoo.js"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { limit = 2 } = req.body as {
      limit?: number
    }

    console.log("🧪 Iniciando prueba de sincronización hacia ODOO...")
    console.log(`📋 Límite de productos: ${limit}`)

    const result = await syncToOdooWorkflow(req.scope).run({
      input: {
        limit,
        offset: 0,
      },
    })

    const response = {
      success: true,
      message: "Prueba de sincronización completada",
      data: {
        syncedProducts: result.result.syncedProducts,
        createdProducts: result.result.createdProducts,
        updatedProducts: result.result.updatedProducts,
        errorCount: result.result.errorCount,
        errors: result.result.errors,
        timestamp: new Date().toISOString(),
      },
    }

    console.log("✅ Prueba de sincronización completada:", response.data)

    res.json(response)
  } catch (error: any) {
    console.error("❌ Error en prueba de sincronización:", error)
    
    res.status(500).json({
      success: false,
      message: "Error en prueba de sincronización hacia ODOO",
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  res.json({
    success: true,
    message: "Endpoint de prueba de sincronización con ODOO",
    usage: {
      method: "POST",
      endpoint: "/store/test-odoo-sync",
      body: {
        limit: "number (opcional, default: 2)"
      }
    }
  })
}



