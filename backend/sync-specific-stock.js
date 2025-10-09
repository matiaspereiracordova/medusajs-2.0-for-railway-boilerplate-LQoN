const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function syncSpecificStock() {
  console.log("🔄 Sincronizando stock específico de MedusaJS → Odoo...\n");

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

    // Datos conocidos de MedusaJS
    const medusaStock = [
      { sku: "PNA", name: "Pierna jamon Serrano", stock: 100 },
      { sku: "comida-seca-de-gato", name: "Comida seca Gato", stock: 100 }
    ];

    // Buscar ubicación de stock en Odoo
    console.log("📍 Buscando ubicación de stock...");
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

    if (locations.length === 0) {
      console.error("❌ No se encontró ubicación de stock interna");
      return;
    }

    const location = locations[0];
    console.log(`✅ Ubicación encontrada: ${location.name} (ID: ${location.id})\n`);

    // Buscar ubicaciones de entrada y salida
    const externalLocation = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "stock.location",
        "search_read",
        [[["usage", "=", "supplier"]]],
        { fields: ["id", "name"], limit: 1 }
      ],
    });

    const supplierLocation = externalLocation.length > 0 ? externalLocation[0].id : 8; // Fallback

    let syncedCount = 0;
    let errorCount = 0;

    for (const item of medusaStock) {
      try {
        console.log(`🔍 Procesando: ${item.name} (SKU: ${item.sku})`);

        // Buscar producto en Odoo
        const odooProducts = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.product",
            "search_read",
            [[["default_code", "=", item.sku]]],
            { fields: ["id", "name", "default_code", "qty_available"] }
          ],
        });

        if (odooProducts.length === 0) {
          console.log(`  ⚠️ Producto ${item.sku} no encontrado en Odoo`);
          continue;
        }

        const odooProduct = odooProducts[0];
        const currentStock = odooProduct.qty_available || 0;
        const targetStock = item.stock;

        console.log(`  📊 Stock actual en Odoo: ${currentStock}`);
        console.log(`  🎯 Stock objetivo desde MedusaJS: ${targetStock}`);

        if (currentStock === targetStock) {
          console.log(`  ✅ Stock ya sincronizado`);
          continue;
        }

        // Calcular diferencia
        const difference = targetStock - currentStock;
        const quantity = Math.abs(difference);
        const moveType = difference > 0 ? "in" : "out";

        console.log(`  🔄 Ajustando stock: ${currentStock} → ${targetStock} (${moveType} ${quantity})`);

        // Crear movimiento de stock
        const moveData = {
          name: `Sincronización MedusaJS - ${item.sku}`,
          product_id: odooProduct.id,
          product_uom_qty: quantity,
          product_uom: 1, // Unidad estándar
          location_id: moveType === "in" ? supplierLocation : location.id,
          location_dest_id: moveType === "in" ? location.id : supplierLocation,
          state: "done",
          origin: "MedusaJS Sync"
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
        console.error(`  ❌ Error procesando ${item.sku}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Productos sincronizados: ${syncedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);

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
        [[["default_code", "in", ["PNA", "comida-seca-de-gato"]]]],
        { fields: ["id", "name", "default_code", "qty_available"] }
      ],
    });

    console.log("📦 Stock final en Odoo:");
    finalStock.forEach(product => {
      console.log(`   - ${product.name} (${product.default_code}): ${product.qty_available} unidades`);
    });

    if (syncedCount > 0) {
      console.log("\n🎉 ¡Sincronización completada!");
      console.log("💡 Ahora puedes verificar en Odoo que el stock se actualizó correctamente");
    }

  } catch (error) {
    console.error("❌ Error general:", error);
  }
}

syncSpecificStock();

