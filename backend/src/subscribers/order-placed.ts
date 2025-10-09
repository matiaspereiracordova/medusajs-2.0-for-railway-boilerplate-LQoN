import { Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { odooClient } from '../services/odoo-client'

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
  
  const order = await orderModuleService.retrieveOrder(data.id, { relations: ['items', 'summary', 'shipping_address'] })
  const shippingAddress = await (orderModuleService as any).orderAddressService_.retrieve(order.shipping_address.id)

  // 1. Enviar notificación por email
  try {
    await notificationModuleService.createNotifications({
      to: order.email,
      channel: 'email',
      template: EmailTemplates.ORDER_PLACED,
      data: {
        emailOptions: {
          replyTo: 'info@example.com',
          subject: 'Your order has been placed'
        },
        order,
        shippingAddress,
        preview: 'Thank you for your order!'
      }
    })
  } catch (error) {
    console.error('Error sending order confirmation notification:', error)
  }

  // 2. Sincronizar stock con Odoo (actualizar movimientos de inventario)
  try {
    console.log(`📦 Sincronizando stock con Odoo para orden ${order.display_id}...`)
    
    const query = container.resolve("query") as any
    
    // Obtener detalles completos de las variantes
    for (const item of order.items || []) {
      try {
        // Obtener información de la variante
        const variantsResult = await query.graph({
          entity: "product_variant",
          fields: ["id", "sku", "product.title"],
          filters: { id: item.variant_id }
        })
        
        const variant = variantsResult.data?.[0]
        
        if (!variant || !variant.sku) {
          console.warn(`⚠️ Variante sin SKU para item ${item.id}`)
          continue
        }

        console.log(`🔍 Procesando item: ${variant.product?.title || 'Unknown'} (SKU: ${variant.sku}, Qty: ${item.quantity})`)

        // Buscar producto en Odoo por SKU
        const odooProducts = await odooClient.searchRead(
          "product.product",
          [["default_code", "=", variant.sku]],
          ["id", "default_code", "qty_available"],
          1
        )

        if (odooProducts.length === 0) {
          console.warn(`⚠️ Producto no encontrado en Odoo para SKU: ${variant.sku}`)
          continue
        }

        const odooProduct = odooProducts[0]
        console.log(`📦 Producto encontrado en Odoo: ID ${odooProduct.id}, Stock actual: ${odooProduct.qty_available}`)

        // Crear movimiento de stock en Odoo
        const success = await odooClient.createStockMove(
          odooProduct.id,
          item.quantity,
          `Medusa Order ${order.display_id}`
        )

        if (success) {
          console.log(`✅ Stock actualizado en Odoo para SKU ${variant.sku}: -${item.quantity} unidades`)
        } else {
          console.error(`❌ Error actualizando stock en Odoo para SKU ${variant.sku}`)
        }

      } catch (itemError: any) {
        console.error(`❌ Error procesando item de orden:`, itemError.message)
      }
    }

    console.log(`✅ Sincronización de stock con Odoo completada para orden ${order.display_id}`)

  } catch (error: any) {
    console.error('❌ Error sincronizando stock con Odoo:', error)
    console.error('Stack trace:', error.stack)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed'
}
