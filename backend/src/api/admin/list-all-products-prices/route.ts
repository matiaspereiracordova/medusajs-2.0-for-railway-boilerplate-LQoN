import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IRegionModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Endpoint para listar TODOS los productos con sus precios CALCULADOS (como el storefront)
 * GET /admin/list-all-products-prices?regionId=reg_xxx
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    console.log('📋 Listando todos los productos con precios calculados...')

    const { regionId } = req.query as { regionId?: string }
    const query = req.scope.resolve("query")

    // Si no hay regionId, obtener la primera región disponible
    let selectedRegionId = regionId
    
    if (!selectedRegionId) {
      const regionsResult = await query.graph({
        entity: "region",
        fields: ["id"],
        pagination: { take: 1 }
      })
      
      const regions = regionsResult.data || []
      
      if (regions.length > 0) {
        selectedRegionId = regions[0].id
        console.log(`ℹ️ No se especificó regionId, usando: ${selectedRegionId}`)
      } else {
        res.status(400).json({
          success: false,
          message: "No hay regiones disponibles en el sistema"
        })
        return
      }
    }

    console.log('🔍 Obteniendo productos con variantes incluyendo price_set_id...')

    // Obtener productos con variants y sus price_set_id
    const productsResult = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "status",
        "variants.id",
        "variants.title",
        "variants.sku",
        "variants.price_set.id",
        "variants.price_set.prices.*"
      ],
      filters: {
        status: "published"
      },
      pagination: {
        take: 100
      }
    })

    const products = productsResult.data || []
    console.log(`✅ Productos recibidos: ${products?.length || 0}`)
    
    // Obtener la región para el currency_code
    const regionModuleService: IRegionModuleService = req.scope.resolve(Modules.REGION)
    const region = await regionModuleService.retrieveRegion(selectedRegionId)
    const currencyCode = region.currency_code?.toLowerCase() || 'clp'
    
    console.log(`💰 Buscando precios para región ${selectedRegionId} con currency: ${currencyCode}`)

    // Procesar cada producto
    const productSummary = []

    for (const product of products || []) {
      const variantsWithPrices = []

      for (const variant of product.variants || []) {
        let hasCalculatedPrice = false
        let priceAmount = 0
        
        // Buscar precio en el price_set de la variante
        if (variant.price_set && variant.price_set.prices) {
          const pricesForCurrency = variant.price_set.prices.filter(
            (p: any) => p.currency_code?.toLowerCase() === currencyCode
          )
          
          if (pricesForCurrency.length > 0 && pricesForCurrency[0].amount) {
            hasCalculatedPrice = true
            // Los precios ya vienen en la unidad correcta (no en centavos)
            priceAmount = Number(pricesForCurrency[0].amount)
          }
        }

        variantsWithPrices.push({
          id: variant.id,
          title: variant.title || 'Sin título',
          sku: variant.sku || 'Sin SKU',
          hasPrices: hasCalculatedPrice,
          priceCount: hasCalculatedPrice ? 1 : 0,
          prices: hasCalculatedPrice ? [{
            currency: currencyCode.toUpperCase(),
            amount: priceAmount,
            formatted: `$${priceAmount.toLocaleString('es-CL')}`
          }] : []
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
      totalProducts: productSummary.length,
      productsWithPricing: productSummary.filter(p => p.variantsWithoutPrices === 0).length,
      productsWithIssues: productSummary.filter(p => p.hasPricingIssue).length,
      totalPricesInSystem: productSummary.reduce((sum, p) => sum + p.variantsWithPrices, 0)
    }

    // Separar productos con y sin problemas
    const productsOK = productSummary.filter(p => !p.hasPricingIssue)
    const productsWithIssues = productSummary.filter(p => p.hasPricingIssue)

    res.json({
      success: true,
      regionId: selectedRegionId,
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
      error: error.message,
      stack: error.stack
    })
  }
}

