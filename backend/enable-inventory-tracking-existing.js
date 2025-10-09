const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function enableInventoryTrackingExisting() {
  console.log("🔧 Habilitando tracking de inventario para productos existentes...\n");

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
    const uid = await client.request("call", {
      service: "common",
      method: "authenticate",
      args: [ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD, {}],
    });
    console.log(`✅ Autenticado con Odoo (UID: ${uid})\n`);

    // 1. Obtener todos los productos que no tienen tracking de inventario habilitado
    console.log("🔍 Buscando productos sin tracking de inventario...");
    const productsWithoutTracking = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["type", "=", "consu"]]], // Productos tipo "consumible" que no trackean inventario
        { fields: ["id", "name", "default_code", "type", "tracking", "sale_ok", "purchase_ok"] }
      ],
    });

    console.log(`✅ Encontrados ${productsWithoutTracking.length} productos sin tracking de inventario\n`);

    if (productsWithoutTracking.length === 0) {
      console.log("🎉 Todos los productos ya tienen tracking de inventario habilitado!");
      return;
    }

    // 2. Habilitar tracking de inventario para cada producto
    console.log("🔧 Habilitando tracking de inventario...\n");
    let updatedCount = 0;
    let errorCount = 0;

    for (const product of productsWithoutTracking) {
      try {
        console.log(`📦 Procesando: ${product.name} (ID: ${product.id})`);
        
        // Configurar producto para tracking de inventario
        const updateData = {
          type: "product", // Cambiar de "consu" a "product"
          tracking: "none", // Sin tracking de lotes/series por defecto
          sale_ok: true,    // Permitir ventas
          purchase_ok: true, // Permitir compras
          invoice_policy: "order" // Facturar cantidad ordenada
        };

        await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.template",
            "write",
            [[product.id], updateData]
          ],
        });

        console.log(`  ✅ Tracking de inventario habilitado: ${product.name}`);
        updatedCount++;
      } catch (error) {
        console.error(`  ❌ Error habilitando tracking para ${product.name}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Productos actualizados: ${updatedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);

    // 3. Verificar que los productos ahora tienen tracking habilitado
    console.log("\n🔍 Verificando que el tracking esté habilitado...");
    const updatedProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["id", "in", productsWithoutTracking.map(p => p.id)]]],
        { fields: ["id", "name", "default_code", "type", "tracking", "sale_ok", "purchase_ok"] }
      ],
    });

    console.log("📦 Estado final de los productos:");
    updatedProducts.forEach(product => {
      console.log(`   - ${product.name} (${product.default_code}):`);
      console.log(`     * Tipo: ${product.type}`);
      console.log(`     * Tracking: ${product.tracking}`);
      console.log(`     * Ventas: ${product.sale_ok ? 'Sí' : 'No'}`);
      console.log(`     * Compras: ${product.purchase_ok ? 'Sí' : 'No'}`);
    });

    console.log("\n🎉 ¡Tracking de inventario habilitado para productos existentes!");
    console.log("💡 Ahora todos los productos pueden sincronizar stock correctamente");

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

enableInventoryTrackingExisting();

