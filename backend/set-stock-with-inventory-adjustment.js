const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function setStockWithInventoryAdjustment() {
  console.log("📦 Estableciendo stock usando ajustes de inventario...\n");

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

    // 2. Obtener productos sin stock
    console.log("📦 Obteniendo productos sin stock...");
    
    const products = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["active", "=", true], ["qty_available", "=", 0]]],
        { 
          fields: ["id", "name", "default_code", "qty_available"]
        }
      ],
    });

    console.log(`✅ Encontrados ${products.length} productos sin stock\n`);

    if (products.length === 0) {
      console.log("🎉 Todos los productos ya tienen stock!");
      return;
    }

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

    // 4. Establecer stock directamente usando stock.quant
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const product of products) {
      console.log(`🔧 Estableciendo stock para: ${product.name} (${product.default_code})`);
      
      try {
        // Buscar si ya existe un stock.quant para este producto
        const existingQuants = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "stock.quant",
            "search_read",
            [[["product_id", "=", product.id], ["location_id", "=", mainLocation.id]]],
            { fields: ["id", "product_id", "location_id", "quantity"] }
          ],
        });

        if (existingQuants.length > 0) {
          // Actualizar stock existente
          const quant = existingQuants[0];
          await client.request("call", {
            service: "object",
            method: "execute_kw",
            args: [
              ODOO_DATABASE,
              uid,
              ODOO_PASSWORD,
              "stock.quant",
              "write",
              [[quant.id], { quantity: 100 }],
            ],
          });
          console.log(`   ✅ Stock actualizado: ${quant.quantity} → 100 unidades`);
        } else {
          // Crear nuevo stock.quant
          const quantId = await client.request("call", {
            service: "object",
            method: "execute_kw",
            args: [
              ODOO_DATABASE,
              uid,
              ODOO_PASSWORD,
              "stock.quant",
              "create",
              [{
                product_id: product.id,
                location_id: mainLocation.id,
                quantity: 100,
              }],
            ],
          });
          console.log(`   ✅ Stock creado: 100 unidades (Quant ID: ${quantId})`);
        }

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

    // 5. Resumen final
    console.log("\n📊 RESUMEN FINAL:");
    console.log("=" .repeat(60));
    console.log(`✅ Productos procesados exitosamente: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log("\n❌ Errores encontrados:");
      errors.forEach(error => console.log(`   - ${error}`));
    }

    // 6. Verificación final del stock
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
      console.log(`\n📋 Próximos pasos para probar:`);
      console.log(`   1. Hacer una orden en MedusaJS`);
      console.log(`   2. Verificar que se actualice el stock en Odoo (Operaciones → Inventario)`);
      console.log(`   3. Modificar stock manualmente en Odoo`);
      console.log(`   4. Esperar 15 minutos para que se sincronice a MedusaJS`);
    } else {
      console.log(`\n⚠️ Algunos productos aún no tienen stock. Revisa los errores arriba.`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

setStockWithInventoryAdjustment();
