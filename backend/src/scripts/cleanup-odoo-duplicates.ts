import { odooClient } from "../services/odoo-client";

interface OdooProduct {
  id: number;
  name: string;
  default_code?: string;
  x_medusa_id?: string;
  list_price: number;
  active: boolean;
  create_date: string;
  write_date: string;
}

interface DuplicateGroup {
  key: string;
  products: OdooProduct[];
  keepProduct: OdooProduct;
  productsToDelete: OdooProduct[];
}

async function cleanupOdooDuplicates() {
  console.log("🧹 Iniciando limpieza de productos duplicados en Odoo...");

  try {
    // Autenticar con Odoo
    await odooClient.authenticate();
    console.log("✅ Autenticado en Odoo");

    // Obtener todos los productos de Odoo
    console.log("📦 Obteniendo todos los productos de Odoo...");
    const allProducts = await odooClient.searchRead(
      "product.template",
      [], // Sin filtros para obtener todos los productos
      [
        "id",
        "name", 
        "default_code",
        "x_medusa_id",
        "list_price",
        "active",
        "create_date",
        "write_date"
      ],
      10000 // Límite alto para obtener todos los productos
    ) as OdooProduct[];

    console.log(`📦 Total de productos encontrados en Odoo: ${allProducts.length}`);

    if (allProducts.length === 0) {
      console.log("✅ No hay productos en Odoo para procesar");
      return;
    }

    // Agrupar productos por diferentes criterios de duplicación
    const duplicatesByMedusaId = new Map<string, OdooProduct[]>();
    const duplicatesByName = new Map<string, OdooProduct[]>();
    const duplicatesByCode = new Map<string, OdooProduct[]>();

    // Agrupar por x_medusa_id (productos sincronizados desde MedusaJS)
    allProducts.forEach(product => {
      if (product.x_medusa_id) {
        const key = product.x_medusa_id;
        if (!duplicatesByMedusaId.has(key)) {
          duplicatesByMedusaId.set(key, []);
        }
        duplicatesByMedusaId.get(key)!.push(product);
      }
    });

    // Agrupar por nombre (productos con el mismo nombre)
    allProducts.forEach(product => {
      const key = product.name.toLowerCase().trim();
      if (!duplicatesByName.has(key)) {
        duplicatesByName.set(key, []);
      }
      duplicatesByName.get(key)!.push(product);
    });

    // Agrupar por código (productos con el mismo default_code)
    allProducts.forEach(product => {
      if (product.default_code) {
        const key = product.default_code.toLowerCase().trim();
        if (!duplicatesByCode.has(key)) {
          duplicatesByCode.set(key, []);
        }
        duplicatesByCode.get(key)!.push(product);
      }
    });

    // Encontrar duplicados
    const duplicateGroups: DuplicateGroup[] = [];

    // Duplicados por x_medusa_id (más críticos)
    for (const [medusaId, products] of duplicatesByMedusaId.entries()) {
      if (products.length > 1) {
        const sortedProducts = products.sort((a, b) => {
          // Priorizar: activo > fecha de modificación más reciente
          if (a.active && !b.active) return -1;
          if (!a.active && b.active) return 1;
          return new Date(b.write_date).getTime() - new Date(a.write_date).getTime();
        });

        duplicateGroups.push({
          key: `x_medusa_id: ${medusaId}`,
          products,
          keepProduct: sortedProducts[0],
          productsToDelete: sortedProducts.slice(1)
        });
      }
    }

    // Duplicados por nombre (menos críticos, solo si no tienen x_medusa_id)
    for (const [name, products] of duplicatesByName.entries()) {
      if (products.length > 1) {
        // Solo considerar duplicados por nombre si ninguno tiene x_medusa_id
        const productsWithoutMedusaId = products.filter(p => !p.x_medusa_id);
        if (productsWithoutMedusaId.length > 1) {
          const sortedProducts = productsWithoutMedusaId.sort((a, b) => {
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            return new Date(b.write_date).getTime() - new Date(a.write_date).getTime();
          });

          duplicateGroups.push({
            key: `name: ${name}`,
            products: productsWithoutMedusaId,
            keepProduct: sortedProducts[0],
            productsToDelete: sortedProducts.slice(1)
          });
        }
      }
    }

    // Duplicados por código (menos críticos, solo si no tienen x_medusa_id)
    for (const [code, products] of duplicatesByCode.entries()) {
      if (products.length > 1) {
        // Solo considerar duplicados por código si ninguno tiene x_medusa_id
        const productsWithoutMedusaId = products.filter(p => !p.x_medusa_id);
        if (productsWithoutMedusaId.length > 1) {
          const sortedProducts = productsWithoutMedusaId.sort((a, b) => {
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            return new Date(b.write_date).getTime() - new Date(a.write_date).getTime();
          });

          duplicateGroups.push({
            key: `code: ${code}`,
            products: productsWithoutMedusaId,
            keepProduct: sortedProducts[0],
            productsToDelete: sortedProducts.slice(1)
          });
        }
      }
    }

    console.log(`🔍 Grupos de duplicados encontrados: ${duplicateGroups.length}`);

    if (duplicateGroups.length === 0) {
      console.log("✅ No se encontraron duplicados en Odoo");
      return;
    }

    // Mostrar resumen de duplicados
    console.log("\n📋 Resumen de duplicados encontrados:");
    duplicateGroups.forEach((group, index) => {
      console.log(`\n${index + 1}. ${group.key}`);
      console.log(`   Total productos: ${group.products.length}`);
      console.log(`   ✅ Mantener: ${group.keepProduct.name} (ID: ${group.keepProduct.id})`);
      console.log(`   🗑️ Eliminar: ${group.productsToDelete.length} productos`);
      group.productsToDelete.forEach(product => {
        console.log(`      - ${product.name} (ID: ${product.id})`);
      });
    });

    // Confirmar eliminación
    console.log(`\n⚠️ Se eliminarán ${duplicateGroups.reduce((total, group) => total + group.productsToDelete.length, 0)} productos duplicados.`);
    console.log("🔄 Iniciando eliminación...");

    let totalDeleted = 0;
    const errors: Array<{ product: string; id: number; error: string }> = [];

    // Eliminar productos duplicados
    for (const group of duplicateGroups) {
      console.log(`\n🔄 Procesando grupo: ${group.key}`);
      
      for (const productToDelete of group.productsToDelete) {
        try {
          console.log(`   🗑️ Eliminando: ${productToDelete.name} (ID: ${productToDelete.id})`);
          
          // Eliminar producto en Odoo
          await odooClient.create("product.template", {
            id: productToDelete.id,
            active: false // Desactivar en lugar de eliminar para mantener integridad
          });
          
          totalDeleted++;
          console.log(`   ✅ Producto desactivado: ${productToDelete.name}`);
          
        } catch (error: any) {
          const errorMsg = `Error eliminando ${productToDelete.name}: ${error.message || error}`;
          console.error(`   ❌ ${errorMsg}`);
          errors.push({
            product: productToDelete.name,
            id: productToDelete.id,
            error: error.message || error
          });
        }
      }
    }

    // Resumen final
    console.log(`\n🎉 Limpieza completada:`);
    console.log(`   🗑️ Productos desactivados: ${totalDeleted}`);
    console.log(`   ❌ Errores: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Productos con errores:`);
      errors.forEach(err => {
        console.log(`   - ${err.product} (ID: ${err.id}): ${err.error}`);
      });
    }

    return {
      totalProducts: allProducts.length,
      duplicateGroups: duplicateGroups.length,
      productsDeleted: totalDeleted,
      errors: errors.length,
      errorDetails: errors
    };

  } catch (error) {
    console.error("❌ Error en limpieza de duplicados de Odoo:", error);
    throw error;
  }
}

// Función para solo identificar duplicados sin eliminarlos
async function identifyOdooDuplicates() {
  console.log("🔍 Identificando productos duplicados en Odoo...");

  try {
    await odooClient.authenticate();
    console.log("✅ Autenticado en Odoo");

    const allProducts = await odooClient.searchRead(
      "product.template",
      [],
      [
        "id",
        "name", 
        "default_code",
        "x_medusa_id",
        "list_price",
        "active",
        "create_date",
        "write_date"
      ],
      10000
    ) as OdooProduct[];

    console.log(`📦 Total de productos encontrados: ${allProducts.length}`);

    // Agrupar por x_medusa_id
    const duplicatesByMedusaId = new Map<string, OdooProduct[]>();
    allProducts.forEach(product => {
      if (product.x_medusa_id) {
        const key = product.x_medusa_id;
        if (!duplicatesByMedusaId.has(key)) {
          duplicatesByMedusaId.set(key, []);
        }
        duplicatesByMedusaId.get(key)!.push(product);
      }
    });

    // Mostrar duplicados por x_medusa_id
    console.log("\n🔍 Duplicados por x_medusa_id:");
    let duplicateCount = 0;
    for (const [medusaId, products] of duplicatesByMedusaId.entries()) {
      if (products.length > 1) {
        duplicateCount++;
        console.log(`\n${duplicateCount}. Medusa ID: ${medusaId} (${products.length} productos)`);
        products.forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name} (ID: ${product.id}) - ${product.active ? 'Activo' : 'Inactivo'} - ${product.write_date}`);
        });
      }
    }

    if (duplicateCount === 0) {
      console.log("✅ No se encontraron duplicados por x_medusa_id");
    }

    return {
      totalProducts: allProducts.length,
      duplicatesFound: duplicateCount
    };

  } catch (error) {
    console.error("❌ Error identificando duplicados:", error);
    throw error;
  }
}

// Función principal para ejecutar desde MedusaJS
async function main() {
  const action = process.argv[2];
  
  if (action === "identify") {
    return await identifyOdooDuplicates();
  } else {
    return await cleanupOdooDuplicates();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main()
    .then(result => {
      console.log("\n📊 Resumen:", result);
      process.exit(0);
    })
    .catch(error => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
}

export { cleanupOdooDuplicates, identifyOdooDuplicates };
export default main;
