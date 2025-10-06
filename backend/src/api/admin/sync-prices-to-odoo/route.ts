import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncPricesToOdooWorkflow from "../../../workflows/sync-prices-to-odoo.js"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const timestamp = new Date().toISOString()
    const { productIds, limit = 10, offset = 0 } = req.body as {
      productIds?: string[]
      limit?: number
      offset?: number
    }

    console.log(`[${timestamp}] 💰 PRICE-API: Iniciando sincronización de precios hacia ODOO...`)
    console.log(`[${timestamp}] 📋 PRICE-API: Parámetros:`, { limit, offset, productIds })

    const result = await syncPricesToOdooWorkflow(req.scope).run({
      input: {
        productIds,
        limit,
        offset,
      },
    })

    const response = {
      success: true,
      message: "Sincronización de precios completada exitosamente",
      data: {
        syncedProducts: result.result.syncedProducts,
        syncedVariants: result.result.syncedVariants,
        syncedPrices: result.result.syncedPrices,
        errorCount: result.result.errorCount,
        errors: result.result.errors,
        totalPricesInSystem: result.result.totalPricesInSystem,
        timestamp,
      },
    }

    console.log(`[${timestamp}] ✅ PRICE-API: Sincronización de precios completada:`, response.data)

    res.json(response)
  } catch (error: any) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ❌ PRICE-API: Error en sincronización de precios:`, error)
    
    res.status(500).json({
      success: false,
      message: "Error en sincronización de precios hacia ODOO",
      error: error.message,
      timestamp,
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
        message: "Endpoint de sincronización de precios disponible",
        endpoints: {
          syncPrices: "POST /admin/sync-prices-to-odoo",
          test: "GET /admin/sync-prices-to-odoo?action=test-connection"
        }
      })
      return
    }

    res.json({
      success: true,
      message: "API de sincronización de precios con ODOO",
      usage: {
        method: "POST",
        endpoint: "/admin/sync-prices-to-odoo",
        body: {
          limit: "number (opcional, default: 10)",
          offset: "number (opcional, default: 0)",
          productIds: "string[] (opcional, IDs específicos de productos)"
        },
        description: "Sincroniza precios de productos y variantes desde MedusaJS hacia Odoo"
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
