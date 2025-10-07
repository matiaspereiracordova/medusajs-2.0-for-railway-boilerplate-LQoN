import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"
import { IProductModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import OdooModuleService from "../modules/odoo/service.js"
import { odooClient } from "../services/odoo-client.js"

type SyncPricesToOdooWorkflowInput = {
  productIds?: string[]
  limit?: number
  offset?: number
}

// Step único: Obtener productos y sincronizar precios usando calculated_price
const syncPricesStep = createStep(
  "sync-prices-step-fixed",
  async (input: SyncPricesToOdooWorkflowInput, { container }) => {
    try {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] 💰 PRICE-SYNC-FIXED: Iniciando sincronización de precios...`)

      const productModuleService: IProductModuleService = container.resolve(
        ModuleRegistrationName.PRODUCT
      )
      const regionModuleService: IRegionModuleService = container.resolve(
        ModuleRegistrationName.REGION
      )
      const odooModuleService: OdooModuleService = container.resolve("ODOO")

      // Obtener región de Chile
      const regions = await regionModuleService.listRegions({
        currency_code: "clp"
      })
      const chileRegion = regions?.[0]

      if (!chileRegion) {
        console.error(`[${timestamp}] ❌ PRICE-SYNC-FIXED: No se encontró región CLP`)
        return new StepResponse({ 
          syncedProducts: 0,
          syncedVariants: 0,
          syncedPrices: 0,
          errorCount: 1,
          errors: [{ product: "N/A", medusaId: "N/A", error: "No se encontró región CLP" }]
        })
      }

      const { productIds, limit = 10, offset = 0 } = input

      let products
      if (productIds && productIds.length > 0) {
        console.log(`[${timestamp}] 🎯 PRICE-SYNC-FIXED: Obteniendo productos específicos:`, productIds)
        products = await Promise.all(
          productIds.map((id) =>
            productModuleService.retrieveProduct(id, {
              relations: ["variants"],
            })
          )
        )
      } else {
        console.log(`[${timestamp}] 📦 PRICE-SYNC-FIXED: Obteniendo productos (limit: ${limit}, offset: ${offset})`)
        products = await productModuleService.listProducts(
          {},
          {
            relations: ["variants"],
            take: limit,
            skip: offset,
          }
        )
      }

      console.log(`[${timestamp}] ✅ PRICE-SYNC-FIXED: Productos obtenidos: ${products?.length || 0}`)

      let syncedProducts = 0
      let syncedVariants = 0
      let syncedPrices = 0
      let errorCount = 0
      const errors = []

      // Procesar cada producto
      for (const product of products) {
        try {
          console.log(`[${timestamp}] 📦 PRICE-SYNC-FIXED: Procesando producto: ${product.title}`)

          // Buscar el producto en Odoo
          const existingOdooProducts = await odooModuleService.searchProductByExternalId(product.id)
          
          if (existingOdooProducts.length === 0) {
            console.log(`[${timestamp}] ⚠️ PRICE-SYNC-FIXED: Producto ${product.title} no encontrado en Odoo, omitiendo precios`)
            continue
          }

          const odooProduct = existingOdooProducts[0]
          console.log(`[${timestamp}] 🔍 PRICE-SYNC-FIXED: Producto encontrado en Odoo (ID: ${odooProduct.id})`)

          // Calcular precio base usando calculated_price
          let basePrice = 0
          let baseCurrency = 'CLP'
          
          if (product.variants && product.variants.length > 0) {
            let lowestPrice = Infinity
            
            for (const variant of product.variants) {
              // ✨ CAMBIO CLAVE: Usar calculated_price en lugar de prices[]
              const calculatedPrice = (variant as any).calculated_price
              
              if (calculatedPrice && calculatedPrice.calculated_amount) {
                const priceAmount = Number(calculatedPrice.calculated_amount) / 100
                const currency = (calculatedPrice.currency_code || 'clp').toUpperCase()
                
                console.log(`[${timestamp}] 💰 Variant ${variant.title || variant.sku}: $${priceAmount} ${currency}`)
                
                if (priceAmount > 0 && priceAmount < lowestPrice) {
                  lowestPrice = priceAmount
                  basePrice = priceAmount
                  baseCurrency = currency
                }
              } else {
                console.log(`[${timestamp}] ⚠️ Variant ${variant.title || variant.sku}: Sin calculated_price`)
              }
            }
          }

          if (basePrice > 0) {
            await odooModuleService.updateProductTemplatePrice(odooProduct.id, basePrice, baseCurrency)
            console.log(`[${timestamp}] ✅ PRICE-SYNC-FIXED: Precio base actualizado: $${basePrice} ${baseCurrency}`)
          } else {
            console.log(`[${timestamp}] ⚠️ PRICE-SYNC-FIXED: No se encontró precio base válido para ${product.title}`)
            continue
          }

          // Sincronizar precios por variantes usando calculated_price
          for (const variant of product.variants || []) {
            try {
              const calculatedPrice = (variant as any).calculated_price
              
              if (!calculatedPrice || !calculatedPrice.calculated_amount) {
                console.log(`[${timestamp}] ⚠️ PRICE-SYNC-FIXED: Variant ${variant.title || variant.sku} sin calculated_price`)
                continue
              }

              // Buscar variante en Odoo por SKU o nombre
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
                const variantPriceAmount = Number(calculatedPrice.calculated_amount) / 100

                if (variantPriceAmount > 0) {
                  // Calcular precio extra (diferencia con precio base)
                  const priceExtra = Math.max(0, variantPriceAmount - basePrice)
                  
                  await odooClient.update("product.product", odooVariant.id, {
                    list_price: variantPriceAmount,
                    price_extra: priceExtra
                  })
                  
                  console.log(`[${timestamp}] ✅ PRICE-SYNC-FIXED: Variant ${variant.title || variant.sku}:`)
                  console.log(`[${timestamp}]    - Precio: $${variantPriceAmount}`)
                  console.log(`[${timestamp}]    - Extra: $${priceExtra}`)
                  syncedVariants++
                  syncedPrices++
                }
              } else {
                console.log(`[${timestamp}] ⚠️ PRICE-SYNC-FIXED: Variant ${variant.title || variant.sku} no encontrado en Odoo`)
              }
            } catch (variantError: any) {
              console.error(`[${timestamp}] ❌ PRICE-SYNC-FIXED: Error sincronizando variante ${variant.title || variant.sku}:`, variantError.message)
            }
          }

          syncedProducts++
          console.log(`[${timestamp}] ✅ PRICE-SYNC-FIXED: Producto ${product.title} procesado exitosamente`)

        } catch (error: any) {
          errorCount++
          const errorMsg = `Error sincronizando precios de ${product.title}: ${error.message || error}`
          console.error(`[${timestamp}] ❌ PRICE-SYNC-FIXED: ${errorMsg}`)
          errors.push({
            product: product.title,
            medusaId: product.id,
            error: error.message || error
          })
        }
      }

      console.log(`[${timestamp}] 📊 PRICE-SYNC-FIXED: Sincronización de precios completada:`)
      console.log(`[${timestamp}]    - Productos procesados: ${syncedProducts}`)
      console.log(`[${timestamp}]    - Variantes sincronizadas: ${syncedVariants}`)
      console.log(`[${timestamp}]    - Precios sincronizados: ${syncedPrices}`)
      console.log(`[${timestamp}]    - Errores: ${errorCount}`)

      return new StepResponse({
        syncedProducts,
        syncedVariants,
        syncedPrices,
        errorCount,
        errors
      })
    } catch (error) {
      console.error("❌ PRICE-SYNC-FIXED: Error en sincronización de precios:", error)
      return new StepResponse({ 
        syncedProducts: 0,
        syncedVariants: 0,
        syncedPrices: 0,
        errorCount: 1,
        errors: [{ product: "N/A", medusaId: "N/A", error: error.message || "Error desconocido" }]
      })
    }
  }
)

// Crear el workflow principal
const syncPricesToOdooWorkflowFixed = createWorkflow(
  "sync-prices-to-odoo-fixed",
  function (input) {
    const { syncedProducts, syncedVariants, syncedPrices, errorCount, errors } = syncPricesStep(input)

    return new WorkflowResponse({
      syncedProducts,
      syncedVariants,
      syncedPrices,
      errorCount,
      errors
    })
  }
)

export default syncPricesToOdooWorkflowFixed

