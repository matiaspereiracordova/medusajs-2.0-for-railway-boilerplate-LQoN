import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { odooClient } from "../../../services/odoo-client"

/**
 * Endpoint admin para sincronizar stock desde Odoo manualmente
 * 
 * GET /admin/sync-stock-now?limit=50&offset=0
 * 
 * Parámetros opcionales:
 * - limit: Número máximo de productos a sincronizar (default: 50)
 * - offset: Offset para paginación (default: 0)
 * - skus: SKUs específicos separados por coma (opcional)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { limit = 50, offset = 0, skus } = req.query
    
    console.log("🔄 Iniciando sincronización manual de stock desde Odoo...")

    const query = req.scope.resolve("query") as any
    const inventoryService = req.scope.resolve(Modules.INVENTORY)

    // Construir filtros
    const filters: any = {
      variants: {
        manage_inventory: true
      }
    }

    // Si se especificaron SKUs, filtrar por ellos
    if (skus) {
      const skuList = (skus as string).split(',').map(s => s.trim())
      filters.variants.sku = skuList
      console.log(`🎯 Sincronizando SKUs específicos: ${skuList.join(', ')}`)
    }

    // 1. Obtener variantes de productos con sus inventory items
    const productsResult = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "variants.id",
        "variants.sku",
        "variants.manage_inventory",
        "variants.inventory_items.inventory_item_id",
        "variants.inventory_items.required_quantity"
      ],
      filters,
      pagination: {
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }
    })

    const products = productsResult.data || []
    
    if (products.length === 0) {
      return res.json({
        success: true,
        message: "No hay productos para sincronizar",
        updated: 0,
        errors: []
      })
    }

    console.log(`📦 Procesando ${products.length} productos...`)

    // 2. Recolectar SKUs
    const skuToVariantMap = new Map<string, any>()
    
    for (const product of products) {
      for (const variant of product.variants || []) {
        if (variant.sku && variant.manage_inventory) {
          skuToVariantMap.set(variant.sku, {
            ...variant,
            productTitle: product.title
          })
        }
      }
    }

    const allSkus = Array.from(skuToVariantMap.keys())
    
    if (allSkus.length === 0) {
      return res.json({
        success: true,
        message: "No hay SKUs para sincronizar",
        updated: 0,
        errors: []
      })
    }

    console.log(`🔍 Consultando stock en Odoo para ${allSkus.length} SKUs...`)

    // 3. Obtener stock de Odoo
    const stockMap = await odooClient.getProductsStockBySku(allSkus)

    if (stockMap.size === 0) {
      return res.json({
        success: false,
        message: "No se pudo obtener información de stock desde Odoo",
        updated: 0,
        errors: ["No se encontraron productos en Odoo con los SKUs especificados"]
      })
    }

    console.log(`📊 Stock obtenido para ${stockMap.size} productos`)

    // 4. Obtener ubicación de stock
    const stockLocations = await inventoryService.listStockLocations({
      name: "Chilean Pet Warehouse"
    })

    let stockLocationId = stockLocations[0]?.id

    if (!stockLocationId) {
      const allLocations = await inventoryService.listStockLocations()
      stockLocationId = allLocations[0]?.id
    }

    if (!stockLocationId) {
      return res.status(500).json({
        success: false,
        error: "No se encontró ubicación de stock en MedusaJS",
        updated: 0
      })
    }

    // 5. Actualizar inventario
    let updatedCount = 0
    const errors: string[] = []
    const updates: Array<{
      sku: string
      product: string
      oldQuantity: number
      newQuantity: number
    }> = []

    for (const [sku, stockInfo] of stockMap.entries()) {
      const variant = skuToVariantMap.get(sku)
      
      if (!variant || !variant.inventory_items || variant.inventory_items.length === 0) {
        continue
      }

      const inventoryItemId = variant.inventory_items[0].inventory_item_id

      try {
        const currentLevels = await inventoryService.listInventoryLevels({
          inventory_item_id: inventoryItemId,
          location_id: stockLocationId
        })

        const currentLevel = currentLevels[0]
        const newQuantity = Math.floor(stockInfo.qty_available)

        if (currentLevel) {
          const currentQty = currentLevel.stocked_quantity || 0
          
          if (currentQty !== newQuantity) {
            await inventoryService.updateInventoryLevels([{
              id: currentLevel.id,
              stocked_quantity: newQuantity
            }])
            
            updates.push({
              sku,
              product: variant.productTitle,
              oldQuantity: currentQty,
              newQuantity
            })
            
            updatedCount++
          }
        } else {
          await inventoryService.createInventoryLevels([{
            inventory_item_id: inventoryItemId,
            location_id: stockLocationId,
            stocked_quantity: newQuantity
          }])
          
          updates.push({
            sku,
            product: variant.productTitle,
            oldQuantity: 0,
            newQuantity
          })
          
          updatedCount++
        }
      } catch (error: any) {
        errors.push(`Error en SKU ${sku}: ${error.message}`)
      }
    }

    console.log(`✅ Sincronización completada: ${updatedCount} productos actualizados`)

    return res.json({
      success: true,
      message: `Sincronización completada exitosamente`,
      summary: {
        totalProducts: products.length,
        totalSkus: allSkus.length,
        foundInOdoo: stockMap.size,
        updated: updatedCount,
        errors: errors.length
      },
      updates: updates.slice(0, 20), // Primeros 20 para no saturar la respuesta
      errors: errors.slice(0, 10) // Primeros 10 errores
    })

  } catch (error: any) {
    console.error("❌ Error en sincronización manual de stock:", error)
    return res.status(500).json({
      success: false,
      error: error.message || "Error desconocido",
      message: "Ocurrió un error al sincronizar el stock"
    })
  }
}

