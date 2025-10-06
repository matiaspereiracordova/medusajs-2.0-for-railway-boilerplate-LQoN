import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { IProductModuleService } from '@medusajs/framework/types'
import { ModuleRegistrationName } from '@medusajs/framework/utils'
import syncToOdooWorkflow from '../workflows/sync-to-odoo.js'

export default async function productCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] 🔄 SUBSCRIBER: Producto creado detectado - ID: ${productId}`)

  try {
    // Obtener el producto recién creado
    const productModuleService: IProductModuleService = container.resolve(
      ModuleRegistrationName.PRODUCT
    )
    
    const product = await productModuleService.retrieveProduct(productId, {
      relations: ["variants", "categories", "tags", "images"],
    })

    console.log(`[${timestamp}] 📦 SUBSCRIBER: Producto obtenido - "${product.title}" (${product.status})`)
    console.log(`[${timestamp}] 📦 SUBSCRIBER: Variants: ${product.variants?.length || 0}, Images: ${product.images?.length || 0}`)

    // Ejecutar sincronización solo para este producto
    console.log(`[${timestamp}] 🚀 SUBSCRIBER: Iniciando sincronización con Odoo...`)
    const result = await syncToOdooWorkflow(container).run({
      input: {
        productIds: [productId],
        limit: 1,
        offset: 0,
      },
    })

    console.log(`[${timestamp}] ✅ SUBSCRIBER: Sincronización completada para "${product.title}":`)
    console.log(`[${timestamp}]    - Productos sincronizados: ${result.result.syncedProducts}`)
    console.log(`[${timestamp}]    - Productos creados: ${result.result.createdProducts}`)
    console.log(`[${timestamp}]    - Productos actualizados: ${result.result.updatedProducts}`)
    console.log(`[${timestamp}]    - Errores: ${result.result.errorCount}`)

    if (result.result.errors && result.result.errors.length > 0) {
      console.log(`[${timestamp}] ❌ SUBSCRIBER: Errores en sincronización:`)
      result.result.errors.forEach((err: any) => {
        console.log(`[${timestamp}]    - ${err.product} (${err.medusaId}): ${err.error}`)
      })
    } else {
      console.log(`[${timestamp}] 🎉 SUBSCRIBER: Producto "${product.title}" sincronizado exitosamente con Odoo`)
    }
  } catch (error) {
    console.error(`[${timestamp}] ❌ SUBSCRIBER: Error en sincronización del producto ${productId}:`, error)
  }
}

export const config: SubscriberConfig = {
  event: 'product.created'
}
