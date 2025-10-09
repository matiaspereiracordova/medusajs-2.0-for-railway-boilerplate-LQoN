const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function syncCorrectSku() {
  console.log("🔄 Sincronizando stock con SKUs correctos...\n");

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

    // Datos correctos: SKU de MedusaJS → SKU de Odoo
    const stockMapping = [
      { 
        medusaSku: "PNA", 
        odooSku: "comida", 
        name: "Pierna jamon Serrano", 
        targetStock: 100 
      },
      { 
        medusaSku: "comida-seca-de-gato", 
        odooSku: "comida-seca-de-gato", 
        name: "Comida seca Gato", 
        targetStock: 100 
      }
    ];

    // Buscar ubicación de stock
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
        { fields: ["id", "name"], limit: 1 }
      ],
    });

    const location = locations[0];
    console.log(`📍 Ubicación de stock: ${location.name} (ID: ${location.id})\n`);

    let syncedCount = 0;

    for (const mapping of stockMapping) {
      try {
        console.log(`🔍 Procesando: ${mapping.name}`);
        console.log(`   MedusaJS SKU: ${mapping.medusaSku}`);
        console.log(`   Odoo SKU: ${mapping.odooSku}`);

        // Buscar producto en Odoo por SKU correcto
        const odooProducts = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.product",
            "search_read",
            [[["default_code", "=", mapping.odooSku]]],
            { fields: ["id", "name", "default_code", "qty_available"] }
          ],
        });

        if (odooProducts.length === 0) {
          console.log(`  ❌ Producto con SKU '${mapping.odooSku}' no encontrado en Odoo`);
          continue;
        }

        const odooProduct = odooProducts[0];
        const currentStock = odooProduct.qty_available || 0;
        const targetStock = mapping.targetStock;

        console.log(`  📊 Stock actual en Odoo: ${currentStock}`);
        console.log(`  🎯 Stock objetivo: ${targetStock}`);

        if (currentStock === targetStock) {
          console.log(`  ✅ Stock ya sincronizado`);
          continue;
        }

        // Calcular diferencia y crear movimiento
        const difference = targetStock - currentStock;
        const quantity = Math.abs(difference);
        const moveType = difference > 0 ? "in" : "out";

        console.log(`  🔄 Ajustando: ${currentStock} → ${targetStock} (${moveType} ${quantity})`);

        // Crear movimiento de stock
        const moveData = {
          name: `Sincronización MedusaJS - ${mapping.name}`,
          product_id: odooProduct.id,
          product_uom_qty: quantity,
          product_uom: 1,
          location_id: moveType === "in" ? 8 : location.id, // Entrada desde proveedor o salida a cliente
          location_dest_id: moveType === "in" ? location.id : 9,
          state: "done",
          origin: `MedusaJS Sync (${mapping.medusaSku})`
        };

        const moveId = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "stock.move",
            "create",
            [moveData]
          ],
        });

        console.log(`  ✅ Movimiento creado (ID: ${moveId})`);
        syncedCount++;

      } catch (error) {
        console.error(`  ❌ Error procesando ${mapping.name}:`, error.message);
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Productos sincronizados: ${syncedCount}`);

    // Verificar stock final
    console.log("\n🔍 Verificando stock final...");
    const finalStock = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["default_code", "in", ["comida", "comida-seca-de-gato"]]]],
        { fields: ["id", "name", "default_code", "qty_available"] }
      ],
    });

    console.log("📦 Stock final en Odoo:");
    finalStock.forEach(product => {
      console.log(`   - ${product.name} (${product.default_code}): ${product.qty_available} unidades`);
    });

    console.log("\n🎉 ¡Sincronización completada!");
    console.log("💡 Ahora verifica en Odoo que ambos productos tienen stock = 100");

  } catch (error) {
    console.error("❌ Error general:", error);
  }
}

syncCorrectSku();

