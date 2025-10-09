import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { odooClient } from "../services/odoo-client"

/**
 * Job programado para sincronizar stock desde Odoo a MedusaJS
 * Se ejecuta cada 15 minutos para mantener el inventario actualizado
 */
export default async function syncStockFromOdooJob(container: MedusaContainer) {
  console.log("🔄 Iniciando sincronización de stock desde Odoo...")

  try {
    const query = container.resolve("query") as any
    const inventoryService = container.resolve(Modules.INVENTORY)

    // 1. Obtener todas las variantes de productos con sus inventory items
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
      filters: {
        // Solo productos que gestionan inventario
        variants: {
          manage_inventory: true
        }
      }
    })

    const products = productsResult.data || []
    
    if (products.length === 0) {
      console.log("ℹ️ No hay productos con gestión de inventario")
      return
    }

    console.log(`📦 Encontrados ${products.length} productos con gestión de inventario`)

    // 2. Recolectar todos los SKUs para consultar en Odoo
    const skuToVariantMap = new Map<string, any>()
    
    for (const product of products) {
      for (const variant of product.variants || []) {
        if (variant.sku && variant.manage_inventory) {
          skuToVariantMap.set(variant.sku, variant)
        }
      }
    }

    const skus = Array.from(skuToVariantMap.keys())
    
    if (skus.length === 0) {
      console.log("ℹ️ No hay SKUs para sincronizar")
      return
    }

    console.log(`🔍 Consultando stock en Odoo para ${skus.length} SKUs...`)

    // 3. Obtener stock de Odoo para todos los SKUs
    const stockMap = await odooClient.getProductsStockBySku(skus)

    if (stockMap.size === 0) {
      console.log("⚠️ No se obtuvo información de stock desde Odoo")
      return
    }

    console.log(`📊 Stock obtenido para ${stockMap.size} productos desde Odoo`)

    // 4. Obtener la ubicación de stock predeterminada
    const stockLocations = await inventoryService.listStockLocations({
      name: "Chilean Pet Warehouse"
    })

    let stockLocationId = stockLocations[0]?.id

    // Si no existe la ubicación específica, usar la primera disponible
    if (!stockLocationId) {
      const allLocations = await inventoryService.listStockLocations()
      stockLocationId = allLocations[0]?.id
    }

    if (!stockLocationId) {
      console.error("❌ No se encontró ubicación de stock en MedusaJS")
      return
    }

    console.log(`📍 Usando ubicación de stock: ${stockLocations[0]?.name || 'Default'} (${stockLocationId})`)

    // 5. Actualizar niveles de inventario en MedusaJS
    let updatedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const [sku, stockInfo] of stockMap.entries()) {
      const variant = skuToVariantMap.get(sku)
      
      if (!variant || !variant.inventory_items || variant.inventory_items.length === 0) {
        console.warn(`⚠️ Variante sin inventory items para SKU: ${sku}`)
        continue
      }

      const inventoryItemId = variant.inventory_items[0].inventory_item_id

      try {
        // Obtener el nivel de inventario actual
        const currentLevels = await inventoryService.listInventoryLevels({
          inventory_item_id: inventoryItemId,
          location_id: stockLocationId
        })

        const currentLevel = currentLevels[0]
        const newQuantity = Math.floor(stockInfo.qty_available)

        if (currentLevel) {
          // Actualizar nivel existente
          const currentQty = currentLevel.stocked_quantity || 0
          
          if (currentQty !== newQuantity) {
            await inventoryService.updateInventoryLevels([{
              id: currentLevel.id,
              stocked_quantity: newQuantity
            }])
            
            console.log(`✅ Stock actualizado para SKU ${sku}: ${currentQty} → ${newQuantity}`)
            updatedCount++
          } else {
            console.log(`ℹ️ Stock sin cambios para SKU ${sku}: ${currentQty}`)
          }
        } else {
          // Crear nuevo nivel de inventario
          await inventoryService.createInventoryLevels([{
            inventory_item_id: inventoryItemId,
            location_id: stockLocationId,
            stocked_quantity: newQuantity
          }])
          
          console.log(`✅ Nivel de inventario creado para SKU ${sku}: ${newQuantity}`)
          updatedCount++
        }
      } catch (error: any) {
        errorCount++
        const errorMsg = `Error actualizando inventario para SKU ${sku}: ${error.message}`
        console.error(`❌ ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    console.log(`\n📊 Sincronización de stock completada:`)
    console.log(`   ✅ Niveles actualizados: ${updatedCount}`)
    console.log(`   ❌ Errores: ${errorCount}`)
    
    if (errors.length > 0 && errors.length <= 5) {
      console.log(`\n❌ Errores encontrados:`)
      errors.forEach(err => console.log(`   - ${err}`))
    }

  } catch (error: any) {
    console.error("❌ Error en sincronización de stock desde Odoo:", error)
    console.error("Stack trace:", error.stack)
  }
}

export const config = {
  name: "sync-stock-from-odoo",
  schedule: "*/15 * * * *", // Cada 15 minutos
}

