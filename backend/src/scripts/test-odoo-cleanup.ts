import { cleanupOdooDuplicates, identifyOdooDuplicates } from "./cleanup-odoo-duplicates";

async function testOdooCleanup() {
  console.log("🧪 Iniciando prueba de limpieza de duplicados de Odoo...");

  try {
    // Primero identificar duplicados sin eliminarlos
    console.log("\n1️⃣ Identificando duplicados...");
    const identifyResult = await identifyOdooDuplicates();
    
    console.log("\n📊 Resultado de identificación:");
    console.log(`   Total productos: ${identifyResult.totalProducts}`);
    console.log(`   Duplicados encontrados: ${identifyResult.duplicatesFound}`);

    if (identifyResult.duplicatesFound === 0) {
      console.log("✅ No hay duplicados para limpiar");
      return;
    }

    // Preguntar si continuar con la limpieza
    console.log("\n⚠️ Se encontraron duplicados. ¿Desea continuar con la limpieza?");
    console.log("💡 Para ejecutar la limpieza real, use: npm run cleanup-odoo-duplicates");
    console.log("💡 O use el endpoint: POST /admin/cleanup-odoo-duplicates");

    // Simular limpieza (solo mostrar qué se haría)
    console.log("\n2️⃣ Simulando limpieza...");
    console.log("🔍 En modo de prueba, no se eliminarán productos reales");
    console.log("✅ Prueba completada exitosamente");

  } catch (error) {
    console.error("❌ Error en prueba de limpieza:", error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testOdooCleanup()
    .then(() => {
      console.log("\n🎉 Prueba completada exitosamente");
      process.exit(0);
    })
    .catch(error => {
      console.error("\n❌ Prueba falló:", error);
      process.exit(1);
    });
}

export default testOdooCleanup;
