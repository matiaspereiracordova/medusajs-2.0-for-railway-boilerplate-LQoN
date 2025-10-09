const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function setInitialStockAllProducts() {
  console.log("📦 Estableciendo stock inicial para todos los productos...\n");

  const client = new JSONRPCClient(async (jsonRPCRequest) => {
    const response = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonRPCRequest),
    });
    if (response.status === 200) {
      const jsonRPCResponse = await response.json();
      return client.receive(jsonRPCResponse);
    } else {
      throw new Error(`Odoo API error: ${response.status}`);
    }
  });

  try {
    // 1. Autenticar con Odoo
    const uid = await client.request("call", {
      service: "common",
      method: "authenticate",
      args: [ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD, {}],
    });
    console.log(`✅ Autenticado con Odoo (UID: ${uid})\n`);

    // 2. Obtener todos los productos activos
    console.log("📦 Obteniendo productos activos...");
    
    const products = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["active", "=", true]]],
        { 
          fields: ["id", "name", "default_code", "qty_available", "tracking"]
        }
      ],
    });

    console.log(`✅ Encontrados ${products.length} productos activos\n`);

    // 3. Obtener ubicación de stock principal
    console.log("📍 Obteniendo ubicación de stock...");
    
    const locations = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "stock.location",
        "search_read",
        [[["usage", "=", "internal"]]],
        { fields: ["id", "name"] }
      ],
    });

    if (locations.length === 0) {
      console.log("❌ No se encontraron ubicaciones de stock internas");
      return;
    }

    const mainLocation = locations[0];
    console.log(`📍 Usando ubicación: ${mainLocation.name} (ID: ${mainLocation.id})\n`);

    // 4. Obtener unidad de medida por defecto
    console.log("📏 Obteniendo unidad de medida...");
    
    const uoms = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "uom.uom",
        "search_read",
        [[["name", "=", "Units"]]],
        { fields: ["id", "name"] }
      ],
    });

    if (uoms.length === 0) {
      console.log("❌ No se encontró unidad de medida 'Units'");
      return;
    }

    const defaultUom = uoms[0];
    console.log(`📏 Usando unidad: ${defaultUom.name} (ID: ${defaultUom.id})\n`);

    // 5. Establecer stock inicial para cada producto
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const product of products) {
      console.log(`🔧 Procesando: ${product.name} (${product.default_code})`);
      
      // Solo procesar productos sin stock
      if (product.qty_available > 0) {
        console.log(`   ℹ️ Ya tiene stock: ${product.qty_available} unidades`);
        continue;
      }

      try {
        // Crear movimiento de stock para establecer stock inicial
        const stockMoveId = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "stock.move",
            "create",
            [{
              name: `Stock inicial - ${product.name}`,
              product_id: product.id,
              product_uom_qty: 100, // Stock inicial de 100 unidades
              product_uom: defaultUom.id,
              location_id: mainLocation.id,
              location_dest_id: mainLocation.id,
              origin: "Stock inicial automático",
              state: "done", // Marcarlo como completado
              move_type: "in", // Movimiento de entrada
            }],
          ],
        });

        console.log(`   ✅ Stock inicial establecido: 100 unidades (Move ID: ${stockMoveId})`);
        successCount++;

        // Verificar que el stock se actualizó
        const updatedProduct = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.template",
            "read",
            [[product.id]],
            { fields: ["id", "name", "qty_available"] }
          ],
        });

        if (updatedProduct.length > 0) {
          console.log(`   📊 Stock verificado: ${updatedProduct[0].qty_available} unidades`);
        }

      } catch (error) {
        errorCount++;
        const errorMsg = `Error estableciendo stock para ${product.name}: ${error.message}`;
        console.error(`   ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // 6. Resumen final
    console.log("\n📊 RESUMEN FINAL:");
    console.log("=" .repeat(60));
    console.log(`✅ Productos procesados exitosamente: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log("\n❌ Errores encontrados:");
      errors.forEach(error => console.log(`   - ${error}`));
    }

    // 7. Verificación final del stock
    console.log("\n🔍 VERIFICACIÓN FINAL DEL STOCK:");
    console.log("=" .repeat(60));
    
    const finalProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["active", "=", true]]],
        { 
          fields: ["id", "name", "default_code", "qty_available"]
        }
      ],
    });

    let totalStock = 0;
    let productsWithStock = 0;

    finalProducts.forEach(product => {
      if (product.qty_available > 0) {
        productsWithStock++;
      }
      totalStock += product.qty_available || 0;
      console.log(`📦 ${product.name}: ${product.qty_available || 0} unidades`);
    });

    console.log(`\n📈 Estadísticas finales:`);
    console.log(`   * Productos con stock: ${productsWithStock}/${finalProducts.length}`);
    console.log(`   * Stock total: ${totalStock} unidades`);

    if (productsWithStock === finalProducts.length) {
      console.log(`\n🎉 ¡Todos los productos tienen stock inicial establecido!`);
      console.log(`💡 El sistema de sincronización bidireccional está listo para funcionar.`);
    } else {
      console.log(`\n⚠️ Algunos productos aún no tienen stock. Revisa los errores arriba.`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

setInitialStockAllProducts();
