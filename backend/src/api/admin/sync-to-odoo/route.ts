import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncToOdooWorkflow from "../../../workflows/sync-to-odoo.js"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { productIds, limit = 10, offset = 0 } = req.body as {
      productIds?: string[]
      limit?: number
      offset?: number
    }

    console.log("🔄 Iniciando sincronización manual hacia ODOO...")

    const result = await syncToOdooWorkflow(req.scope).run({
      input: {
        productIds,
        limit,
        offset,
      },
    })

    res.json({
      success: true,
      message: "Sincronización completada exitosamente",
      data: {
        syncedProducts: result.result.syncedProducts,
        createdProducts: result.result.createdProducts,
        updatedProducts: result.result.updatedProducts,
      },
    })
  } catch (error: any) {
    console.error("❌ Error en sincronización manual:", error)
    res.status(500).json({
      success: false,
      message: "Error en sincronización hacia ODOO",
      error: error.message,
    })
  }
}
