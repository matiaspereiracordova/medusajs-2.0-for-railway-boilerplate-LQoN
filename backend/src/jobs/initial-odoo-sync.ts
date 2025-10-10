import { MedusaContainer } from "@medusajs/framework/types"
import { odooClient } from "../services/odoo-client"
import { IProductModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export default async function initialOdooSyncJob(container: MedusaContainer) {
  console.log("🚀 Iniciando sincronización inicial agresiva desde Odoo...")

  try {
    // Resolver servicios
    const productModuleService: IProductModuleService = container.resolve(
      ModuleRegistrationName.PRODUCT
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
      console.log("⚠️ No se encontró región CLP, saltando sincronización")
      return
    }

    // Obtener TODOS los productos de demostración de Odoo
    const odooProducts = await odooClient.searchRead(
      "product.template",
      [
        ["x_medusa_id", "=", false], // Solo productos sin x_medusa_id
        ["type", "in", ["product", "consu"]], // Productos físicos y consumibles
        ["sale_ok", "=", true] // Solo productos vendibles
      ],
      ["id", "name", "list_price", "default_code", "description", "active", "image_1920"],
      50 // Sincronizar hasta 50 productos
    )

    if (odooProducts.length === 0) {
      console.log("ℹ️ No hay productos de demostración para sincronizar")
      return
    }

    console.log(`📦 Productos encontrados en Odoo: ${odooProducts.length}`)

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

    let createdCount = 0
    let errorCount = 0

    // Procesar cada producto con manejo de errores mejorado
    for (const odooProduct of odooProducts) {
      try {
        console.log(`📤 Procesando: ${odooProduct.name}`)
        
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

        // Crear producto
        const newProduct = await productModuleService.createProducts({
          ...productData,
          variants: [variantData]
        })

        // Actualizar Odoo con ID de MedusaJS
        try {
          await odooClient.create("product.template", {
            id: odooProduct.id,
            x_medusa_id: newProduct.id
          })
          console.log(`✅ Producto sincronizado: ${productData.title}`)
        } catch (updateError) {
          console.warn(`⚠️ No se pudo actualizar Odoo para ${productData.title}:`, updateError)
        }

        createdCount++
        
      } catch (error: any) {
        errorCount++
        console.error(`❌ Error procesando ${odooProduct.name}:`, error.message)
        
        // Continuar con el siguiente producto en lugar de fallar todo
        continue
      }
    }

    console.log(`🎉 Sincronización inicial completada:`)
    console.log(`   ✅ Productos creados: ${createdCount}`)
    console.log(`   ❌ Errores: ${errorCount}`)

  } catch (error) {
    console.error("❌ Error en sincronización inicial:", error)
  }
}

export const config = {
  name: "initial-odoo-sync",
  schedule: "0 0 * * *", // Una vez al día a medianoche
}
