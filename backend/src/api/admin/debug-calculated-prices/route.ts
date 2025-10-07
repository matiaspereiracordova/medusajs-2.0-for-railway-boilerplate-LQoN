import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Endpoint para depurar precios calculados usando Query Service (como hace el storefront)
 * GET /admin/debug-calculated-prices?productId=prod_xxx&regionId=reg_xxx
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    const query = req.scope.resolve("query")
    const { productId, regionId } = req.query as { productId?: string; regionId?: string }

    console.log('🔍 Depurando precios calculados...')
    console.log('Product ID:', productId)
    console.log('Region ID:', regionId)

    // Si no hay regionId, obtener la primera región disponible con su currency_code
    let selectedRegionId = regionId
    let currencyCode = 'clp'
    
    if (!selectedRegionId) {
      const { data: regions } = await query.graph({
        entity: "region",
        fields: ["id", "currency_code"],
        pagination: { take: 1 }
      })
      
      if (regions && regions.length > 0) {
        selectedRegionId = regions[0].id
        currencyCode = regions[0].currency_code || 'clp'
        console.log(`ℹ️ No se especificó regionId, usando: ${selectedRegionId} con currency: ${currencyCode}`)
      } else {
        res.status(400).json({
          success: false,
          message: "No hay regiones disponibles en el sistema"
        })
        return
      }
    } else {
      // Obtener el currency_code de la región especificada
      const { data: regions } = await query.graph({
        entity: "region",
        fields: ["id", "currency_code"],
        filters: { id: selectedRegionId }
      })
      
      if (regions && regions.length > 0) {
        currencyCode = regions[0].currency_code || 'clp'
        console.log(`ℹ️ Región ${selectedRegionId} con currency: ${currencyCode}`)
      }
    }

    console.log('🔍 Obteniendo productos con precios calculados para región:', selectedRegionId)

    // Usar el query service para obtener productos con calculated_price
    const queryConfig: any = {
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "status",
        "variants.*",
        "variants.calculated_price.*"
      ],
      context: {
        region_id: selectedRegionId,
        currency_code: currencyCode
      },
      pagination: {
        take: 100
      }
    }

    // Si hay productId, filtrar por ese producto
    if (productId) {
      queryConfig.filters = { id: productId }
    }

    const { data: products } = await query.graph(queryConfig)
    console.log('✅ Productos recibidos:', products?.length || 0)

    // Procesar los productos
    const processedProducts = (products || []).map((product: any) => {
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
      totalProducts: processedProducts.length,
      products: processedProducts
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

