import { MedusaContainer } from "@medusajs/framework/types"
import { odooClient } from "../services/odoo-client"
import { IProductModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export default async function postDeploySync(container: MedusaContainer) {
  console.log("🚀 Ejecutando sincronización post-deploy...")

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

    // Verificar si ya hay productos sincronizados
    const existingProducts = await productModuleService.listProducts({
      metadata: {
        synced_from_odoo: true
      }
    })

    if (existingProducts.length > 0) {
      console.log(`ℹ️ Ya hay ${existingProducts.length} productos sincronizados, saltando sincronización automática`)
      return
    }

    // Sincronizar solo 3 productos de demostración en el primer deploy
    const odooProducts = await odooClient.searchRead(
      "product.template",
      [["x_medusa_id", "=", false]],
      ["id", "name", "list_price", "default_code", "description", "active"],
      3
    )

    if (odooProducts.length === 0) {
      console.log("ℹ️ No hay productos de demostración para sincronizar")
      return
    }

    console.log(`📦 Sincronizando ${odooProducts.length} productos de demostración...`)

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

    for (const odooProduct of odooProducts) {
      try {
        const productData = {
          title: odooProduct.name,
          handle: generateValidHandle(odooProduct.name, odooProduct.id),
          description: odooProduct.description || "",
          status: odooProduct.active ? "published" as const : "draft" as const,
          metadata: {
            odoo_id: odooProduct.id,
            synced_from_odoo: true
          }
        }

        const variantData = {
          title: odooProduct.name,
          sku: odooProduct.default_code || `SKU-${odooProduct.id}`,
          prices: [{
            currency_code: "clp",
            amount: Math.round((odooProduct.list_price || 0) * 100)
          }]
        }

        const newProduct = await productModuleService.createProducts({
          ...productData,
          variants: [variantData]
        })

        // Actualizar Odoo
        try {
          await odooClient.create("product.template", {
            id: odooProduct.id,
            x_medusa_id: newProduct.id
          })
        } catch (error) {
          console.warn(`⚠️ No se pudo actualizar Odoo para ${productData.title}`)
        }

        createdCount++
        console.log(`✅ Producto sincronizado: ${productData.title}`)
        
      } catch (error: any) {
        console.error(`❌ Error sincronizando ${odooProduct.name}:`, error.message)
      }
    }

    console.log(`🎉 Sincronización post-deploy completada: ${createdCount} productos creados`)

  } catch (error) {
    console.error("❌ Error en sincronización post-deploy:", error)
  }
}
