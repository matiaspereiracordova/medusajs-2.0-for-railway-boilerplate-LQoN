import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import getVariantPricesAdminWorkflow from "../../../workflows/get-variant-prices-admin.js"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { productId, variantId } = req.body as {
      productId: string
      variantId: string
    }

    if (!variantId) {
      res.status(400).json({
        success: false,
        message: "variantId es requerido",
        timestamp: new Date().toISOString(),
      })
      return
    }

    console.log("🔍 Iniciando obtención de precios para variant...")
    console.log(`📋 Parámetros: productId=${productId}, variantId=${variantId}`)

    const result = await getVariantPricesAdminWorkflow(req.scope).run({
      input: {
        productId: productId || '',
        variantId,
      },
    })

    const response = {
      success: result.result.success,
      message: result.result.success ? "Precios obtenidos correctamente" : "Error obteniendo precios",
      data: {
        variantId: result.result.variantId,
        prices: result.result.prices,
        error: result.result.error,
        timestamp: new Date().toISOString(),
      },
    }

    console.log("✅ Resultado obtenido:", response.data)

    res.json(response)
  } catch (error: any) {
    console.error("❌ Error en obtención de precios:", error)
    
    res.status(500).json({
      success: false,
      message: "Error en obtención de precios",
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
    message: "Endpoint para obtener precios de variant",
    usage: {
      method: "POST",
      endpoint: "/admin/get-variant-prices",
      body: {
        productId: "string (opcional) - ID del producto",
        variantId: "string (requerido) - ID del variant"
      },
      example: {
        productId: "prod_01K6FVD1BY2CG2PT0JCVM4D8P1",
        variantId: "variant_01K6FVD1EDBEMTZZE9VKVW1JYF"
      }
    }
  })
}
