import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncPricesToOdooWorkflow from "../../../workflows/sync-prices-to-odoo-simple.js"

/**
 * Endpoint para sincronizar precios de MedusaJS a Odoo
 * POST /admin/sync-prices-to-odoo
 * Body: { productIds?: string[], limit?: number, offset?: number }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    console.log('🚀 Ejecutando sincronización de precios a Odoo...')
    
    const { productIds, limit = 10, offset = 0 } = (req.body as any) || {}

    if (productIds && productIds.length > 0) {
      console.log(`🎯 Sincronizando productos específicos: ${productIds.join(', ')}`)
    } else {
      console.log(`📦 Sincronizando todos los productos (limit: ${limit}, offset: ${offset})`)
    }

    // Ejecutar el workflow de sincronización
    const { result } = await syncPricesToOdooWorkflow(req.scope).run({
      input: {
        productIds: productIds || undefined,
        limit,
        offset
      }
    })

    console.log('✅ Sincronización completada')
    console.log(`   - Productos sincronizados: ${result.syncedProducts}`)
    console.log(`   - Variantes sincronizadas: ${result.syncedVariants}`)
    console.log(`   - Precios actualizados: ${result.syncedPrices}`)
    console.log(`   - Errores: ${result.errorCount}`)

    res.json({
      success: true,
      message: "Sincronización de precios a Odoo ejecutada",
      result: {
        syncedProducts: result.syncedProducts,
        syncedVariants: result.syncedVariants,
        syncedPrices: result.syncedPrices,
        errorCount: result.errorCount,
        errors: result.errors
      }
    })

  } catch (error: any) {
    console.error("❌ Error ejecutando sincronización:", error)
    res.status(500).json({
      success: false,
      message: "Error ejecutando sincronización de precios a Odoo",
      error: error.message,
      stack: error.stack
    })
  }
}