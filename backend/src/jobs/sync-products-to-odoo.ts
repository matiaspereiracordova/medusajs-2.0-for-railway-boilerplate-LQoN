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
    console.log(`   - Errores: ${result.result.errorCount}`)
    
    if (result.result.errors && result.result.errors.length > 0) {
      console.log(`❌ Productos con errores:`)
      result.result.errors.forEach((err: any) => {
        console.log(`   - ${err.product} (${err.medusaId}): ${err.error}`)
      })
    }
  } catch (error) {
    console.error("❌ Error en sincronización hacia ODOO:", error)
  }
}

export const config = {
  name: "sync-products-to-odoo",
  schedule: "0 */2 * * *", // Cada 2 horas para sincronización regular
}
