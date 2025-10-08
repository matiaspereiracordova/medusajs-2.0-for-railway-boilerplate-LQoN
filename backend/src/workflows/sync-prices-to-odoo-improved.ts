import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"
import { IRegionModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import OdooModuleService from "../modules/odoo/service.js"
import { odooClient } from "../services/odoo-client"

type SyncPricesToOdooWorkflowInput = {
  productIds?: string[]
  limit?: number
  offset?: number
  regionId?: string // Opcional: especificar región para precios
}

/**
 * Workflow mejorado de sincronización de precios usando el mismo método
 * exitoso del endpoint /admin/list-all-products-prices
 * 
 * Este workflow usa query.graph con price_set.prices.* para obtener
 * precios directamente, en lugar de listPrices() que requiere filtrado manual.
 */

// Step 1: Obtener productos con precios usando query.graph (método exitoso del endpoint)
const getProductsWithPricesStep = createStep(
  "get-products-with-prices",
  async (input: SyncPricesToOdooWorkflowInput, { container }) => {
    try {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] 💰 PRICE-SYNC-V2: Iniciando sincronización de precios...`)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const regionModuleService: IRegionModuleService = container.resolve(Modules.REGION)

      const { productIds, limit = 10, offset = 0 } = input
      let { regionId } = input

      // Si no hay regionId, obtener la primera región disponible (preferiblemente CLP)
      if (!regionId) {
        const regionsResult = await query.graph({
          entity: "region",
          fields: ["id", "currency_code", "name"],
          filters: {
            currency_code: "clp"
          },
          pagination: { take: 1 }
        })
        
        const regions = regionsResult.data || []
        
        if (regions.length > 0) {
          regionId = regions[0].id
          console.log(`[${timestamp}] 🌍 PRICE-SYNC-V2: Usando región: ${regions[0].name} (${regions[0].currency_code})`)
        } else {
          // Fallback: obtener cualquier región
          const anyRegionResult = await query.graph({
            entity: "region",
            fields: ["id", "currency_code", "name"],
            pagination: { take: 1 }
          })
          
          const anyRegions = anyRegionResult.data || []
          if (anyRegions.length > 0) {
            regionId = anyRegions[0].id
            console.log(`[${timestamp}] 🌍 PRICE-SYNC-V2: Usando región (fallback): ${anyRegions[0].name} (${anyRegions[0].currency_code})`)
          }
        }
      }

      // Obtener región para currency_code
      const region = regionId ? await regionModuleService.retrieveRegion(regionId) : null
      const currencyCode = region?.currency_code?.toLowerCase() || 'clp'
      
      console.log(`[${timestamp}] 💰 PRICE-SYNC-V2: Buscando precios en moneda: ${currencyCode.toUpperCase()}`)

      // Obtener productos con variantes y precios (método exitoso del endpoint)
      const filters: any = {
        status: "published"
      }
      
      if (productIds && productIds.length > 0) {
        filters.id = productIds
        console.log(`[${timestamp}] 🎯 PRICE-SYNC-V2: Obteniendo productos específicos:`, productIds)
      }

      const productsResult = await query.graph({
        entity: "product",
        fields: [
          "id",
          "title",
          "handle",
          "status",
          "variants.id",
          "variants.title",
          "variants.sku",
          "variants.price_set.id",
          "variants.price_set.prices.*"
        ],
        filters,
        pagination: {
          take: limit,
          skip: offset
        }
      })

      const products = productsResult.data || []
      console.log(`[${timestamp}] ✅ PRICE-SYNC-V2: Productos obtenidos: ${products?.length || 0}`)

      // Procesar productos y extraer precios
      const productsWithPrices = products.map((product: any) => {
        const variantsWithPrices = (product.variants || []).map((variant: any) => {
          let price = 0
          let hasPrices = false

          // Buscar precio en el price_set de la variante (mismo método del endpoint exitoso)
          if (variant.price_set && variant.price_set.prices) {
            const pricesForCurrency = variant.price_set.prices.filter(
              (p: any) => p.currency_code?.toLowerCase() === currencyCode
            )
            
            if (pricesForCurrency.length > 0 && pricesForCurrency[0].amount) {
              hasPrices = true
              // Los precios ya vienen en la unidad correcta (no en centavos)
              price = Number(pricesForCurrency[0].amount)
            }
          }

          return {
            id: variant.id,
            title: variant.title || 'Sin título',
            sku: variant.sku || '',
            price,
            hasPrices,
            currency: currencyCode.toUpperCase()
          }
        })

        return {
          id: product.id,
          title: product.title,
          handle: product.handle,
          status: product.status,
          variants: variantsWithPrices
        }
      })

      console.log(`[${timestamp}] 📊 PRICE-SYNC-V2: Productos procesados con precios:`)
      productsWithPrices.forEach((p: any) => {
        const variantsWithPrices = p.variants.filter((v: any) => v.hasPrices).length
        console.log(`[${timestamp}]    - ${p.title}: ${variantsWithPrices}/${p.variants.length} variantes con precios`)
      })

      return new StepResponse({ 
        products: productsWithPrices,
        currencyCode: currencyCode.toUpperCase(),
        regionId
      })
    } catch (error: any) {
      console.error("❌ PRICE-SYNC-V2: Error obteniendo productos con precios:", error)
      return new StepResponse({ 
        products: [],
        currencyCode: 'CLP',
        regionId: null,
        error: error.message || "Error desconocido"
      })
    }
  }
)

// Step 2: Sincronizar precios con Odoo
const syncPricesWithOdooStep = createStep(
  "sync-prices-with-odoo",
  async (input: { products: any[], currencyCode: string, regionId: string | null }, { container }) => {
    try {
      const timestamp = new Date().toISOString()
      const { products, currencyCode } = input

      if (!products || products.length === 0) {
        console.log(`[${timestamp}] ℹ️ PRICE-SYNC-V2: No hay productos para sincronizar`)
        return new StepResponse({
          syncedProducts: 0,
          syncedVariants: 0,
          syncedPrices: 0,
          errorCount: 0,
          errors: []
        })
      }

      const odooModuleService: OdooModuleService = container.resolve("ODOO")

      let syncedProducts = 0
      let syncedVariants = 0
      let syncedPrices = 0
      let errorCount = 0
      const errors = []

      console.log(`[${timestamp}] 🔄 PRICE-SYNC-V2: Sincronizando ${products.length} productos con Odoo...`)

      // Procesar cada producto
      for (const product of products) {
        try {
          console.log(`[${timestamp}] 📦 PRICE-SYNC-V2: Procesando producto: ${product.title}`)

          // Buscar el producto en Odoo
          const existingOdooProducts = await odooModuleService.searchProductByExternalId(product.id)
          
          if (existingOdooProducts.length === 0) {
            console.log(`[${timestamp}] ⚠️ PRICE-SYNC-V2: Producto ${product.title} no encontrado en Odoo, omitiendo precios`)
            continue
          }

          const odooProduct = existingOdooProducts[0]
          console.log(`[${timestamp}] 🔍 PRICE-SYNC-V2: Producto encontrado en Odoo (ID: ${odooProduct.id})`)

          // Calcular precio base del producto (precio más bajo)
          let basePrice = 0
          const variantsWithPrices = product.variants.filter((v: any) => v.hasPrices && v.price > 0)
          
          if (variantsWithPrices.length > 0) {
            // Usar el precio más bajo como precio base
            basePrice = Math.min(...variantsWithPrices.map((v: any) => v.price))
            console.log(`[${timestamp}] 💰 PRICE-SYNC-V2: Precio base calculado: $${basePrice} ${currencyCode}`)
            
            // Actualizar precio base del producto template
            await odooModuleService.updateProductTemplatePrice(odooProduct.id, basePrice, currencyCode)
            console.log(`[${timestamp}] ✅ PRICE-SYNC-V2: Precio base actualizado en Odoo`)
          } else {
            console.log(`[${timestamp}] ⚠️ PRICE-SYNC-V2: No se encontró precio base válido para ${product.title}`)
          }

          // Sincronizar precios por variantes
          for (const variant of product.variants) {
            if (!variant.hasPrices || !variant.price || variant.price === 0) {
              console.log(`[${timestamp}] ⚠️ PRICE-SYNC-V2: Variant ${variant.title || variant.sku} sin precio válido`)
              continue
            }

            try {
              // Buscar variante en Odoo por SKU
              if (!variant.sku) {
                console.log(`[${timestamp}] ⚠️ PRICE-SYNC-V2: Variant ${variant.title} no tiene SKU, omitiendo`)
                continue
              }

              const odooVariants = await odooClient.searchRead(
                "product.product",
                [
                  ["product_tmpl_id", "=", odooProduct.id],
                  ["default_code", "=", variant.sku]
                ],
                ["id", "name", "default_code", "list_price", "price_extra"]
              )

              if (odooVariants.length > 0) {
                const odooVariant = odooVariants[0]
                
                // Calcular precio extra (diferencia con precio base)
                const priceExtra = Math.max(0, variant.price - basePrice)
                
                await odooClient.update("product.product", odooVariant.id, {
                  list_price: variant.price,
                  price_extra: priceExtra
                })
                
                console.log(`[${timestamp}] ✅ PRICE-SYNC-V2: Variant ${variant.sku}:`)
                console.log(`[${timestamp}]    - Precio: $${variant.price} ${currencyCode}`)
                console.log(`[${timestamp}]    - Extra: $${priceExtra} ${currencyCode}`)
                syncedVariants++
                syncedPrices++
              } else {
                console.log(`[${timestamp}] ⚠️ PRICE-SYNC-V2: Variant ${variant.sku} no encontrado en Odoo`)
              }
            } catch (variantError: any) {
              console.error(`[${timestamp}] ❌ PRICE-SYNC-V2: Error sincronizando variante ${variant.sku}:`, variantError.message)
              // No incrementar errorCount para errores de variantes individuales
            }
          }

          syncedProducts++
          console.log(`[${timestamp}] ✅ PRICE-SYNC-V2: Producto ${product.title} procesado exitosamente`)

        } catch (error: any) {
          errorCount++
          const errorMsg = `Error sincronizando precios de ${product.title}: ${error.message || error}`
          console.error(`[${timestamp}] ❌ PRICE-SYNC-V2: ${errorMsg}`)
          errors.push({
            product: product.title,
            medusaId: product.id,
            error: error.message || error
          })
        }
      }

      console.log(`[${timestamp}] 📊 PRICE-SYNC-V2: Sincronización de precios completada:`)
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
    } catch (error: any) {
      console.error("❌ PRICE-SYNC-V2: Error en sincronización de precios:", error)
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
const syncPricesToOdooImprovedWorkflow = createWorkflow(
  "sync-prices-to-odoo-improved",
  function (input) {
    const { products, currencyCode, regionId } = getProductsWithPricesStep(input)
    const { syncedProducts, syncedVariants, syncedPrices, errorCount, errors } = syncPricesWithOdooStep({ 
      products, 
      currencyCode, 
      regionId 
    })

    return new WorkflowResponse({
      syncedProducts,
      syncedVariants,
      syncedPrices,
      errorCount,
      errors
    })
  }
)

export default syncPricesToOdooImprovedWorkflow

