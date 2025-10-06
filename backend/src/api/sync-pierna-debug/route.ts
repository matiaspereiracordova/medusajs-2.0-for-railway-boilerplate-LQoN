import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IProductModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import OdooModuleService from "../../../modules/odoo/service.js"
import { odooClient } from "../../../services/odoo-client"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] 🧪 DEBUG-SYNC: Iniciando sincronización de debug para el producto "pierna"`)

    const productModuleService: IProductModuleService = req.scope.resolve(
      ModuleRegistrationName.PRODUCT
    )
    const pricingModuleService: IPricingModuleService = req.scope.resolve(
      ModuleRegistrationName.PRICING
    )
    const odooModuleService: OdooModuleService = req.scope.resolve("ODOO")

    let syncedProducts = 0
    let syncedVariants = 0
    let syncedPrices = 0
    let errorCount = 0
    const errors: any[] = []

    try {
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
        errors.push({ product: "pierna", medusaId: "N/A", error: errorMsg })
        errorCount++
        
        res.json({
          success: false,
          message: "Producto 'pierna' no encontrado en Medusa",
          data: { syncedProducts, syncedVariants, syncedPrices, errorCount, errors, timestamp }
        })
        return
      }

      const product = products[0]
      console.log(`[${timestamp}] 📦 DEBUG-SYNC: Producto Medusa encontrado: "${product.title}" (ID: ${product.id}, Status: ${product.status})`)
      console.log(`[${timestamp}] 📦 DEBUG-SYNC: Variants: ${product.variants?.length || 0}`)

      // 2. Obtener producto "pierna" de Odoo
      console.log(`[${timestamp}] 🔍 DEBUG-SYNC: Buscando producto "pierna" en Odoo por x_medusa_id o nombre...`)
      const existingOdooProducts = await odooModuleService.searchProductByExternalId(
        product.id
      )

      let odooProduct = null
      if (existingOdooProducts.length > 0) {
        odooProduct = existingOdooProducts[0]
        console.log(`[${timestamp}] 📦 DEBUG-SYNC: Producto Odoo encontrado por x_medusa_id: "${odooProduct.name}" (ID: ${odooProduct.id})`)
      } else {
        // Intentar buscar por nombre si no se encontró por x_medusa_id
        const odooProductsByName = await odooClient.searchRead(
          "product.template",
          [["name", "=", product.title]],
          ["id", "name", "list_price", "default_code", "x_medusa_id"]
        )
        if (odooProductsByName.length > 0) {
          odooProduct = odooProductsByName[0]
          console.log(`[${timestamp}] 📦 DEBUG-SYNC: Producto Odoo encontrado por nombre: "${odooProduct.name}" (ID: ${odooProduct.id})`)
        }
      }

      if (!odooProduct) {
        const errorMsg = `Producto Medusa "${product.title}" no encontrado en Odoo. Asegúrate de que el producto base ya esté sincronizado.`
        console.error(`[${timestamp}] ❌ DEBUG-SYNC: ${errorMsg}`)
        errors.push({ product: product.title, medusaId: product.id, error: errorMsg })
        errorCount++
        
        res.json({
          success: false,
          message: errorMsg,
          data: { syncedProducts, syncedVariants, syncedPrices, errorCount, errors, timestamp }
        })
        return
      }

      // 3. Sincronizar precio base del producto (product.template)
      console.log(`[${timestamp}] 💰 DEBUG-SYNC: Sincronizando precio base para "${product.title}"...`)
      let basePrice = 0
      if (product.variants && product.variants.length > 0) {
        const firstVariant = product.variants[0]
        const variantPrices = await pricingModuleService.listPrices({
          variant_id: firstVariant.id
        })

        if (variantPrices.length > 0) {
          const clpPrice = variantPrices.find((p: any) => p.currency_code === 'clp')
          const usdPrice = variantPrices.find((p: any) => p.currency_code === 'usd')
          const anyPrice = variantPrices[0]
          
          const selectedPrice = clpPrice || usdPrice || anyPrice
          basePrice = Number(selectedPrice.amount) / 100
          console.log(`[${timestamp}] 💰 DEBUG-SYNC: Precio base calculado para "${product.title}": $${basePrice} (${selectedPrice.currency_code})`)
        } else {
          console.log(`[${timestamp}] ⚠️ DEBUG-SYNC: No se encontraron precios para la primera variante de "${product.title}".`)
        }
      } else {
        console.log(`[${timestamp}] ⚠️ DEBUG-SYNC: Producto "${product.title}" no tiene variantes.`)
      }

      if (basePrice > 0) {
        await odooModuleService.updateProduct(odooProduct.id, {
          list_price: basePrice
        })
        console.log(`[${timestamp}] ✅ DEBUG-SYNC: Precio base de Odoo actualizado para "${odooProduct.name}": $${basePrice}`)
        syncedProducts++
      } else {
        console.log(`[${timestamp}] ⚠️ DEBUG-SYNC: Precio base es 0 o no se pudo obtener para "${product.title}", no se actualiza en Odoo.`)
      }

      // 4. Sincronizar precios por variantes (product.product)
      console.log(`[${timestamp}] 💰 DEBUG-SYNC: Sincronizando precios por variantes para "${product.title}"...`)
      for (const variant of product.variants || []) {
        console.log(`[${timestamp}] 🔄 DEBUG-SYNC: Procesando variant Medusa: "${variant.title}" (ID: ${variant.id}, SKU: ${variant.sku})`)

        const variantPrices = await pricingModuleService.listPrices({
          variant_id: variant.id
        })

        if (!variantPrices || variantPrices.length === 0) {
          console.log(`[${timestamp}] ⚠️ DEBUG-SYNC: Variant ${variant.title} sin precios en Medusa.`)
          continue
        }

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
          console.log(`[${timestamp}] 🔍 DEBUG-SYNC: Variant Odoo encontrado: "${odooVariant.name}" (ID: ${odooVariant.id})`)
          
          const clpPrice = variantPrices.find((p: any) => p.currency_code === 'clp')
          const usdPrice = variantPrices.find((p: any) => p.currency_code === 'usd')
          const anyPrice = variantPrices[0]
          
          const selectedVariantPrice = clpPrice || usdPrice || anyPrice

          if (selectedVariantPrice) {
            const priceInDollars = Number(selectedVariantPrice.amount) / 100
            await odooClient.update("product.product", odooVariant.id, {
              list_price: priceInDollars
            })
            
            console.log(`[${timestamp}] ✅ DEBUG-SYNC: Variant Odoo "${odooVariant.name}" precio actualizado: $${priceInDollars} (${selectedVariantPrice.currency_code})`)
            syncedVariants++
            syncedPrices++
          } else {
            console.log(`[${timestamp}] ⚠️ DEBUG-SYNC: No se pudo determinar el precio para la variante "${variant.title}".`)
          }
        } else {
          console.log(`[${timestamp}] ⚠️ DEBUG-SYNC: Variant Medusa "${variant.title}" no encontrado en Odoo.`)
        }
      }
    } catch (error: any) {
      errorCount++
      const errorMsg = `Error general en sincronización de debug para "pierna": ${error.message || error}`
      console.error(`[${timestamp}] ❌ DEBUG-SYNC: ${errorMsg}`)
      errors.push({ product: "pierna", medusaId: "N/A", error: errorMsg })
    }

    console.log(`[${timestamp}] 📊 DEBUG-SYNC: Resumen de debug para "pierna":`)
    console.log(`[${timestamp}]    - Productos con precio base actualizado: ${syncedProducts}`)
    console.log(`[${timestamp}]    - Variantes con precio actualizado: ${syncedVariants}`)
    console.log(`[${timestamp}]    - Precios individuales sincronizados: ${syncedPrices}`)
    console.log(`[${timestamp}]    - Errores: ${errorCount}`)

    const response = {
      success: true,
      message: "Sincronización de debug para 'pierna' completada",
      data: {
        syncedProducts,
        syncedVariants,
        syncedPrices,
        errorCount,
        errors,
        timestamp,
      },
    }

    console.log(`[${timestamp}] ✅ DEBUG-SYNC: Sincronización de debug completada para "pierna":`, response.data)
    res.json(response)
  } catch (error: any) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ❌ DEBUG-SYNC: Error en sincronización de debug para "pierna":`, error)
    res.status(500).json({
      success: false,
      message: "Error en sincronización de debug para 'pierna'",
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
    message: "Endpoint de sincronización de debug para el producto 'pierna'",
    usage: {
      method: "POST",
      endpoint: "/sync-pierna-debug",
      description: "Sincroniza específicamente el producto 'pierna' con debug detallado"
    }
  })
}