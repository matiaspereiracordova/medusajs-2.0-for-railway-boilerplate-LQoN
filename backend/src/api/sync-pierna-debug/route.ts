import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncPiernaPricesWorkflow from "../../../workflows/sync-pierna-debug.js"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] 🔍 PIERNA-SYNC: Iniciando sincronización de debug del producto "pierna"`)

    const result = await syncPiernaPricesWorkflow(req.scope).run({
      input: {}
    })

    const response = {
      success: result.result.success,
      message: result.result.message,
      data: {
        syncedProducts: result.result.syncedProducts,
        syncedVariants: result.result.syncedVariants,
        syncedPrices: result.result.syncedPrices,
        errorCount: result.result.errorCount,
        errors: result.result.errors,
        timestamp
      },
    }

    console.log(`[${timestamp}] ✅ PIERNA-SYNC: Sincronización completada:`, response.data)

    res.json(response)
  } catch (error: any) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ❌ PIERNA-SYNC: Error en sincronización:`, error)
    
    res.status(500).json({
      success: false,
      message: "Error en sincronización del producto 'pierna'",
      error: error.message,
      timestamp
    })
  }
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  res.json({
    success: true,
    message: "Endpoint de sincronización de debug para el producto 'pierna'",
    usage: {
      method: "POST",
      endpoint: "/sync-pierna-debug",
      description: "Sincroniza específicamente el producto 'pierna' con debug detallado"
    }
  })
}
