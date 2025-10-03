import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import debugPricesWorkflow from "../../../workflows/debug-prices.js"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { productId, variantId } = req.body as {
      productId?: string
      variantId?: string
    }

    console.log("🔍 Iniciando debug de precios...")
    console.log(`📋 Parámetros: productId=${productId}, variantId=${variantId}`)

    const result = await debugPricesWorkflow(req.scope).run({
      input: {
        productId,
        variantId,
      },
    })

    const response = {
      success: true,
      message: "Debug de precios completado",
      data: {
        totalPrices: result.result.totalPrices,
        totalVariants: (result.result as any).totalVariants,
        variantsWithPrices: result.result.variantsWithPrices,
        variantPrices: result.result.variantPrices,
        timestamp: new Date().toISOString(),
      },
    }

    console.log("✅ Debug de precios completado:", response.data)

    res.json(response)
  } catch (error: any) {
    console.error("❌ Error en debug de precios:", error)
    
    res.status(500).json({
      success: false,
      message: "Error en debug de precios",
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
    message: "Endpoint de debug de precios",
    usage: {
      method: "POST",
      endpoint: "/admin/debug-prices",
      body: {
        productId: "string (opcional) - ID del producto específico",
        variantId: "string (opcional) - ID del variant específico"
      }
    }
  })
}
