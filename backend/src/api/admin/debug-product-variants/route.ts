import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IProductModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

/**
 * Debug endpoint para inspeccionar la estructura de productos y variantes
 * GET /admin/debug-product-variants?title=Pantalones cortos
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { title, id } = req.query as { title?: string; id?: string }

    if (!title && !id) {
      res.status(400).json({
        success: false,
        message: "Proporciona 'title' o 'id' como query parameter",
        example: "/admin/debug-product-variants?title=Pantalones cortos"
      })
      return
    }

    const productModuleService: IProductModuleService = req.scope.resolve(
      ModuleRegistrationName.PRODUCT
    )

    let products: any[] = []

    if (id) {
      console.log(`🔍 Buscando producto por ID: ${id}`)
    const product = await productModuleService.retrieveProduct(id, {
      relations: ["variants", "variants.options", "variants.prices", "options", "images"],
    })
      products = [product]
    } else {
      console.log(`🔍 Buscando productos con título: "${title}"`)
      const allProducts = await productModuleService.listProducts(
        {},
        {
          relations: ["variants", "variants.options", "variants.prices", "options", "images"],
          take: 100,
        }
      )

      products = allProducts.filter((p: any) =>
        p.title.toLowerCase().includes(title!.toLowerCase())
      )
    }

    if (products.length === 0) {
      res.json({
        success: false,
        message: `No se encontraron productos${title ? ` con título "${title}"` : ""}`,
        found: 0,
      })
      return
    }

    console.log(`✅ Productos encontrados: ${products.length}`)

    // Preparar respuesta con información detallada
    const response = products.map((product: any) => {
      const variants = product.variants || []
      
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        totalVariants: variants.length,
        productOptions: product.options || [],
        variants: variants.map((variant: any) => ({
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          options: variant.options || [],
          hasOptions: !!(variant.options && variant.options.length > 0),
          optionsCount: variant.options?.length || 0,
        })),
        debug: {
          hasProductOptions: !!(product.options && product.options.length > 0),
          productOptionsCount: product.options?.length || 0,
          firstVariantStructure: variants[0] ? {
            keys: Object.keys(variants[0]),
            optionsType: typeof variants[0].options,
            optionsIsArray: Array.isArray(variants[0].options),
          } : null,
        }
      }
    })

    console.log(`📊 Datos del producto preparados`)
    console.log(JSON.stringify(response, null, 2))

    res.json({
      success: true,
      message: `Encontrados ${products.length} producto(s)`,
      data: response,
    })
  } catch (error: any) {
    console.error("❌ Error en debug de producto:", error)
    
    res.status(500).json({
      success: false,
      message: "Error obteniendo información del producto",
      error: error.message,
    })
  }
}

