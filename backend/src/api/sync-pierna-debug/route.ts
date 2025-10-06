import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IProductModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] 🧪 DEBUG-SYNC: Iniciando análisis de precios para el producto "pierna"`)

    const productModuleService: IProductModuleService = req.scope.resolve(
      ModuleRegistrationName.PRODUCT
    )
    const pricingModuleService: IPricingModuleService = req.scope.resolve(
      ModuleRegistrationName.PRICING
    )

    // 1. Obtener producto "pierna" de Medusa
    console.log(`[${timestamp}] 🔍 DEBUG-SYNC: Buscando producto "pierna" en Medusa...`)
    const products = await productModuleService.listProducts({
      title: "pierna"
    }, {
      relations: ["variants"],
      take: 1
    })

    if (products.length === 0) {
      const errorMsg = "Producto 'pierna' no encontrado en Medusa"
      console.error(`[${timestamp}] ❌ DEBUG-SYNC: ${errorMsg}`)
      
      res.json({
        success: false,
        message: "Producto 'pierna' no encontrado en Medusa",
        data: { timestamp }
      })
      return
    }

    const product = products[0]
    console.log(`[${timestamp}] 📦 DEBUG-SYNC: Producto Medusa encontrado: "${product.title}" (ID: ${product.id}, Status: ${product.status})`)
    console.log(`[${timestamp}] 📦 DEBUG-SYNC: Variants: ${product.variants?.length || 0}`)

    // 2. Obtener todos los precios del sistema
    const allPrices = await pricingModuleService.listPrices()
    console.log(`[${timestamp}] 💰 DEBUG-SYNC: Total de precios en el sistema: ${allPrices.length}`)

    // 3. Analizar precios del producto "pierna"
    console.log(`[${timestamp}] 💰 DEBUG-SYNC: Analizando precios para "${product.title}"...`)
    
    const priceInfo = product.variants?.map(variant => {
      const variantPrices = allPrices.filter((price: any) => {
        return price.variant_id === variant.id || 
               (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
               price.price_set_id === variant.id ||
               (price.price_set && price.price_set.variant_id === variant.id)
      })
      
      console.log(`[${timestamp}] 💰 DEBUG-SYNC: Variant "${variant.title}" tiene ${variantPrices.length} precios`)
      
      if (variantPrices.length > 0) {
        variantPrices.forEach((price: any, priceIndex: number) => {
          console.log(`[${timestamp}] 💰 DEBUG-SYNC:   ${priceIndex + 1}. ${price.currency_code}: ${price.amount} centavos ($${(price.amount / 100).toFixed(2)})`)
        })
      }
      
      return {
        title: variant.title,
        sku: variant.sku,
        prices: variantPrices.map((price: any) => ({
          currency: price.currency_code,
          amount: price.amount,
          amount_dollars: (price.amount / 100).toFixed(2)
        }))
      }
    }) || []

    // 4. Información de diagnóstico
    const diagnosticInfo = {
      totalPricesInSystem: allPrices.length,
      productHasVariants: (product.variants?.length || 0) > 0,
      variantsWithPrices: priceInfo.filter(v => v.prices.length > 0).length,
      totalVariantPrices: priceInfo.reduce((sum, v) => sum + v.prices.length, 0)
    }

    console.log(`[${timestamp}] 📊 DEBUG-SYNC: Información de diagnóstico:`, diagnosticInfo)

    const response = {
      success: true,
      message: "Análisis de precios del producto 'pierna' completado",
      data: {
        product: {
          id: product.id,
          title: product.title,
          status: product.status,
          variants: product.variants?.length || 0
        },
        priceInfo,
        diagnosticInfo,
        timestamp,
      },
    }

    console.log(`[${timestamp}] ✅ DEBUG-SYNC: Análisis completado para "pierna"`)
    res.json(response)
  } catch (error: any) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ❌ DEBUG-SYNC: Error en análisis del producto "pierna":`, error)
    res.status(500).json({
      success: false,
      message: "Error en análisis del producto 'pierna'",
      error: error.message,
      timestamp,
    })
  }
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  res.json({
    success: true,
    message: "Endpoint de análisis de precios para el producto 'pierna'",
    usage: {
      method: "POST",
      endpoint: "/sync-pierna-debug",
      description: "Analiza los precios del producto 'pierna' en MedusaJS"
    }
  })
}