import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"
import { IProductModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import OdooModuleService from "../modules/odoo/service.js"
import { odooClient } from "../services/odoo-client"

// Step único: Sincronizar precios del producto pierna con debug detallado
const syncPiernaPricesStep = createStep(
  "sync-pierna-prices-step",
  async (input: any, { container }) => {
    try {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] 🔍 PIERNA-DEBUG: Iniciando sincronización de precios del producto "pierna"`)

      const productModuleService: IProductModuleService = container.resolve(
        ModuleRegistrationName.PRODUCT
      )
      const pricingModuleService: IPricingModuleService = container.resolve(
        ModuleRegistrationName.PRICING
      )
      const odooModuleService: OdooModuleService = container.resolve("ODOO")

      // Buscar el producto "pierna" por nombre
      const products = await productModuleService.listProducts({
        title: "pierna"
      }, {
        relations: ["variants"],
        take: 1
      })

      if (products.length === 0) {
        console.log(`[${timestamp}] ❌ PIERNA-DEBUG: No se encontró producto "pierna"`)
        return new StepResponse({ 
          success: false,
          message: "Producto 'pierna' no encontrado",
          syncedProducts: 0,
          syncedVariants: 0,
          syncedPrices: 0,
          errorCount: 1,
          errors: [{ product: "pierna", medusaId: "N/A", error: "Producto no encontrado" }]
        })
      }

      const product = products[0]
      console.log(`[${timestamp}] 📦 PIERNA-DEBUG: Producto encontrado - "${product.title}" (${product.status})`)
      console.log(`[${timestamp}] 📦 PIERNA-DEBUG: ID: ${product.id}, Variants: ${product.variants?.length || 0}`)

      // Obtener todos los precios del sistema
      const allPrices = await pricingModuleService.listPrices()
      console.log(`[${timestamp}] 💰 PIERNA-DEBUG: Total de precios en el sistema: ${allPrices.length}`)

      // Buscar el producto en Odoo
      const existingOdooProducts = await odooModuleService.searchProductByExternalId(product.id)
      
      if (existingOdooProducts.length === 0) {
        console.log(`[${timestamp}] ❌ PIERNA-DEBUG: Producto ${product.title} no encontrado en Odoo`)
        return new StepResponse({ 
          success: false,
          message: "Producto no encontrado en Odoo",
          syncedProducts: 0,
          syncedVariants: 0,
          syncedPrices: 0,
          errorCount: 1,
          errors: [{ product: product.title, medusaId: product.id, error: "Producto no encontrado en Odoo" }]
        })
      }

      const odooProduct = existingOdooProducts[0]
      console.log(`[${timestamp}] 🔍 PIERNA-DEBUG: Producto encontrado en Odoo (ID: ${odooProduct.id})`)
      console.log(`[${timestamp}] 🔍 PIERNA-DEBUG: Nombre en Odoo: "${odooProduct.name}"`)

      let syncedProducts = 0
      let syncedVariants = 0
      let syncedPrices = 0
      let errorCount = 0
      const errors = []

      // Procesar cada variante del producto
      for (const variant of product.variants || []) {
        console.log(`[${timestamp}] 🔍 PIERNA-DEBUG: Procesando variante: ${variant.title}`)
        console.log(`[${timestamp}] 🔍 PIERNA-DEBUG: - SKU: ${variant.sku}`)
        console.log(`[${timestamp}] 🔍 PIERNA-DEBUG: - ID: ${variant.id}`)

        // Buscar precios para esta variante
        const variantPrices = allPrices.filter((price: any) => {
          const matches = price.variant_id === variant.id || 
                 (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
                 price.price_set_id === variant.id ||
                 (price.price_set && price.price_set.variant_id === variant.id)
          
          if (matches) {
            console.log(`[${timestamp}] 💰 PIERNA-DEBUG: Precio encontrado para variant ${variant.id}:`, {
              id: price.id,
              variant_id: price.variant_id,
              currency_code: price.currency_code,
              amount: price.amount
            })
          }
          
          return matches
        })

        console.log(`[${timestamp}] 💰 PIERNA-DEBUG: Precios encontrados para variant ${variant.title}: ${variantPrices.length}`)

        if (variantPrices.length === 0) {
          console.log(`[${timestamp}] ⚠️ PIERNA-DEBUG: Variant ${variant.title} sin precios`)
          continue
        }

        // Mostrar todos los precios encontrados
        variantPrices.forEach((price: any, index: number) => {
          console.log(`[${timestamp}] 💰 PIERNA-DEBUG: Precio ${index + 1}: ${price.currency_code} - ${price.amount} centavos ($${Number(price.amount) / 100})`)
        })

        // Seleccionar el precio apropiado (CLP primero, luego USD, luego cualquier otro)
        const clpPrice = variantPrices.find((p: any) => p.currency_code === 'clp')
        const usdPrice = variantPrices.find((p: any) => p.currency_code === 'usd')
        const anyPrice = variantPrices[0]
        
        const selectedPrice = clpPrice || usdPrice || anyPrice
        const priceInDollars = Number(selectedPrice.amount) / 100

        console.log(`[${timestamp}] 💰 PIERNA-DEBUG: Precio seleccionado: ${selectedPrice.currency_code} - $${priceInDollars}`)

        // Actualizar precio base del producto template
        if (priceInDollars > 0) {
          console.log(`[${timestamp}] 🔄 PIERNA-DEBUG: Actualizando precio base del producto template...`)
          await odooModuleService.updateProduct(odooProduct.id, {
            list_price: priceInDollars
          })
          console.log(`[${timestamp}] ✅ PIERNA-DEBUG: Precio base actualizado: $${priceInDollars}`)
        }

        // Buscar variante en Odoo por SKU o nombre
        console.log(`[${timestamp}] 🔍 PIERNA-DEBUG: Buscando variante en Odoo...`)
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

        console.log(`[${timestamp}] 🔍 PIERNA-DEBUG: Variantes encontradas en Odoo: ${odooVariants.length}`)
        odooVariants.forEach((odooVariant: any, index: number) => {
          console.log(`[${timestamp}] 🔍 PIERNA-DEBUG: Variant ${index + 1}: ${odooVariant.name} (SKU: ${odooVariant.default_code}) - Precio actual: $${odooVariant.list_price}`)
        })

        if (odooVariants.length > 0) {
          const odooVariant = odooVariants[0]
          
          // Actualizar precio de la variante
          console.log(`[${timestamp}] 🔄 PIERNA-DEBUG: Actualizando precio de la variante...`)
          await odooClient.update("product.product", odooVariant.id, {
            list_price: priceInDollars
          })
          
          console.log(`[${timestamp}] ✅ PIERNA-DEBUG: Variant ${variant.title} precio actualizado: $${priceInDollars}`)
          syncedVariants++
          syncedPrices++
        } else {
          console.log(`[${timestamp}] ⚠️ PIERNA-DEBUG: Variant ${variant.title} no encontrado en Odoo`)
        }
      }

      syncedProducts = 1 // Solo procesamos un producto

      console.log(`[${timestamp}] 📊 PIERNA-DEBUG: Sincronización completada:`)
      console.log(`[${timestamp}]    - Productos procesados: ${syncedProducts}`)
      console.log(`[${timestamp}]    - Variantes sincronizadas: ${syncedVariants}`)
      console.log(`[${timestamp}]    - Precios sincronizados: ${syncedPrices}`)
      console.log(`[${timestamp}]    - Errores: ${errorCount}`)

      return new StepResponse({
        success: true,
        message: "Sincronización de precios del producto 'pierna' completada",
        syncedProducts,
        syncedVariants,
        syncedPrices,
        errorCount,
        errors
      })
    } catch (error) {
      console.error("❌ PIERNA-DEBUG: Error en sincronización de precios:", error)
      return new StepResponse({ 
        success: false,
        message: "Error en sincronización",
        syncedProducts: 0,
        syncedVariants: 0,
        syncedPrices: 0,
        errorCount: 1,
        errors: [{ product: "pierna", medusaId: "N/A", error: error.message || "Error desconocido" }]
      })
    }
  }
)

// Crear el workflow principal
const syncPiernaPricesWorkflow = createWorkflow(
  "sync-pierna-prices",
  function (input) {
    const { success, message, syncedProducts, syncedVariants, syncedPrices, errorCount, errors } = syncPiernaPricesStep(input)

    return new WorkflowResponse({
      success,
      message,
      syncedProducts,
      syncedVariants,
      syncedPrices,
      errorCount,
      errors
    })
  }
)

export default syncPiernaPricesWorkflow
