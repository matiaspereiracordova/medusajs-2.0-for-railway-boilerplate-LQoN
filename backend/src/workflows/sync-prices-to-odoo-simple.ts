import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"
import { IProductModuleService, IPricingModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import OdooModuleService from "../modules/odoo/service.js"
import { odooClient } from "../services/odoo-client"

type SyncPricesToOdooWorkflowInput = {
  productIds?: string[]
  limit?: number
  offset?: number
}

// Step único: Obtener productos y sincronizar precios
const syncPricesStep = createStep(
  "sync-prices-step",
  async (input: SyncPricesToOdooWorkflowInput, { container }) => {
    try {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] 💰 PRICE-SYNC: Iniciando sincronización de precios...`)

      const productModuleService: IProductModuleService = container.resolve(
        ModuleRegistrationName.PRODUCT
      )
      const pricingModuleService: IPricingModuleService = container.resolve(
        ModuleRegistrationName.PRICING
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
        console.error(`[${timestamp}] ❌ PRICE-SYNC: No se encontró región CLP`)
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
        console.log(`[${timestamp}] 🎯 PRICE-SYNC: Obteniendo productos específicos:`, productIds)
        products = await Promise.all(
          productIds.map((id) =>
            productModuleService.retrieveProduct(id, {
              relations: ["variants"],
            })
          )
        )
      } else {
        console.log(`[${timestamp}] 📦 PRICE-SYNC: Obteniendo productos (limit: ${limit}, offset: ${offset})`)
        products = await productModuleService.listProducts(
          {},
          {
            relations: ["variants"],
            take: limit,
            skip: offset,
          }
        )
      }

      console.log(`[${timestamp}] ✅ PRICE-SYNC: Productos obtenidos: ${products?.length || 0}`)

      // Obtener todos los precios del sistema
      const allPrices = await pricingModuleService.listPrices()
      console.log(`[${timestamp}] 💰 PRICE-SYNC: Total de precios en el sistema: ${allPrices.length}`)

      let syncedProducts = 0
      let syncedVariants = 0
      let syncedPrices = 0
      let errorCount = 0
      const errors = []

      // Procesar cada producto
      for (const product of products) {
        try {
          console.log(`[${timestamp}] 📦 PRICE-SYNC: Procesando producto: ${product.title}`)

          // Buscar el producto en Odoo
          const existingOdooProducts = await odooModuleService.searchProductByExternalId(product.id)
          
          if (existingOdooProducts.length === 0) {
            console.log(`[${timestamp}] ⚠️ PRICE-SYNC: Producto ${product.title} no encontrado en Odoo, omitiendo precios`)
            continue
          }

          const odooProduct = existingOdooProducts[0]
          console.log(`[${timestamp}] 🔍 PRICE-SYNC: Producto encontrado en Odoo (ID: ${odooProduct.id})`)

          // Actualizar precio base del producto template
          let basePrice = 0
          let baseCurrency = 'CLP'
          
          if (product.variants && product.variants.length > 0) {
            // Buscar el precio más bajo como precio base (estrategia común en e-commerce)
            let lowestPrice = Infinity
            
            for (const variant of product.variants) {
              const variantPrices = allPrices.filter((price: any) => {
                return price.variant_id === variant.id || 
                       (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
                       price.price_set_id === variant.id ||
                       (price.price_set && price.price_set.variant_id === variant.id)
              })

              if (variantPrices.length > 0) {
                const clpPrice = variantPrices.find((p: any) => p.currency_code === 'clp')
                const usdPrice = variantPrices.find((p: any) => p.currency_code === 'usd')
                const anyPrice = variantPrices[0]
                
                const selectedPrice = clpPrice || usdPrice || anyPrice
                const priceAmount = Number(selectedPrice.amount) / 100
                
                if (priceAmount > 0 && priceAmount < lowestPrice) {
                  lowestPrice = priceAmount
                  basePrice = priceAmount
                  baseCurrency = (selectedPrice.currency_code || 'clp').toUpperCase()
                }
              }
            }
          }

          if (basePrice > 0) {
            await odooModuleService.updateProductTemplatePrice(odooProduct.id, basePrice, baseCurrency)
            console.log(`[${timestamp}] ✅ PRICE-SYNC: Precio base actualizado: $${basePrice} ${baseCurrency}`)
          } else {
            console.log(`[${timestamp}] ⚠️ PRICE-SYNC: No se encontró precio base válido para ${product.title}`)
          }

          // Sincronizar precios por variantes
          for (const variant of product.variants || []) {
            try {
              const variantPrices = allPrices.filter((price: any) => {
                return price.variant_id === variant.id || 
                       (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
                       price.price_set_id === variant.id ||
                       (price.price_set && price.price_set.variant_id === variant.id)
              })

              if (variantPrices.length === 0) {
                console.log(`[${timestamp}] ⚠️ PRICE-SYNC: Variant ${variant.title || variant.sku} sin precios`)
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
                
                // Seleccionar el mejor precio disponible
                const clpPrice = variantPrices.find((p: any) => p.currency_code === 'clp')
                const usdPrice = variantPrices.find((p: any) => p.currency_code === 'usd')
                const anyPrice = variantPrices[0]
                
                const variantPrice = clpPrice || usdPrice || anyPrice
                const variantPriceAmount = Number(variantPrice.amount) / 100

                if (variantPriceAmount > 0) {
                  // Calcular precio extra (diferencia con precio base)
                  const priceExtra = Math.max(0, variantPriceAmount - basePrice)
                  
                  await odooClient.update("product.product", odooVariant.id, {
                    list_price: variantPriceAmount,
                    price_extra: priceExtra
                  })
                  
                  console.log(`[${timestamp}] ✅ PRICE-SYNC: Variant ${variant.title || variant.sku}:`)
                  console.log(`[${timestamp}]    - Precio: $${variantPriceAmount}`)
                  console.log(`[${timestamp}]    - Extra: $${priceExtra}`)
                  syncedVariants++
                  syncedPrices++
                }
              } else {
                console.log(`[${timestamp}] ⚠️ PRICE-SYNC: Variant ${variant.title || variant.sku} no encontrado en Odoo`)
                console.log(`[${timestamp}]    - SKU buscado: ${variant.sku}`)
                console.log(`[${timestamp}]    - Título buscado: ${variant.title}`)
              }
            } catch (variantError: any) {
              console.error(`[${timestamp}] ❌ PRICE-SYNC: Error sincronizando variante ${variant.title || variant.sku}:`, variantError.message)
            }
          }

          syncedProducts++
          console.log(`[${timestamp}] ✅ PRICE-SYNC: Producto ${product.title} procesado exitosamente`)

        } catch (error: any) {
          errorCount++
          const errorMsg = `Error sincronizando precios de ${product.title}: ${error.message || error}`
          console.error(`[${timestamp}] ❌ PRICE-SYNC: ${errorMsg}`)
          errors.push({
            product: product.title,
            medusaId: product.id,
            error: error.message || error
          })
        }
      }

      console.log(`[${timestamp}] 📊 PRICE-SYNC: Sincronización de precios completada:`)
      console.log(`[${timestamp}]    - Productos procesados: ${syncedProducts}`)
      console.log(`[${timestamp}]    - Variantes sincronizadas: ${syncedVariants}`)
      console.log(`[${timestamp}]    - Precios sincronizados: ${syncedPrices}`)
      console.log(`[${timestamp}]    - Errores: ${errorCount}`)

      return new StepResponse({
        syncedProducts,
        syncedVariants,
        syncedPrices,
        errorCount,
        errors,
        totalPricesInSystem: allPrices.length
      })
    } catch (error) {
      console.error("❌ PRICE-SYNC: Error en sincronización de precios:", error)
      return new StepResponse({ 
        syncedProducts: 0,
        syncedVariants: 0,
        syncedPrices: 0,
        errorCount: 1,
        errors: [{ product: "N/A", medusaId: "N/A", error: error.message || "Error desconocido" }],
        totalPricesInSystem: 0
      })
    }
  }
)

// Crear el workflow principal
const syncPricesToOdooWorkflow = createWorkflow(
  "sync-prices-to-odoo",
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

export default syncPricesToOdooWorkflow
