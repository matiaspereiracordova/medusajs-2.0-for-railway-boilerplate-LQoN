import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncPricesToOdooWorkflow from "../../../workflows/sync-prices-to-odoo.js"
import { IProductModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] 🧪 PRICE-TEST: Iniciando sincronización de precios del producto "pierna"`)

    // Buscar el producto "pierna" por nombre
    const productModuleService: IProductModuleService = req.scope.resolve(
      ModuleRegistrationName.PRODUCT
    )

    const products = await productModuleService.listProducts({
      title: "pierna"
    }, {
      relations: ["variants", "variants.prices"],
      take: 1
    })

    if (products.length === 0) {
      console.log(`[${timestamp}] ❌ PRICE-TEST: No se encontró producto "pierna"`)
      res.status(404).json({
        success: false,
        message: "Producto 'pierna' no encontrado",
        timestamp
      })
      return
    }

    const product = products[0]
    console.log(`[${timestamp}] 📦 PRICE-TEST: Producto encontrado - "${product.title}" (${product.status})`)
    console.log(`[${timestamp}] 📦 PRICE-TEST: ID: ${product.id}, Variants: ${product.variants?.length || 0}`)

    // Mostrar información detallada de precios
    if (product.variants && product.variants.length > 0) {
      console.log(`[${timestamp}] 💰 PRICE-TEST: Información de precios:`)
      product.variants.forEach((variant, index) => {
        console.log(`[${timestamp}]   Variant ${index + 1}: ${variant.title}`)
        console.log(`[${timestamp}]   - SKU: ${variant.sku}`)
        console.log(`[${timestamp}]   - Precios: ${variant.prices?.length || 0}`)
        if (variant.prices && variant.prices.length > 0) {
          variant.prices.forEach((price: any, priceIndex: number) => {
            console.log(`[${timestamp}]     ${priceIndex + 1}. ${price.currency_code}: ${price.amount} centavos ($${(price.amount / 100).toFixed(2)})`)
          })
        }
      })
    }

    // Ejecutar sincronización específica de precios
    console.log(`[${timestamp}] 🚀 PRICE-TEST: Ejecutando sincronización de precios con Odoo...`)
    const result = await syncPricesToOdooWorkflow(req.scope).run({
      input: {
        productIds: [product.id],
        limit: 1,
        offset: 0,
      },
    })

    const response = {
      success: true,
      message: "Sincronización de precios del producto 'pierna' completada",
      data: {
        product: {
          id: product.id,
          title: product.title,
          status: product.status,
          variants: product.variants?.length || 0
        },
        priceInfo: product.variants?.map(variant => ({
          title: variant.title,
          sku: variant.sku,
          prices: variant.prices?.map((price: any) => ({
            currency: price.currency_code,
            amount: price.amount,
            amount_dollars: (price.amount / 100).toFixed(2)
          })) || []
        })) || [],
        syncResult: {
          syncedProducts: result.result.syncedProducts,
          syncedVariants: result.result.syncedVariants,
          syncedPrices: result.result.syncedPrices,
          errorCount: result.result.errorCount,
          errors: result.result.errors,
          totalPricesInSystem: result.result.totalPricesInSystem
        },
        timestamp
      },
    }

    console.log(`[${timestamp}] ✅ PRICE-TEST: Sincronización de precios completada:`, response.data.syncResult)

    res.json(response)
  } catch (error: any) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ❌ PRICE-TEST: Error en sincronización de precios del producto "pierna":`, error)
    
    res.status(500).json({
      success: false,
      message: "Error sincronizando precios del producto 'pierna'",
      error: error.message,
      timestamp
    })
  }
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  res.json({
    success: true,
    message: "Endpoint de prueba para sincronizar precios del producto 'pierna'",
    usage: {
      method: "POST",
      endpoint: "/admin/sync-pierna-prices",
      description: "Sincroniza específicamente los precios del producto 'pierna' con Odoo"
    }
  })
}
