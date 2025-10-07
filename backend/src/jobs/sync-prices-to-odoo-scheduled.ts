import type { MedusaContainer } from "@medusajs/types"
import syncPricesToOdooWorkflow from "../workflows/sync-prices-to-odoo-simple.js"

/**
 * Job programado para sincronizar precios desde MedusaJS hacia Odoo
 * Se ejecuta cada 6 horas para mantener los precios actualizados
 */
export default async function syncPricesToOdooScheduled(container: MedusaContainer) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ⏰ SCHEDULED-JOB: Iniciando sincronización programada de precios hacia Odoo...`)

  try {
    // Sincronizar todos los productos (sin filtro de productIds)
    // Usar límite razonable para no sobrecargar el sistema
    const result = await syncPricesToOdooWorkflow(container).run({
      input: {
        limit: 50, // Sincronizar hasta 50 productos por ejecución
        offset: 0,
      },
    })

    console.log(`[${timestamp}] ✅ SCHEDULED-JOB: Sincronización de precios completada:`)
    console.log(`[${timestamp}]    - Productos procesados: ${result.result.syncedProducts}`)
    console.log(`[${timestamp}]    - Variantes sincronizadas: ${result.result.syncedVariants}`)
    console.log(`[${timestamp}]    - Total precios sincronizados: ${result.result.syncedPrices}`)
    console.log(`[${timestamp}]    - Errores: ${result.result.errorCount}`)

    if (result.result.errors && result.result.errors.length > 0) {
      console.log(`[${timestamp}] ⚠️ SCHEDULED-JOB: Se encontraron errores durante la sincronización:`)
      result.result.errors.forEach((err: any) => {
        console.log(`[${timestamp}]    - ${err.product} (${err.medusaId}): ${err.error}`)
      })
    }

    console.log(`[${timestamp}] 🎉 SCHEDULED-JOB: Sincronización de precios completada exitosamente`)
  } catch (error: any) {
    console.error(`[${timestamp}] ❌ SCHEDULED-JOB: Error en sincronización programada de precios:`, error.message || error)
    // No lanzar error para evitar que el job falle completamente
  }
}

export const config = {
  name: "sync-prices-to-odoo-scheduled",
  // Ejecutar cada 6 horas: "0 */6 * * *"
  // Para testing más frecuente: "*/30 * * * *" (cada 30 minutos)
  schedule: "0 */6 * * *", 
}

