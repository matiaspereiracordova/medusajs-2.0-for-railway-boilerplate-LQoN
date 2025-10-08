import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncPricesToOdooImprovedWorkflow from "../../../workflows/sync-prices-to-odoo-improved.js"

/**
 * Endpoint de prueba para sincronizar precios a Odoo
 * GET /admin/test-price-sync?productIds=prod_123,prod_456&limit=10
 * 
 * Usa el workflow mejorado que obtiene precios directamente desde price_set
 * (mismo método exitoso del endpoint /admin/list-all-products-prices)
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] 🧪 TEST-PRICE-SYNC: Iniciando prueba de sincronización de precios...`)

    const { productIds, limit, offset, regionId } = req.query as { 
      productIds?: string
      limit?: string
      offset?: string
      regionId?: string
    }

    // Parsear productIds si viene como string separado por comas
    const parsedProductIds = productIds 
      ? productIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
      : undefined

    const parsedLimit = limit ? parseInt(limit) : 10
    const parsedOffset = offset ? parseInt(offset) : 0

    console.log(`[${timestamp}] 📋 TEST-PRICE-SYNC: Parámetros:`, {
      productIds: parsedProductIds,
      limit: parsedLimit,
      offset: parsedOffset,
      regionId: regionId || 'Auto-detect'
    })

    // Ejecutar el workflow mejorado de sincronización de precios
    const result = await syncPricesToOdooImprovedWorkflow(req.scope).run({
      input: {
        productIds: parsedProductIds,
        limit: parsedLimit,
        offset: parsedOffset,
        regionId: regionId
      },
    })

    console.log(`[${timestamp}] ✅ TEST-PRICE-SYNC: Sincronización completada`)
    console.log(`[${timestamp}]    - Productos procesados: ${result.result.syncedProducts}`)
    console.log(`[${timestamp}]    - Variantes sincronizadas: ${result.result.syncedVariants}`)
    console.log(`[${timestamp}]    - Total precios sincronizados: ${result.result.syncedPrices}`)
    console.log(`[${timestamp}]    - Errores: ${result.result.errorCount}`)

    res.json({
      success: true,
      message: "Sincronización de precios completada",
      timestamp,
      params: {
        productIds: parsedProductIds,
        limit: parsedLimit,
        offset: parsedOffset,
        regionId: regionId || 'Auto-detect'
      },
      results: {
        syncedProducts: result.result.syncedProducts,
        syncedVariants: result.result.syncedVariants,
        syncedPrices: result.result.syncedPrices,
        errorCount: result.result.errorCount,
        errors: result.result.errors
      }
    })

  } catch (error: any) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ❌ TEST-PRICE-SYNC: Error en sincronización:`, error)
    res.status(500).json({
      success: false,
      message: "Error en sincronización de precios",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp
    })
  }
}

