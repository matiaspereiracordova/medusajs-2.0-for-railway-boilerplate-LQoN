const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function setInitialStock() {
  console.log("📦 Estableciendo stock inicial en Odoo...\n");

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
    console.log(`✅ Autenticado con UID: ${uid}\n`);

    // 1. Obtener ubicación de stock principal
    console.log("📍 Buscando ubicación de stock principal...");
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
        { fields: ["id", "name", "complete_name"], limit: 1 }
      ],
    });

    if (locations.length === 0) {
      console.error("❌ No se encontró ubicación de stock interna");
      return;
    }

    const location = locations[0];
    console.log(`✅ Ubicación encontrada: ${location.complete_name} (ID: ${location.id})\n`);

    // 2. Obtener productos
    console.log("📦 Obteniendo productos...");
    const products = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["type", "=", "consu"], ["default_code", "!=", false]]],
        { fields: ["id", "name", "default_code"] }
      ],
    });

    console.log(`✅ Encontrados ${products.length} productos\n`);

    // 3. Crear ajuste de inventario
    console.log("🔧 Creando ajuste de inventario...");
    const inventoryData = {
      name: `Ajuste inicial - ${new Date().toLocaleDateString()}`,
      location_ids: [[6, 0, [location.id]]], // Asociar con la ubicación
      state: "draft"
    };

    const inventoryId = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "stock.inventory",
        "create",
        [inventoryData]
      ],
    });

    console.log(`✅ Ajuste de inventario creado (ID: ${inventoryId})\n`);

    // 4. Añadir productos al ajuste con stock inicial
    console.log("📝 Añadiendo productos al ajuste...");
    let addedCount = 0;

    for (const product of products) {
      try {
        const initialQuantity = 100; // Cantidad inicial por producto

        const lineData = {
          inventory_id: inventoryId,
          product_id: product.id,
          location_id: location.id,
          product_qty: initialQuantity,
          theoretical_qty: 0 // Cantidad teórica (actual)
        };

        await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "stock.inventory.line",
            "create",
            [lineData]
          ],
        });

        console.log(`  ✅ ${product.name}: ${initialQuantity} unidades`);
        addedCount++;
      } catch (error) {
        console.error(`  ❌ Error añadiendo ${product.name}:`, error.message);
      }
    }

    console.log(`\n📊 Productos añadidos: ${addedCount}/${products.length}`);

    // 5. Confirmar el ajuste
    console.log("\n✅ Confirmando ajuste de inventario...");
    try {
      await client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          ODOO_DATABASE,
          uid,
          ODOO_PASSWORD,
          "stock.inventory",
          "action_start",
          [[inventoryId]]
        ],
      });

      await client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          ODOO_DATABASE,
          uid,
          ODOO_PASSWORD,
          "stock.inventory",
          "action_validate",
          [[inventoryId]]
        ],
      });

      console.log("✅ Ajuste confirmado y validado");
    } catch (error) {
      console.error("❌ Error confirmando ajuste:", error.message);
      console.log("💡 Puedes confirmarlo manualmente desde la interfaz de Odoo");
    }

    // 6. Verificar stock actualizado
    console.log("\n🔍 Verificando stock actualizado...");
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
      console.log(`✅ Productos con stock actualizado: ${stockProducts.length}`);
      stockProducts.forEach(p => {
        console.log(`  - ${p.name}: ${p.qty_available} unidades`);
      });
    } else {
      console.log("ℹ️ Stock aún no actualizado. Puede tomar unos minutos.");
    }

    console.log("\n🎉 ¡Proceso completado!");
    console.log("💡 Ahora puedes probar la sincronización de stock desde MedusaJS");

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

setInitialStock();

