import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

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

    // Si no hay regionId, obtener la primera región disponible
    let selectedRegionId = regionId
    
    if (!selectedRegionId) {
      const regionModuleService: IRegionModuleService = req.scope.resolve(
        ModuleRegistrationName.REGION
      )
      
      const regions = await regionModuleService.listRegions({}, { take: 1 })
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

    // Hacer una petición HTTP al Store API (como hace el storefront)
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:9000'
    const url = `${baseUrl}/store/products?region_id=${selectedRegionId}&fields=*variants.calculated_price&limit=100`

    console.log('📡 Haciendo petición a Store API:', url)

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error en Store API:', errorText)
      res.status(response.status).json({
        success: false,
        message: "Error al consultar Store API",
        error: errorText
      })
      return
    }

    const data = await response.json()
    console.log(`✅ Productos recibidos: ${data.products?.length || 0}`)

    // Procesar cada producto
    const productSummary = []

    for (const product of data.products || []) {
      const variantsWithPrices = []

      for (const variant of product.variants || []) {
        const hasCalculatedPrice = !!variant.calculated_price?.calculated_amount
        const priceAmount = hasCalculatedPrice 
          ? Number(variant.calculated_price.calculated_amount) / 100 
          : 0

        variantsWithPrices.push({
          id: variant.id,
          title: variant.title || 'Sin título',
          sku: variant.sku || 'Sin SKU',
          hasPrices: hasCalculatedPrice,
          priceCount: hasCalculatedPrice ? 1 : 0,
          prices: hasCalculatedPrice ? [{
            currency: variant.calculated_price.currency_code?.toUpperCase() || 'CLP',
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
      storeApiUrl: url,
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

