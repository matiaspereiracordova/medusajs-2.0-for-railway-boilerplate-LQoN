const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

const MEDUSA_URL = process.env.MEDUSA_URL || "https://backend-production-6f9f.up.railway.app";

async function syncMedusaToOdooStock() {
  console.log("🔄 Sincronizando stock de MedusaJS → Odoo...\n");

  const odooClient = new JSONRPCClient(async (jsonRPCRequest) => {
    const response = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonRPCRequest),
    });
    if (response.status === 200) {
      const jsonRPCResponse = await response.json();
      return odooClient.receive(jsonRPCResponse);
    } else {
      throw new Error(`Odoo API error: ${response.status}`);
    }
  });

  try {
    // 1. Autenticar con Odoo
    const uid = await odooClient.request("call", {
      service: "common",
      method: "authenticate",
      args: [ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD, {}],
    });
    console.log(`✅ Autenticado con Odoo (UID: ${uid})\n`);

    // 2. Obtener stock de MedusaJS
    console.log("📦 Obteniendo stock de MedusaJS...");
    const medusaResponse = await fetch(`${MEDUSA_URL}/admin/inventory-items`);
    
    if (!medusaResponse.ok) {
      console.error(`❌ Error obteniendo stock de MedusaJS: ${medusaResponse.status}`);
      return;
    }

    const medusaInventory = await medusaResponse.json();
    console.log(`✅ Obtenidos ${medusaInventory.inventory_items?.length || 0} items de inventario de MedusaJS\n`);

    // 3. Procesar cada item de inventario
    let syncedCount = 0;
    let errorCount = 0;

    for (const item of medusaInventory.inventory_items || []) {
      try {
        const sku = item.sku;
        const medusaStock = item.stocked_quantity || 0;

        console.log(`🔍 Procesando: ${sku} (Stock MedusaJS: ${medusaStock})`);

        // Buscar producto en Odoo por SKU
        const odooProducts = await odooClient.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.product",
            "search_read",
            [[["default_code", "=", sku]]],
            { fields: ["id", "name", "default_code", "qty_available"] }
          ],
        });

        if (odooProducts.length === 0) {
          console.log(`  ⚠️ Producto ${sku} no encontrado en Odoo`);
          continue;
        }

        const odooProduct = odooProducts[0];
        const odooStock = odooProduct.qty_available || 0;

        console.log(`  📊 Odoo stock actual: ${odooStock}`);

        // Si hay diferencia, crear ajuste de inventario
        if (medusaStock !== odooStock) {
          console.log(`  🔄 Sincronizando: ${odooStock} → ${medusaStock}`);

          // Buscar ubicación de stock
          const locations = await odooClient.request("call", {
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
            console.log(`  ❌ No se encontró ubicación de stock`);
            continue;
          }

          const location = locations[0];

          // Crear movimiento de stock para ajustar la diferencia
          const difference = medusaStock - odooStock;
          const moveType = difference > 0 ? "in" : "out";
          const quantity = Math.abs(difference);

          console.log(`  📝 Creando movimiento: ${moveType} ${quantity} unidades`);

          // Crear movimiento de stock
          const moveData = {
            name: `Sincronización MedusaJS - ${sku}`,
            product_id: odooProduct.id,
            product_uom_qty: quantity,
            product_uom: 1, // Unidad estándar
            location_id: moveType === "in" ? 8 : location.id, // Entrada desde stock externo o salida a cliente
            location_dest_id: moveType === "in" ? location.id : 9, // Destino a ubicación interna o cliente
            state: "done"
          };

          await odooClient.request("call", {
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

          console.log(`  ✅ Stock sincronizado: ${sku} = ${medusaStock} unidades`);
          syncedCount++;
        } else {
          console.log(`  ✅ Stock ya sincronizado: ${sku}`);
        }

      } catch (error) {
        console.error(`  ❌ Error procesando ${item.sku}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen de sincronización:`);
    console.log(`   ✅ Productos sincronizados: ${syncedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);

    // 4. Verificar stock final en Odoo
    console.log("\n🔍 Verificando stock final en Odoo...");
    const finalStock = await odooClient.request("call", {
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

    console.log("\n🎉 ¡Sincronización completada!");

  } catch (error) {
    console.error("❌ Error general:", error);
  }
}

syncMedusaToOdooStock();

