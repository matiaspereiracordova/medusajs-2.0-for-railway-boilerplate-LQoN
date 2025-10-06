import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { IProductModuleService } from '@medusajs/framework/types'
import { ModuleRegistrationName } from '@medusajs/framework/utils'
import syncToOdooWorkflow from '../workflows/sync-to-odoo.js'

export default async function productCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id
  console.log(`🔄 Producto creado detectado: ${productId}`)

  try {
    // Obtener el producto recién creado
    const productModuleService: IProductModuleService = container.resolve(
      ModuleRegistrationName.PRODUCT
    )
    
    const product = await productModuleService.retrieveProduct(productId, {
      relations: ["variants", "categories", "tags", "images"],
    })

    console.log(`📦 Sincronizando producto "${product.title}" con Odoo...`)

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
  } catch (error) {
    console.error(`❌ Error en sincronización automática del producto ${productId}:`, error)
  }
}

export const config: SubscriberConfig = {
  event: 'product.created'
}
