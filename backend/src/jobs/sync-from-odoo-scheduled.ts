import { MedusaContainer } from "@medusajs/framework/types"
import { odooClient } from "../services/odoo-client"
import { IProductModuleService, IPricingModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export default async function syncFromOdooScheduledJob(container: MedusaContainer) {
  console.log("🔄 Iniciando sincronización automática desde Odoo...")

  try {
    // Resolver servicios
    const productModuleService: IProductModuleService = container.resolve(
      ModuleRegistrationName.PRODUCT
    )
    const pricingModuleService: IPricingModuleService = container.resolve(
      ModuleRegistrationName.PRICING
    )
    const regionModuleService: IRegionModuleService = container.resolve(
      ModuleRegistrationName.REGION
    )

    // Obtener región por defecto
    const regions = await regionModuleService.listRegions({
      currency_code: "clp"
    })
    const chileRegion = regions?.[0]

    if (!chileRegion) {
      console.error("❌ No se encontró región con moneda CLP")
      return
    }

    // Obtener productos de demostración de Odoo (solo 5 por vez para no sobrecargar)
    const odooProducts = await odooClient.searchRead(
      "product.template",
      [["x_medusa_id", "=", false]], // Solo productos sin x_medusa_id
      ["id", "name", "list_price", "default_code", "description", "x_medusa_id", "active", "image_1920"],
      5 // Solo 5 productos por ejecución
    )

    if (odooProducts.length === 0) {
      console.log("ℹ️ No hay productos de demostración para sincronizar")
      return
    }

    console.log(`📦 Productos encontrados en Odoo: ${odooProducts.length}`)

    let createdCount = 0
    let updatedCount = 0
    let errorCount = 0

    // Función para generar handle válido
    const generateValidHandle = (name: string, id: number): string => {
      let handle = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50)
      
      if (!handle || handle.length < 3) {
        handle = `product-${id}`
      }
      
      return handle
    }

    // Procesar cada producto
    for (const odooProduct of odooProducts) {
      try {
        console.log(`📤 Procesando: ${odooProduct.name}`)
        
        // Buscar si ya existe
        let existingProduct = null
        if (odooProduct.x_medusa_id) {
          try {
            existingProduct = await productModuleService.retrieveProduct(odooProduct.x_medusa_id)
          } catch (error) {
            // Producto no existe, continuar con creación
          }
        }

        const productData = {
          title: odooProduct.name,
          handle: generateValidHandle(odooProduct.name, odooProduct.id),
          description: odooProduct.description || "",
          status: odooProduct.active ? "published" as const : "draft" as const
        }

        const variantData = {
          title: odooProduct.name,
          sku: odooProduct.default_code || `SKU-${odooProduct.id}`,
          prices: [{
            currency_code: "clp",
            amount: Math.round((odooProduct.list_price || 0) * 100)
          }]
        }

        if (existingProduct) {
          // Actualizar producto existente
          await productModuleService.updateProducts(existingProduct.id, {
            ...productData
          })
          updatedCount++
          console.log(`✅ Producto actualizado: ${productData.title}`)
        } else {
          // Crear nuevo producto
          const newProduct = await productModuleService.createProducts({
            ...productData,
            variants: [variantData]
          })

          // Actualizar Odoo con el ID de MedusaJS
          if (newProduct) {
            try {
              await odooClient.create("product.template", {
                id: odooProduct.id,
                x_medusa_id: newProduct.id
              })
            } catch (error) {
              console.warn(`⚠️ No se pudo actualizar Odoo para ${productData.title}`)
            }
          }
          createdCount++
          console.log(`✅ Producto creado: ${productData.title}`)
        }
        
      } catch (error: any) {
        errorCount++
        console.error(`❌ Error procesando ${odooProduct.name}:`, error.message)
      }
    }

    console.log(`📊 Sincronización automática completada:`)
    console.log(`   ✅ Productos creados: ${createdCount}`)
    console.log(`   🔄 Productos actualizados: ${updatedCount}`)
    console.log(`   ❌ Errores: ${errorCount}`)

  } catch (error) {
    console.error("❌ Error en sincronización automática:", error)
  }
}

export const config = {
  name: "sync-from-odoo-scheduled",
  schedule: "0 */6 * * *", // Cada 6 horas
}
