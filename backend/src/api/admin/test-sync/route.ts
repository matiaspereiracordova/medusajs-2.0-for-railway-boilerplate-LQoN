import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncToOdooWorkflow from "../../../workflows/sync-to-odoo.js"

/**
 * Endpoint para probar sincronización manual (simula el subscriber)
 * POST /admin/test-sync
 * Body: { productId: string }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    console.log('🧪 Probando sincronización manual...')
    
    const { productId } = (req.body as any) || {}

    if (!productId) {
      res.status(400).json({
        success: false,
        message: "productId es requerido"
      })
      return
    }

    console.log(`🎯 Sincronizando producto: ${productId}`)

    // Ejecutar el mismo workflow que usa el subscriber
    const result = await syncToOdooWorkflow(req.scope).run({
      input: {
        productIds: [productId],
        limit: 1,
        offset: 0,
      },
    })

    console.log('✅ Sincronización completada')
    console.log(`   - Productos sincronizados: ${result.result.syncedProducts}`)
    console.log(`   - Productos creados: ${result.result.createdProducts}`)
    console.log(`   - Productos actualizados: ${result.result.updatedProducts}`)
    console.log(`   - Errores: ${result.result.errorCount}`)

    res.json({
      success: true,
      message: "Sincronización de producto ejecutada",
      result: {
        syncedProducts: result.result.syncedProducts,
        createdProducts: result.result.createdProducts,
        updatedProducts: result.result.updatedProducts,
        errorCount: result.result.errorCount,
        errors: result.result.errors
      }
    })

  } catch (error: any) {
    console.error("❌ Error ejecutando sincronización:", error)
    res.status(500).json({
      success: false,
      message: "Error ejecutando sincronización de producto",
      error: error.message,
      stack: error.stack
    })
  }
}
