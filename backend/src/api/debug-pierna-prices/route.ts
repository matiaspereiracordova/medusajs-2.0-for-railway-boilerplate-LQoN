import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IProductModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] 🔍 DEBUG: Iniciando diagnóstico de precios del producto "pierna"`)

    // Buscar el producto "pierna" por nombre
    const productModuleService: IProductModuleService = req.scope.resolve(
      ModuleRegistrationName.PRODUCT
    )
    const pricingModuleService: IPricingModuleService = req.scope.resolve(
      ModuleRegistrationName.PRICING
    )

    const products = await productModuleService.listProducts({
      title: "pierna"
    }, {
      relations: ["variants"],
      take: 1
    })

    if (products.length === 0) {
      console.log(`[${timestamp}] ❌ DEBUG: No se encontró producto "pierna"`)
      res.status(404).json({
        success: false,
        message: "Producto 'pierna' no encontrado",
        timestamp
      })
      return
    }

    const product = products[0]
    console.log(`[${timestamp}] 📦 DEBUG: Producto encontrado - "${product.title}" (${product.status})`)
    console.log(`[${timestamp}] 📦 DEBUG: ID: ${product.id}, Variants: ${product.variants?.length || 0}`)

    // Obtener todos los precios del sistema
    const allPrices = await pricingModuleService.listPrices()
    console.log(`[${timestamp}] 💰 DEBUG: Total de precios en el sistema: ${allPrices.length}`)

    // Mostrar información detallada de precios
    const priceInfo = []
    if (product.variants && product.variants.length > 0) {
      console.log(`[${timestamp}] 💰 DEBUG: Información de precios:`)
      for (const [index, variant] of product.variants.entries()) {
        console.log(`[${timestamp}]   Variant ${index + 1}: ${variant.title}`)
        console.log(`[${timestamp}]   - SKU: ${variant.sku}`)
        
        // Buscar precios para esta variante
        const variantPrices = allPrices.filter((price: any) => {
          return price.variant_id === variant.id || 
                 (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
                 price.price_set_id === variant.id ||
                 (price.price_set && price.price_set.variant_id === variant.id)
        })
        
        console.log(`[${timestamp}]   - Precios encontrados: ${variantPrices.length}`)
        if (variantPrices.length > 0) {
          variantPrices.forEach((price: any, priceIndex: number) => {
            console.log(`[${timestamp}]     ${priceIndex + 1}. ${price.currency_code}: ${price.amount} centavos ($${Number(price.amount) / 100})`)
          })
        }

        priceInfo.push({
          title: variant.title,
          sku: variant.sku,
          prices: variantPrices.map((price: any) => ({
            currency: price.currency_code,
            amount: price.amount,
            amount_dollars: (Number(price.amount) / 100).toFixed(2)
          }))
        })
      }
    }

    // Mostrar algunos precios del sistema para debug
    console.log(`[${timestamp}] 🔍 DEBUG: Primeros 5 precios del sistema:`)
    allPrices.slice(0, 5).forEach((price: any, index: number) => {
      console.log(`[${timestamp}]   ${index + 1}. ID: ${price.id}, Variant: ${price.variant_id}, Currency: ${price.currency_code}, Amount: ${price.amount}`)
    })

    const response = {
      success: true,
      message: "Diagnóstico de precios del producto 'pierna' completado",
      data: {
        product: {
          id: product.id,
          title: product.title,
          status: product.status,
          variants: product.variants?.length || 0
        },
        priceInfo,
        systemInfo: {
          totalPrices: allPrices.length,
          samplePrices: allPrices.slice(0, 3).map((price: any) => ({
            id: price.id,
            variant_id: price.variant_id,
            currency_code: price.currency_code,
            amount: price.amount
          }))
        },
        timestamp
      },
    }

    console.log(`[${timestamp}] ✅ DEBUG: Diagnóstico completado`)

    res.json(response)
  } catch (error: any) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ❌ DEBUG: Error en diagnóstico del producto "pierna":`, error)
    
    res.status(500).json({
      success: false,
      message: "Error en diagnóstico del producto 'pierna'",
      error: error.message,
      timestamp
    })
  }
}
