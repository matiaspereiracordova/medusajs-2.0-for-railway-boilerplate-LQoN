import { ScheduledJobConfig, ScheduledJobArgs } from "@medusajs/framework";
import { cleanupOdooDuplicates } from "../scripts/cleanup-odoo-duplicates";

export const config: ScheduledJobConfig = {
  name: "cleanup-odoo-duplicates-scheduled",
  schedule: "0 2 * * *", // Ejecutar diariamente a las 2:00 AM
  data: {},
};

export default async function handler({ container, data, logger }: ScheduledJobArgs) {
  try {
    logger.info("🧹 Iniciando limpieza programada de duplicados de Odoo...");

    const result = await cleanupOdooDuplicates();

    logger.info("✅ Limpieza programada de duplicados de Odoo completada", {
      total_products: result.totalProducts,
      duplicate_groups: result.duplicateGroups,
      products_deleted: result.productsDeleted,
      errors: result.errors
    });

    return {
      success: true,
      message: "Limpieza programada completada",
      data: result
    };

  } catch (error: any) {
    logger.error("❌ Error en limpieza programada de duplicados de Odoo:", error);
    
    return {
      success: false,
      message: "Error en limpieza programada",
      error: error.message || error
    };
  }
}
