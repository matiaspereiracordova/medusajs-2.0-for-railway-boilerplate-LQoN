const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function enableTrackingOnly() {
  console.log("🔧 Habilitando solo el tracking de inventario (sin cambiar tipo)...\n");

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

    // 1. Obtener todos los productos tipo "consu"
    console.log("🔍 Buscando productos tipo 'consu'...");
    const consuProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["type", "=", "consu"]]],
        { fields: ["id", "name", "default_code", "type", "tracking", "sale_ok", "purchase_ok", "qty_available"] }
      ],
    });

    console.log(`✅ Encontrados ${consuProducts.length} productos tipo 'consu'\n`);

    // 2. Intentar habilitar solo el tracking sin cambiar el tipo
    console.log("🔧 Habilitando tracking de inventario (manteniendo tipo 'consu')...\n");
    let updatedCount = 0;
    let errorCount = 0;

    for (const product of consuProducts) {
      try {
        console.log(`📦 Procesando: ${product.name} (ID: ${product.id})`);
        
        // Solo habilitar tracking sin cambiar el tipo
        const updateData = {
          tracking: "quantity", // Habilitar tracking por cantidad
          sale_ok: true,        // Permitir ventas
          purchase_ok: true,    // Permitir compras
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

        console.log(`  ✅ Tracking habilitado: ${product.name}`);
        updatedCount++;
      } catch (error) {
        console.error(`  ❌ Error habilitando tracking para ${product.name}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Productos actualizados: ${updatedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);

    // 3. Verificar estado final
    console.log("\n🔍 Verificando estado final...");
    const finalProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["id", "in", consuProducts.map(p => p.id)]]],
        { fields: ["id", "name", "default_code", "type", "tracking", "sale_ok", "purchase_ok", "qty_available"] }
      ],
    });

    console.log("📦 Estado final de los productos:");
    finalProducts.forEach(product => {
      console.log(`   - ${product.name} (${product.default_code}):`);
      console.log(`     * Tipo: ${product.type}`);
      console.log(`     * Tracking: ${product.tracking}`);
      console.log(`     * Stock disponible: ${product.qty_available}`);
      console.log(`     * Ventas: ${product.sale_ok ? 'Sí' : 'No'}`);
      console.log(`     * Compras: ${product.purchase_ok ? 'Sí' : 'No'}`);
    });

    // 4. Verificar si ahora aparecen en el stock
    console.log("\n📊 Verificando productos con stock > 0...");
    const stockProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["qty_available", ">", 0]]],
        { fields: ["id", "name", "default_code", "qty_available"] }
      ],
    });

    if (stockProducts.length > 0) {
      console.log(`✅ Productos con stock > 0: ${stockProducts.length}`);
      stockProducts.forEach(p => {
        console.log(`   - ${p.name} (${p.default_code}): ${p.qty_available} unidades`);
      });
    } else {
      console.log("ℹ️ No hay productos con stock > 0");
    }

    console.log("\n🎉 ¡Configuración completada!");
    console.log("💡 Los productos ahora deberían aparecer en el reporte de Stock de Odoo");

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

enableTrackingOnly();

