import { MedusaContainer } from "@medusajs/framework/types"
import syncToOdooWorkflow from "../workflows/sync-to-odoo.js"

export default async function syncProductsToOdooJob(container: MedusaContainer) {
  console.log("🔄 Iniciando sincronización de productos hacia ODOO...")

  try {
    const result = await syncToOdooWorkflow(container).run({
      input: {
        limit: 50, // Sincronizar 50 productos por vez
        offset: 0,
      },
    })

    console.log(`✅ Sincronización completada:`)
    console.log(`   - Productos sincronizados: ${result.result.syncedProducts}`)
    console.log(`   - Productos creados: ${result.result.createdProducts}`)
    console.log(`   - Productos actualizados: ${result.result.updatedProducts}`)
  } catch (error) {
    console.error("❌ Error en sincronización hacia ODOO:", error)
  }
}

export const config = {
  name: "sync-products-to-odoo",
  schedule: "0 */6 * * *", // Cada 6 horas
}
