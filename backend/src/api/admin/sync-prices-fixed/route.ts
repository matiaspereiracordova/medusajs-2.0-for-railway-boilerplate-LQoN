import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncPricesToOdooWorkflowFixed from "../../../workflows/sync-prices-to-odoo-fixed.js"

/**
 * Endpoint CORREGIDO para sincronizar precios usando calculated_price
 * POST /admin/sync-prices-fixed
 */
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

    console.log(`[${timestamp}] 💰 PRICE-API-FIXED: Iniciando sincronización CORREGIDA de precios hacia ODOO...`)
    console.log(`[${timestamp}] 📋 PRICE-API-FIXED: Parámetros:`, { limit, offset, productIds })

    const result = await syncPricesToOdooWorkflowFixed(req.scope).run({
      input: {
        productIds,
        limit,
        offset,
      },
    })

    const response = {
      success: true,
      message: "✅ Sincronización de precios completada exitosamente usando calculated_price",
      data: {
        syncedProducts: result.result.syncedProducts,
        syncedVariants: result.result.syncedVariants,
        syncedPrices: result.result.syncedPrices,
        errorCount: result.result.errorCount,
        errors: result.result.errors,
        timestamp,
      },
    }

    console.log(`[${timestamp}] ✅ PRICE-API-FIXED: Sincronización de precios completada:`, response.data)

    res.json(response)
  } catch (error: any) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ❌ PRICE-API-FIXED: Error en sincronización de precios:`, error)
    
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
  res.json({
    success: true,
    message: "🔧 API CORREGIDA de sincronización de precios con ODOO",
    fix: "Este endpoint usa calculated_price en lugar de prices[] para obtener los precios correctos",
    usage: {
      method: "POST",
      endpoint: "/admin/sync-prices-fixed",
      body: {
        limit: "number (opcional, default: 10)",
        offset: "number (opcional, default: 0)",
        productIds: "string[] (opcional, IDs específicos de productos)"
      },
      description: "Sincroniza precios de productos y variantes desde MedusaJS hacia Odoo usando calculated_price"
    }
  })
}

