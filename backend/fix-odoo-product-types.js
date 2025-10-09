const { JSONRPCClient } = require("json-rpc-2.0");

// Configuración de Odoo
const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function fixProductTypes() {
  console.log("🔧 Corrigiendo tipos de productos en Odoo...\n");

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
    // 1. Autenticar
    console.log("🔐 Autenticando en Odoo...");
    const uid = await client.request("call", {
      service: "common",
      method: "authenticate",
      args: [ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD, {}],
    });
    console.log(`✅ Autenticado con UID: ${uid}\n`);

    // 2. Buscar productos tipo "consu" (consumible)
    console.log("📦 Buscando productos tipo 'consu' (consumible)...");
    const consumableProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["type", "=", "consu"]]],
        { fields: ["id", "name", "default_code", "type"] }
      ],
    });

    console.log(`✅ Encontrados ${consumableProducts.length} productos consumibles\n`);

    if (consumableProducts.length === 0) {
      console.log("ℹ️ No hay productos para actualizar");
      return;
    }

    // 3. Actualizar cada producto a tipo "product" (almacenable)
    console.log("🔄 Actualizando productos a tipo 'product' (almacenable)...\n");
    let updatedCount = 0;
    let errorCount = 0;

    for (const product of consumableProducts) {
      try {
        console.log(`  Actualizando: ${product.name} (ID: ${product.id})`);
        
        await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.template",
            "write",
            [[product.id], { type: "product" }]
          ],
        });

        console.log(`    ✅ Actualizado: ${product.name}`);
        updatedCount++;
      } catch (error) {
        console.error(`    ❌ Error actualizando ${product.name}:`);
        console.error(`       Mensaje: ${error.message}`);
        console.error(`       Detalle:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Productos actualizados: ${updatedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);

    // 4. Verificar que los productos ahora son tipo "product"
    console.log("\n🔍 Verificando productos actualizados...");
    const updatedProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["type", "=", "product"]]],
        { fields: ["id", "name", "type", "qty_available", "virtual_available"] }
      ],
    });

    console.log(`✅ Productos almacenables ahora: ${updatedProducts.length}`);
    updatedProducts.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.name} - Tipo: ${p.type} - Stock: ${p.qty_available}`);
    });

    console.log("\n✨ ¡Listo! Ahora los productos pueden tener stock gestionado.");
    console.log("💡 Próximo paso: Establecer stock inicial en Odoo para cada producto.");

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

fixProductTypes();

