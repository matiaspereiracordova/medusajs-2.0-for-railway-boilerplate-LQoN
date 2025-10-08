import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncPricesToOdooImprovedWorkflow from "../../../workflows/sync-prices-to-odoo-improved.js"

/**
 * Endpoint para ejecutar sincronización de precios SIN autenticación
 * GET /admin/sync-prices-now?limit=10
 * 
 * Este endpoint ejecuta la sincronización de precios inmediatamente
 * y es útil para testing y ejecución manual
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] 🚀 SYNC-NOW: Ejecutando sincronización manual de precios...`)

    const { limit, productIds } = req.query as { 
      limit?: string
      productIds?: string
    }

    // Parsear productIds si viene como string separado por comas
    const parsedProductIds = productIds 
      ? productIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
      : undefined

    const parsedLimit = limit ? parseInt(limit) : 10

    console.log(`[${timestamp}] 📋 SYNC-NOW: Parámetros:`, {
      productIds: parsedProductIds,
      limit: parsedLimit
    })

    // Ejecutar el workflow mejorado de sincronización de precios
    const result = await syncPricesToOdooImprovedWorkflow(req.scope).run({
      input: {
        productIds: parsedProductIds,
        limit: parsedLimit,
        offset: 0,
      },
    })

    console.log(`[${timestamp}] ✅ SYNC-NOW: Sincronización completada`)
    console.log(`[${timestamp}]    - Productos procesados: ${result.result.syncedProducts}`)
    console.log(`[${timestamp}]    - Variantes sincronizadas: ${result.result.syncedVariants}`)
    console.log(`[${timestamp}]    - Total precios sincronizados: ${result.result.syncedPrices}`)
    console.log(`[${timestamp}]    - Errores: ${result.result.errorCount}`)

    res.json({
      success: true,
      message: "Sincronización de precios ejecutada exitosamente",
      timestamp,
      params: {
        productIds: parsedProductIds,
        limit: parsedLimit
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
    console.error(`[${timestamp}] ❌ SYNC-NOW: Error en sincronización:`, error)
    res.status(500).json({
      success: false,
      message: "Error en sincronización de precios",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp
    })
  }
}
