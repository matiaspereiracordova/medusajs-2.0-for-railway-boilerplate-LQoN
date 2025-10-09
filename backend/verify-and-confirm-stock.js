const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function verifyAndConfirmStock() {
  console.log("🔍 Verificando y confirmando movimientos de stock...\n");

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

    // 1. Verificar movimientos recientes
    console.log("📋 Verificando movimientos recientes de stock...");
    const recentMoves = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "stock.move",
        "search_read",
        [[["origin", "ilike", "MedusaJS"]]],
        { fields: ["id", "name", "product_id", "product_uom_qty", "state", "origin"], order: "id desc", limit: 10 }
      ],
    });

    console.log(`✅ Encontrados ${recentMoves.length} movimientos de MedusaJS:`);
    recentMoves.forEach(move => {
      console.log(`   - ID: ${move.id}, Producto: ${move.product_id}, Cantidad: ${move.product_uom_qty}, Estado: ${move.state}`);
    });

    // 2. Verificar stock actual
    console.log("\n📦 Verificando stock actual...");
    const currentStock = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["default_code", "in", ["comida", "comida-seca-de-gato"]]]],
        { fields: ["id", "name", "default_code", "qty_available", "virtual_available"] }
      ],
    });

    console.log("📊 Stock actual:");
    currentStock.forEach(product => {
      console.log(`   - ${product.name} (${product.default_code}):`);
      console.log(`     * Disponible: ${product.qty_available}`);
      console.log(`     * Virtual: ${product.virtual_available}`);
    });

    // 3. Intentar crear un ajuste de inventario directo
    console.log("\n🔧 Creando ajuste de inventario directo...");
    
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
    console.log(`📍 Ubicación: ${location.name} (ID: ${location.id})`);

    // Buscar producto "comida" (Pierna jamon Serrano)
    const jamonProduct = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["default_code", "=", "comida"]]],
        { fields: ["id", "name", "default_code"] }
      ],
    });

    if (jamonProduct.length > 0) {
      const product = jamonProduct[0];
      console.log(`🍖 Producto encontrado: ${product.name} (ID: ${product.id})`);

      // Crear cuantificación de stock directa
      console.log("📝 Creando cuantificación de stock...");
      try {
        const quantData = {
          product_id: product.id,
          location_id: location.id,
          quantity: 100,
          in_date: new Date().toISOString().split('T')[0]
        };

        const quantId = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "stock.quant",
            "create",
            [quantData]
          ],
        });

        console.log(`✅ Cuantificación creada (ID: ${quantId})`);
      } catch (error) {
        console.log(`⚠️ Error creando cuantificación: ${error.message}`);
        
        // Intentar método alternativo: actualizar stock directamente
        console.log("🔄 Intentando actualización directa...");
        try {
          await client.request("call", {
            service: "object",
            method: "execute_kw",
            args: [
              ODOO_DATABASE,
              uid,
              ODOO_PASSWORD,
              "product.product",
              "write",
              [[product.id], { qty_available: 100 }]
            ],
          });
          console.log("✅ Stock actualizado directamente");
        } catch (directError) {
          console.log(`❌ Error en actualización directa: ${directError.message}`);
        }
      }
    }

    // 4. Verificar stock final
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

    console.log("📦 Stock final:");
    finalStock.forEach(product => {
      console.log(`   - ${product.name} (${product.default_code}): ${product.qty_available} unidades`);
    });

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

verifyAndConfirmStock();

