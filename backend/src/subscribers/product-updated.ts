import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { IProductModuleService } from '@medusajs/framework/types'
import { ModuleRegistrationName } from '@medusajs/framework/utils'
import syncToOdooWorkflow from '../workflows/sync-to-odoo.js'

export default async function productUpdatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id
  console.log(`🔄 Producto actualizado detectado: ${productId}`)

  try {
    // Obtener el producto actualizado
    const productModuleService: IProductModuleService = container.resolve(
      ModuleRegistrationName.PRODUCT
    )
    
    const product = await productModuleService.retrieveProduct(productId, {
      relations: ["variants", "categories", "tags", "images"],
    })

    console.log(`📦 Sincronizando producto actualizado "${product.title}" (${product.status}) con Odoo...`)

    // Solo sincronizar si el producto está publicado
    if (product.status === 'published') {
      // Ejecutar sincronización solo para este producto
      const result = await syncToOdooWorkflow(container).run({
        input: {
          productIds: [productId],
          limit: 1,
          offset: 0,
        },
      })

      console.log(`✅ Sincronización automática completada para "${product.title}":`)
      console.log(`   - Productos sincronizados: ${result.result.syncedProducts}`)
      console.log(`   - Productos creados: ${result.result.createdProducts}`)
      console.log(`   - Productos actualizados: ${result.result.updatedProducts}`)
      console.log(`   - Errores: ${result.result.errorCount}`)

      if (result.result.errors && result.result.errors.length > 0) {
        console.log(`❌ Errores en sincronización automática:`)
        result.result.errors.forEach((err: any) => {
          console.log(`   - ${err.product} (${err.medusaId}): ${err.error}`)
        })
      }
    } else {
      console.log(`⏭️ Producto "${product.title}" no está publicado (${product.status}), omitiendo sincronización`)
    }
  } catch (error) {
    console.error(`❌ Error en sincronización automática del producto ${productId}:`, error)
  }
}

export const config: SubscriberConfig = {
  event: 'product.updated'
}
