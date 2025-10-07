import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Endpoint para depurar precios calculados usando Store API (como hace el storefront)
 * GET /admin/debug-calculated-prices?productId=prod_xxx&regionId=reg_xxx
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { productId, regionId } = req.query as { productId?: string; regionId?: string }

    console.log('🔍 Depurando precios calculados...')
    console.log('Product ID:', productId)
    console.log('Region ID:', regionId)

    // Si no hay regionId, obtener la primera región disponible
    let selectedRegionId = regionId
    
    if (!selectedRegionId) {
      const { IRegionModuleService } = await import("@medusajs/framework/types")
      const { ModuleRegistrationName } = await import("@medusajs/framework/utils")
      
      const regionModuleService: IRegionModuleService = req.scope.resolve(
        ModuleRegistrationName.REGION
      )
      
      const regions = await regionModuleService.listRegions({ take: 1 })
      if (regions.length > 0) {
        selectedRegionId = regions[0].id
        console.log(`ℹ️ No se especificó regionId, usando: ${selectedRegionId}`)
      } else {
        return res.status(400).json({
          success: false,
          message: "No hay regiones disponibles en el sistema"
        })
      }
    }

    // Hacer una petición HTTP al Store API (como hace el storefront)
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:9000'
    
    let url = `${baseUrl}/store/products?region_id=${selectedRegionId}&fields=*variants.calculated_price`
    if (productId) {
      url += `&id[]=${productId}`
    }

    console.log('📡 Haciendo petición a Store API:', url)

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error en Store API:', errorText)
      return res.status(response.status).json({
        success: false,
        message: "Error al consultar Store API",
        error: errorText
      })
    }

    const data = await response.json()
    console.log('✅ Respuesta de Store API recibida')

    // Procesar los productos
    const processedProducts = data.products.map((product: any) => {
      const variants = product.variants?.map((variant: any) => ({
        id: variant.id,
        title: variant.title,
        sku: variant.sku,
        calculated_price: variant.calculated_price ? {
          currency_code: variant.calculated_price.currency_code,
          calculated_amount: variant.calculated_price.calculated_amount,
          calculated_amount_formatted: variant.calculated_price.calculated_amount 
            ? `$${(Number(variant.calculated_price.calculated_amount) / 100).toLocaleString('es-CL')}` 
            : '$0',
          original_amount: variant.calculated_price.original_amount,
          has_price: !!variant.calculated_price.calculated_amount
        } : null,
        has_calculated_price: !!variant.calculated_price?.calculated_amount
      })) || []

      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        totalVariants: variants.length,
        variantsWithCalculatedPrice: variants.filter((v: any) => v.has_calculated_price).length,
        variantsWithoutCalculatedPrice: variants.filter((v: any) => !v.has_calculated_price).length,
        variants
      }
    })

    res.json({
      success: true,
      regionId: selectedRegionId,
      storeApiUrl: url,
      totalProducts: processedProducts.length,
      products: processedProducts,
      rawResponse: data
    })

  } catch (error: any) {
    console.error(`❌ Error en debug-calculated-prices:`, error)
    res.status(500).json({
      success: false,
      message: "Error depurando precios calculados",
      error: error.message,
      stack: error.stack
    })
  }
}

