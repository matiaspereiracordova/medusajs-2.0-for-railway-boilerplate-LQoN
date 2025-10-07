import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IProductModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const productModuleService: IProductModuleService = req.scope.resolve(
      ModuleRegistrationName.PRODUCT
    )

    const { limit = 50, offset = 0 } = req.query as {
      limit?: string
      offset?: string
    }

    console.log("🔍 Listando productos de Medusa...")

    const products = await productModuleService.listProducts(
      {},
      {
        relations: ["variants", "variants.options", "categories", "tags", "images"],
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }
    )

    const productsWithVariantInfo = products.map(product => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      variants: product.variants?.map(variant => ({
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        options: variant.options || [],
        hasCalculatedPrice: !!variant.calculated_price,
        calculatedPrice: variant.calculated_price
      })) || [],
      images: product.images?.length || 0,
      thumbnail: !!product.thumbnail
    }))

    console.log(`✅ Encontrados ${products.length} productos`)

    res.json({
      success: true,
      count: products.length,
      products: productsWithVariantInfo
    })
  } catch (error: any) {
    console.error("❌ Error listando productos:", error)
    
    res.status(500).json({
      success: false,
      message: "Error obteniendo productos",
      error: error.message,
    })
  }
}
