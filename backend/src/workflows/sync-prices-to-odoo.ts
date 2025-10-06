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

// Step 1: Obtener productos con sus variantes y precios
const getProductsWithPricesStep = createStep(
  "get-products-with-prices",
  async (input: SyncPricesToOdooWorkflowInput, { container }) => {
    try {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] 💰 PRICE-SYNC: Obteniendo productos con precios...`)

      const productModuleService: IProductModuleService = container.resolve(
        ModuleRegistrationName.PRODUCT
      )
      const pricingModuleService: IPricingModuleService = container.resolve(
        ModuleRegistrationName.PRICING
      )
      const regionModuleService: IRegionModuleService = container.resolve(
        ModuleRegistrationName.REGION
      )

      // Obtener región de Chile
      const regions = await regionModuleService.listRegions({
        currency_code: "clp"
      })
      const chileRegion = regions?.[0]

      if (!chileRegion) {
        console.error(`[${timestamp}] ❌ PRICE-SYNC: No se encontró región CLP`)
        return new StepResponse({ products: [] })
      }

      const { productIds, limit = 10, offset = 0 } = input

      let products
      if (productIds && productIds.length > 0) {
        console.log(`[${timestamp}] 🎯 PRICE-SYNC: Obteniendo productos específicos:`, productIds)
        products = await Promise.all(
          productIds.map((id) =>
            productModuleService.retrieveProduct(id, {
              relations: ["variants", "variants.prices"],
            })
          )
        )
      } else {
        console.log(`[${timestamp}] 📦 PRICE-SYNC: Obteniendo productos (limit: ${limit}, offset: ${offset})`)
        products = await productModuleService.listProducts(
          {},
          {
            relations: ["variants", "variants.prices"],
            take: limit,
            skip: offset,
          }
        )
      }

      console.log(`[${timestamp}] ✅ PRICE-SYNC: Productos obtenidos: ${products?.length || 0}`)

      // Obtener todos los precios del sistema
      const allPrices = await pricingModuleService.listPrices()
      console.log(`[${timestamp}] 💰 PRICE-SYNC: Total de precios en el sistema: ${allPrices.length}`)

      // Procesar cada producto y sus variantes
      const productsWithPrices = []
      for (const product of products) {
        if (!product.variants || product.variants.length === 0) {
          console.log(`[${timestamp}] ⚠️ PRICE-SYNC: Producto ${product.title} sin variantes`)
          continue
        }

        const variantsWithPrices = []
        for (const variant of product.variants) {
          // Buscar precios para esta variante
          const variantPrices = allPrices.filter((price: any) => {
            return price.variant_id === variant.id || 
                   (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
                   price.price_set_id === variant.id ||
                   (price.price_set && price.price_set.variant_id === variant.id)
          })

          console.log(`[${timestamp}] 💰 PRICE-SYNC: Variant ${variant.title} - Precios encontrados: ${variantPrices.length}`)

          // Procesar precios encontrados
          const processedPrices = variantPrices.map((price: any) => ({
            id: price.id,
            currency_code: price.currency_code,
            amount: Number(price.amount) || 0,
            amount_in_dollars: (Number(price.amount) || 0) / 100,
            variant_id: variant.id,
            variant_title: variant.title,
            variant_sku: variant.sku
          }))

          variantsWithPrices.push({
            ...variant,
            prices: processedPrices
          })
        }

        productsWithPrices.push({
          ...product,
          variants: variantsWithPrices
        })
      }

      return new StepResponse({ 
        products: productsWithPrices,
        region: chileRegion,
        allPrices: allPrices.length
      })
    } catch (error) {
      console.error("❌ PRICE-SYNC: Error obteniendo productos con precios:", error)
      return new StepResponse({ products: [], region: null, allPrices: 0 })
    }
  }
)

// Step 2: Sincronizar precios con Odoo
const syncPricesToOdooStep = createStep(
  "sync-prices-to-odoo",
  async (input, { container }) => {
    const { products, region } = input as { products: any[], region: any }
    
    if (!products || !Array.isArray(products)) {
      console.error("❌ PRICE-SYNC: No hay productos para sincronizar precios")
      return new StepResponse({
        syncedProducts: 0,
        syncedVariants: 0,
        syncedPrices: 0,
        errorCount: 0,
        errors: []
      })
    }

    const odooModuleService: OdooModuleService = container.resolve("ODOO")
    const timestamp = new Date().toISOString()

    let syncedProducts = 0
    let syncedVariants = 0
    let syncedPrices = 0
    let errorCount = 0
    const errors = []

    console.log(`[${timestamp}] 🔄 PRICE-SYNC: Iniciando sincronización de precios para ${products.length} productos`)

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
        if (product.variants && product.variants.length > 0) {
          const firstVariant = product.variants[0]
          if (firstVariant.prices && firstVariant.prices.length > 0) {
            // Buscar precio en CLP, luego USD, luego cualquier otro
            const clpPrice = firstVariant.prices.find((p: any) => p.currency_code === 'clp')
            const usdPrice = firstVariant.prices.find((p: any) => p.currency_code === 'usd')
            const anyPrice = firstVariant.prices[0]
            
            const selectedPrice = clpPrice || usdPrice || anyPrice
            basePrice = selectedPrice.amount_in_dollars
          }
        }

        if (basePrice > 0) {
          await odooModuleService.updateProduct(odooProduct.id, {
            list_price: basePrice
          })
          console.log(`[${timestamp}] ✅ PRICE-SYNC: Precio base actualizado: $${basePrice}`)
        }

        // Sincronizar precios por variantes (si Odoo tiene variantes)
        for (const variant of product.variants) {
          if (!variant.prices || variant.prices.length === 0) {
            console.log(`[${timestamp}] ⚠️ PRICE-SYNC: Variant ${variant.title} sin precios`)
            continue
          }

          // Buscar variante en Odoo por SKU o nombre
          const odooVariants = await odooClient.searchRead(
            "product.product",
            [
              ["product_tmpl_id", "=", odooProduct.id],
              "|",
              ["default_code", "=", variant.sku],
              ["name", "=", variant.title]
            ],
            ["id", "name", "default_code", "list_price"]
          )

          if (odooVariants.length > 0) {
            const odooVariant = odooVariants[0]
            
            // Actualizar precio de la variante
            const variantPrice = variant.prices.find((p: any) => p.currency_code === 'clp') || 
                               variant.prices.find((p: any) => p.currency_code === 'usd') || 
                               variant.prices[0]

            if (variantPrice) {
              await odooClient.update("product.product", odooVariant.id, {
                list_price: variantPrice.amount_in_dollars
              })
              
              console.log(`[${timestamp}] ✅ PRICE-SYNC: Variant ${variant.title} precio actualizado: $${variantPrice.amount_in_dollars}`)
              syncedVariants++
              syncedPrices++
            }
          } else {
            console.log(`[${timestamp}] ⚠️ PRICE-SYNC: Variant ${variant.title} no encontrado en Odoo`)
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
      errors
    })
  }
)

// Crear el workflow principal
const syncPricesToOdooWorkflow = createWorkflow(
  "sync-prices-to-odoo",
  function (input) {
    const { products, region, allPrices } = getProductsWithPricesStep(input)
    const { syncedProducts, syncedVariants, syncedPrices, errorCount, errors } = syncPricesToOdooStep({ products, region })

    return new WorkflowResponse({
      syncedProducts,
      syncedVariants,
      syncedPrices,
      errorCount,
      errors,
      totalPricesInSystem: allPrices
    })
  }
)

export default syncPricesToOdooWorkflow
