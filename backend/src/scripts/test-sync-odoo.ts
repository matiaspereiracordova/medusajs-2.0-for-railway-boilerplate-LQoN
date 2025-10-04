import { MedusaContainer } from "@medusajs/framework/types"
import syncToOdooWorkflow from "../workflows/sync-to-odoo.js"

export default async function testSyncToOdoo(container: MedusaContainer) {
  console.log("🧪 Iniciando prueba de sincronización con ODOO...")

  try {
    // Ejecutar sincronización de prueba con solo 2 productos
    const result = await syncToOdooWorkflow(container).run({
      input: {
        limit: 2, // Solo 2 productos para prueba
        offset: 0,
      },
    })

    console.log(`✅ Prueba de sincronización completada:`)
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

    return result.result
  } catch (error) {
    console.error("❌ Error en prueba de sincronización:", error)
    throw error
  }
}




