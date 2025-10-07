import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import OdooModuleService from "../modules/odoo/service.js"
import { odooClient } from "../services/odoo-client.js"

type SyncPricesStoreApiInput = {
  productIds?: string[]
  limit?: number
  offset?: number
}

/**
 * Workflow que usa el método CORRECTO para obtener precios
 * Utiliza el Store Product Module que tiene los precios calculados
 */
const syncPricesStoreApiStep = createStep(
  "sync-prices-store-api-step",
  async (input: SyncPricesStoreApiInput, { container }) => {
    try {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] 💰 STORE-API-SYNC: Iniciando sincronización usando Store API...`)

      // Resolver el Store Product Module - este SÍ tiene calculated_price
      const storeProductModule = container.resolve(Modules.PRODUCT)
      const odooModuleService: OdooModuleService = container.resolve("ODOO")

      const { productIds, limit = 10, offset = 0 } = input

      let products
      
      // Obtener productos usando listProducts con las relaciones correctas
      if (productIds && productIds.length > 0) {
        console.log(`[${timestamp}] 🎯 STORE-API-SYNC: Obteniendo productos específicos`)
        
        // Para productos específicos, obtenerlos uno por uno
        products = []
        for (const productId of productIds) {
          try {
            const product = await storeProductModule.retrieve(productId, {
              relations: ["variants", "variants.calculated_price"],
            })
            products.push(product)
          } catch (error: any) {
            console.log(`[${timestamp}] ⚠️ Producto ${productId} no encontrado: ${error.message}`)
          }
        }
      } else {
        console.log(`[${timestamp}] 📦 STORE-API-SYNC: Obteniendo productos (limit: ${limit})`)
        products = await storeProductModule.list(
          {},
          {
            relations: ["variants", "variants.calculated_price"],
            take: limit,
            skip: offset,
          }
        )
      }

      console.log(`[${timestamp}] ✅ STORE-API-SYNC: ${products.length} productos obtenidos`)

      let syncedProducts = 0
      let syncedVariants = 0
      let syncedPrices = 0
      let errorCount = 0
      const errors = []

      // Procesar cada producto
      for (const product of products) {
        try {
          console.log(`[${timestamp}] 📦 Procesando: ${product.title}`)

          // Buscar producto en Odoo
          const existingOdooProducts = await odooModuleService.searchProductByExternalId(product.id)
          
          if (existingOdooProducts.length === 0) {
            console.log(`[${timestamp}] ⚠️ Producto ${product.title} no encontrado en Odoo`)
            continue
          }

          const odooProduct = existingOdooProducts[0]
          console.log(`[${timestamp}] ✅ Encontrado en Odoo (ID: ${odooProduct.id})`)

          // Calcular precio base
          let basePrice = 0
          let baseCurrency = 'CLP'
          const variantPrices: Array<{variant: any, price: number, currency: string}> = []

          for (const variant of product.variants || []) {
            // Buscar calculated_price en el variant
            let priceAmount = 0
            let currency = 'CLP'

            // Intentar múltiples formas de obtener el precio
            if ((variant as any).calculated_price) {
              const cp = (variant as any).calculated_price
              priceAmount = Number(cp.calculated_amount || cp.amount || 0) / 100
              currency = (cp.currency_code || 'clp').toUpperCase()
            } else if ((variant as any).prices && Array.isArray((variant as any).prices)) {
              const prices = (variant as any).prices
              const clpPrice = prices.find((p: any) => p.currency_code === 'clp')
              if (clpPrice) {
                priceAmount = Number(clpPrice.amount || 0) / 100
                currency = 'CLP'
              }
            }

            if (priceAmount > 0) {
              console.log(`[${timestamp}]   ✓ ${variant.title || variant.sku}: $${priceAmount} ${currency}`)
              variantPrices.push({ variant, price: priceAmount, currency })
              
              if (basePrice === 0 || priceAmount < basePrice) {
                basePrice = priceAmount
                baseCurrency = currency
              }
            } else {
              console.log(`[${timestamp}]   ✗ ${variant.title || variant.sku}: Sin precio`)
            }
          }

          if (basePrice === 0) {
            console.log(`[${timestamp}] ⚠️ No se encontró precio válido para ${product.title}`)
            continue
          }

          // Actualizar precio base en Odoo
          await odooModuleService.updateProductTemplatePrice(odooProduct.id, basePrice, baseCurrency)
          console.log(`[${timestamp}] ✅ Precio base actualizado: $${basePrice} ${baseCurrency}`)

          // Sincronizar precios de variantes
          for (const { variant, price, currency } of variantPrices) {
            try {
              // Buscar variante en Odoo
              const odooVariants = await odooClient.searchRead(
                "product.product",
                [
                  ["product_tmpl_id", "=", odooProduct.id],
                  "|",
                  ["default_code", "=", variant.sku],
                  ["name", "ilike", variant.title]
                ],
                ["id", "name", "default_code", "list_price", "price_extra"]
              )

              if (odooVariants.length > 0) {
                const odooVariant = odooVariants[0]
                const priceExtra = Math.max(0, price - basePrice)
                
                await odooClient.update("product.product", odooVariant.id, {
                  list_price: price,
                  price_extra: priceExtra
                })
                
                console.log(`[${timestamp}]   ✅ ${variant.title || variant.sku}: $${price} (extra: $${priceExtra})`)
                syncedVariants++
                syncedPrices++
              }
            } catch (varError: any) {
              console.error(`[${timestamp}]   ❌ Error en variante: ${varError.message}`)
            }
          }

          syncedProducts++

        } catch (error: any) {
          errorCount++
          console.error(`[${timestamp}] ❌ Error procesando ${product.title}: ${error.message}`)
          errors.push({
            product: product.title,
            medusaId: product.id,
            error: error.message
          })
        }
      }

      console.log(`[${timestamp}] 📊 Resumen:`)
      console.log(`[${timestamp}]   Productos: ${syncedProducts}`)
      console.log(`[${timestamp}]   Variantes: ${syncedVariants}`)
      console.log(`[${timestamp}]   Precios: ${syncedPrices}`)
      console.log(`[${timestamp}]   Errores: ${errorCount}`)

      return new StepResponse({
        syncedProducts,
        syncedVariants,
        syncedPrices,
        errorCount,
        errors
      })

    } catch (error: any) {
      console.error("❌ STORE-API-SYNC: Error:", error)
      return new StepResponse({ 
        syncedProducts: 0,
        syncedVariants: 0,
        syncedPrices: 0,
        errorCount: 1,
        errors: [{ product: "N/A", medusaId: "N/A", error: error.message }]
      })
    }
  }
)

const syncPricesStoreApiWorkflow = createWorkflow(
  "sync-prices-store-api",
  function (input) {
    const result = syncPricesStoreApiStep(input)
    return new WorkflowResponse(result)
  }
)

export default syncPricesStoreApiWorkflow

