import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IProductModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

/**
 * Endpoint para listar TODOS los productos con sus precios
 * GET /admin/list-all-products-prices
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log('📋 Listando todos los productos con precios...')

    const productModuleService: IProductModuleService = req.scope.resolve(
      ModuleRegistrationName.PRODUCT
    )
    const pricingModuleService: IPricingModuleService = req.scope.resolve(
      ModuleRegistrationName.PRICING
    )

    // Obtener TODOS los productos
    const products = await productModuleService.listProducts(
      {},
      {
        relations: ["variants"],
        take: 100, // Obtener hasta 100 productos
      }
    )

    console.log(`✅ Productos encontrados: ${products.length}`)

    // Obtener TODOS los precios del sistema
    const allPrices = await pricingModuleService.listPrices()
    console.log(`💰 Total de precios en el sistema: ${allPrices.length}`)

    // Procesar cada producto
    const productSummary = []

    for (const product of products) {
      const variantsWithPrices = []

      for (const variant of product.variants || []) {
        // Buscar precios de esta variante
        const variantPrices = allPrices.filter((price: any) => {
          return price.variant_id === variant.id || 
                 (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
                 price.price_set_id === variant.id ||
                 (price.price_set && price.price_set.variant_id === variant.id)
        })

        // Formatear los precios
        const formattedPrices = variantPrices.map((p: any) => ({
          currency: p.currency_code?.toUpperCase() || 'N/A',
          amount: p.amount ? Number(p.amount) / 100 : 0,
          formatted: p.amount ? `$${(Number(p.amount) / 100).toLocaleString('es-CL')}` : '$0'
        }))

        variantsWithPrices.push({
          id: variant.id,
          title: variant.title || 'Sin título',
          sku: variant.sku || 'Sin SKU',
          hasPrices: variantPrices.length > 0,
          priceCount: variantPrices.length,
          prices: formattedPrices
        })
      }

      // Calcular estadísticas del producto
      const totalVariants = variantsWithPrices.length
      const variantsWithPricing = variantsWithPrices.filter(v => v.hasPrices).length
      const variantsWithoutPricing = totalVariants - variantsWithPricing

      productSummary.push({
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        totalVariants,
        variantsWithPrices: variantsWithPricing,
        variantsWithoutPrices: variantsWithoutPricing,
        hasPricingIssue: variantsWithoutPricing > 0,
        variants: variantsWithPrices
      })
    }

    // Estadísticas generales
    const stats = {
      totalProducts: products.length,
      productsWithPricing: productSummary.filter(p => p.variantsWithoutPrices === 0).length,
      productsWithIssues: productSummary.filter(p => p.hasPricingIssue).length,
      totalPricesInSystem: allPrices.length
    }

    // Separar productos con y sin problemas
    const productsOK = productSummary.filter(p => !p.hasPricingIssue)
    const productsWithIssues = productSummary.filter(p => p.hasPricingIssue)

    res.json({
      success: true,
      stats,
      summary: {
        message: stats.productsWithIssues > 0 
          ? `⚠️ Encontrados ${stats.productsWithIssues} productos con variantes sin precios`
          : `✅ Todos los productos tienen precios asignados`,
        productsOK: productsOK.length,
        productsWithIssues: productsWithIssues.length
      },
      productsOK,
      productsWithIssues,
      allProducts: productSummary
    })

  } catch (error: any) {
    console.error(`❌ Error listando productos:`, error)
    res.status(500).json({
      success: false,
      message: "Error listando productos y precios",
      error: error.message
    })
  }
}

