import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { odooClient } from "../../../services/odoo-client"

/**
 * Endpoint para verificar disponibilidad de stock en tiempo real desde Odoo
 * 
 * GET /store/check-stock?sku=SKU123&quantity=2
 * 
 * Retorna:
 * - inStock: boolean - Si hay suficiente stock disponible
 * - available: number - Cantidad disponible en Odoo
 * - virtual_available: number - Stock disponible + pedidos entrantes - salientes
 * - requested: number - Cantidad solicitada
 * - sku: string - SKU consultado
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { sku, quantity = 1 } = req.query

    if (!sku) {
      return res.status(400).json({
        success: false,
        error: "SKU es requerido",
        message: "Debes proporcionar un SKU para verificar el stock"
      })
    }

    const requestedQuantity = parseInt(quantity as string) || 1

    console.log(`🔍 Verificando stock para SKU: ${sku}, Cantidad: ${requestedQuantity}`)

    // Consultar stock en Odoo
    const stockMap = await odooClient.getProductsStockBySku([sku as string])

    if (stockMap.size === 0) {
      console.warn(`⚠️ Producto no encontrado en Odoo para SKU: ${sku}`)
      return res.json({
        success: true,
        inStock: false,
        available: 0,
        virtual_available: 0,
        requested: requestedQuantity,
        sku: sku,
        message: "Producto no encontrado en Odoo"
      })
    }

    const stockInfo = stockMap.get(sku as string)!
    const inStock = stockInfo.qty_available >= requestedQuantity

    console.log(`📦 Stock encontrado para SKU ${sku}:`, {
      disponible: stockInfo.qty_available,
      virtual: stockInfo.virtual_available,
      solicitado: requestedQuantity,
      enStock: inStock
    })

    return res.json({
      success: true,
      inStock,
      available: stockInfo.qty_available,
      virtual_available: stockInfo.virtual_available,
      requested: requestedQuantity,
      sku: sku,
      product_id: stockInfo.product_id
    })

  } catch (error: any) {
    console.error("❌ Error verificando stock:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "Error verificando stock",
      message: "Ocurrió un error al verificar el stock en Odoo"
    })
  }
}

/**
 * Endpoint para verificar stock de múltiples productos simultáneamente
 * 
 * POST /store/check-stock
 * Body: {
 *   items: [
 *     { sku: "SKU123", quantity: 2 },
 *     { sku: "SKU456", quantity: 1 }
 *   ]
 * }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { items } = req.body as { items: Array<{ sku: string; quantity: number }> }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Items son requeridos",
        message: "Debes proporcionar un array de items con sku y quantity"
      })
    }

    console.log(`🔍 Verificando stock para ${items.length} items...`)

    // Extraer SKUs
    const skus = items.map(item => item.sku)
    
    // Consultar stock en Odoo
    const stockMap = await odooClient.getProductsStockBySku(skus)

    // Verificar cada item
    const results = items.map(item => {
      const stockInfo = stockMap.get(item.sku)
      
      if (!stockInfo) {
        return {
          sku: item.sku,
          requested: item.quantity,
          inStock: false,
          available: 0,
          virtual_available: 0,
          message: "Producto no encontrado en Odoo"
        }
      }

      const inStock = stockInfo.qty_available >= item.quantity

      return {
        sku: item.sku,
        requested: item.quantity,
        inStock,
        available: stockInfo.qty_available,
        virtual_available: stockInfo.virtual_available,
        product_id: stockInfo.product_id
      }
    })

    // Verificar si todos los items están disponibles
    const allInStock = results.every(r => r.inStock)

    console.log(`📦 Verificación completada: ${results.filter(r => r.inStock).length}/${results.length} items disponibles`)

    return res.json({
      success: true,
      allInStock,
      items: results,
      summary: {
        total: results.length,
        available: results.filter(r => r.inStock).length,
        unavailable: results.filter(r => !r.inStock).length
      }
    })

  } catch (error: any) {
    console.error("❌ Error verificando stock múltiple:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "Error verificando stock",
      message: "Ocurrió un error al verificar el stock en Odoo"
    })
  }
}

