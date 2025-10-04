import { MedusaContainer } from "@medusajs/framework/types";
import { cleanupOdooDuplicatesSimple } from "../scripts/cleanup-odoo-duplicates-simple";

export default async function cleanupOdooDuplicatesScheduledJob(container: MedusaContainer) {
  console.log("🧹 Iniciando limpieza programada de duplicados de Odoo...");

  try {
    const result = await cleanupOdooDuplicatesSimple();

    console.log("✅ Limpieza programada de duplicados de Odoo completada", {
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
    console.error("❌ Error en limpieza programada de duplicados de Odoo:", error);
    
    return {
      success: false,
      message: "Error en limpieza programada",
      error: error.message || error
    };
  }
}

export const config = {
  name: "cleanup-odoo-duplicates-scheduled",
  schedule: "0 2 * * *", // Ejecutar diariamente a las 2:00 AM
};
