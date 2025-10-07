import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

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

    console.log('🔍 Obteniendo productos con precios calculados para región:', selectedRegionId)

    // Usar query.graph pero solo para productos base (sin calculated_price)
    const productsResult = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "status",
        "variants.*"
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
    
    // Ahora obtener precios usando el pricing service para cada variante
    const pricingModuleService = req.scope.resolve("pricingModuleService")
    const regionModuleService = req.scope.resolve("regionModuleService")
    
    // Obtener la región completa para el currency_code
    const region = await regionModuleService.retrieveRegion(selectedRegionId)
    const currencyCode = region.currency_code?.toLowerCase() || 'clp'
    
    console.log(`💰 Calculando precios para región ${selectedRegionId} con currency: ${currencyCode}`)

    // Procesar cada producto
    const productSummary = []

    for (const product of products || []) {
      const variantsWithPrices = []

      for (const variant of product.variants || []) {
        let hasCalculatedPrice = false
        let priceAmount = 0
        
        try {
          // Intentar calcular el precio para esta variante
          if (variant.id) {
            const priceResult = await pricingModuleService.calculatePrices(
              { id: [variant.id] },
              {
                context: {
                  currency_code: currencyCode,
                  region_id: selectedRegionId
                }
              }
            )
            
            if (priceResult && priceResult[variant.id]?.calculated_amount) {
              hasCalculatedPrice = true
              priceAmount = Number(priceResult[variant.id].calculated_amount) / 100
            }
          }
        } catch (error) {
          console.error(`Error calculando precio para variante ${variant.id}:`, error.message)
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

