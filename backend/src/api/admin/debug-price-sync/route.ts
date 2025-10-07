import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IProductModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import OdooModuleService from "../../../modules/odoo/service.js"

/**
 * Endpoint de diagnóstico para verificar precios
 * GET /admin/debug-price-sync?productId=prod_xxx
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { productId } = req.query as { productId?: string }

    if (!productId) {
      res.status(400).json({
        success: false,
        message: "Falta el parámetro productId",
        usage: "GET /admin/debug-price-sync?productId=prod_xxx"
      })
      return
    }

    const productModuleService: IProductModuleService = req.scope.resolve(
      ModuleRegistrationName.PRODUCT
    )
    const pricingModuleService: IPricingModuleService = req.scope.resolve(
      ModuleRegistrationName.PRICING
    )
    const odooModuleService: OdooModuleService = req.scope.resolve("ODOO")

    // 1. Obtener producto de MedusaJS
    const product = await productModuleService.retrieveProduct(productId, {
      relations: ["variants"],
    })

    console.log(`🔍 DEBUG: Producto MedusaJS: ${product.title}`)

    // 2. Obtener todos los precios
    const allPrices = await pricingModuleService.listPrices()

    // 3. Buscar precios de este producto
    const productPrices = []
    for (const variant of product.variants || []) {
      const variantPrices = allPrices.filter((price: any) => {
        return price.variant_id === variant.id || 
               (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
               price.price_set_id === variant.id ||
               (price.price_set && price.price_set.variant_id === variant.id)
      })

      productPrices.push({
        variant: {
          id: variant.id,
          title: variant.title,
          sku: variant.sku
        },
        prices: variantPrices.map((p: any) => ({
          currency_code: p.currency_code,
          amount: p.amount,
          amount_formatted: `$${Number(p.amount) / 100}`,
          raw: p
        }))
      })
    }

    // 4. Buscar producto en Odoo
    let odooProduct = null
    let odooVariants = []
    try {
      const existingOdooProducts = await odooModuleService.searchProductByExternalId(product.id)
      if (existingOdooProducts.length > 0) {
        odooProduct = existingOdooProducts[0]
        
        // Buscar variantes en Odoo
        const odooClient = (await import("../../../services/odoo-client")).odooClient
        odooVariants = await odooClient.searchRead(
          "product.product",
          [["product_tmpl_id", "=", odooProduct.id]],
          ["id", "name", "default_code", "list_price", "price_extra", "product_tmpl_id"]
        )
      }
    } catch (error: any) {
      console.error(`❌ Error buscando producto en Odoo:`, error)
    }

    // 5. Retornar diagnóstico completo
    res.json({
      success: true,
      diagnostic: {
        medusaProduct: {
          id: product.id,
          title: product.title,
          handle: product.handle,
          status: product.status,
          variants: product.variants?.length || 0
        },
        medusaPrices: productPrices,
        odooProduct: odooProduct ? {
          id: odooProduct.id,
          name: odooProduct.name,
          list_price: odooProduct.list_price,
          x_medusa_id: odooProduct.x_medusa_id,
          default_code: odooProduct.default_code
        } : null,
        odooVariants: odooVariants.map((v: any) => ({
          id: v.id,
          name: v.name,
          default_code: v.default_code,
          list_price: v.list_price,
          price_extra: v.price_extra,
          product_tmpl_id: v.product_tmpl_id
        })),
        recommendation: odooProduct 
          ? "✅ Producto encontrado en Odoo. Puedes ejecutar POST /admin/sync-prices-to-odoo para sincronizar precios."
          : "⚠️ Producto NO encontrado en Odoo. Primero ejecuta POST /admin/sync-to-odoo para crear el producto."
      }
    })

  } catch (error: any) {
    console.error(`❌ Error en diagnóstico de precios:`, error)
    res.status(500).json({
      success: false,
      message: "Error en diagnóstico de precios",
      error: error.message
    })
  }
}

