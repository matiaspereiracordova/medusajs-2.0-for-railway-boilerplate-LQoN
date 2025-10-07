import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncPricesStoreApiWorkflow from "../../../workflows/sync-prices-store-api.js"

/**
 * Endpoint de prueba rápida
 * POST /admin/test-sync-now
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log('🧪 TEST-SYNC: Iniciando sincronización de prueba...')

    const { productIds } = req.body as { productIds?: string[] }

    const result = await syncPricesStoreApiWorkflow(req.scope).run({
      input: {
        productIds: productIds || ['prod_01K6FVD1BY2CG2PT0JCVM4D8P1'], // Pantalones cortos por defecto
        limit: 10,
      },
    })

    res.json({
      success: true,
      message: "Sincronización de prueba completada",
      result: result.result
    })

  } catch (error: any) {
    console.error('❌ TEST-SYNC: Error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json({
    message: "Endpoint de prueba de sincronización",
    usage: "POST /admin/test-sync-now con body: { productIds: [...] }"
  })
}

