const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function findPnaProduct() {
  console.log("🔍 Buscando producto 'Pierna jamon Serrano' en Odoo...\n");

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

    // 1. Buscar por nombre "jamón" o "jamon"
    console.log("🔍 Buscando productos con 'jamón' en el nombre...");
    const jamonProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["name", "ilike", "jamon"]]],
        { fields: ["id", "name", "default_code", "qty_available"] }
      ],
    });

    console.log(`✅ Encontrados ${jamonProducts.length} productos con 'jamon':`);
    jamonProducts.forEach(product => {
      console.log(`   - ID: ${product.id}, Nombre: ${product.name}, SKU: ${product.default_code}, Stock: ${product.qty_available}`);
    });

    // 2. Buscar por nombre "pierna"
    console.log("\n🔍 Buscando productos con 'pierna' en el nombre...");
    const piernaProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["name", "ilike", "pierna"]]],
        { fields: ["id", "name", "default_code", "qty_available"] }
      ],
    });

    console.log(`✅ Encontrados ${piernaProducts.length} productos con 'pierna':`);
    piernaProducts.forEach(product => {
      console.log(`   - ID: ${product.id}, Nombre: ${product.name}, SKU: ${product.default_code}, Stock: ${product.qty_available}`);
    });

    // 3. Buscar por SKU "comida"
    console.log("\n🔍 Buscando productos con SKU 'comida'...");
    const comidaProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["default_code", "=", "comida"]]],
        { fields: ["id", "name", "default_code", "qty_available"] }
      ],
    });

    console.log(`✅ Encontrados ${comidaProducts.length} productos con SKU 'comida':`);
    comidaProducts.forEach(product => {
      console.log(`   - ID: ${product.id}, Nombre: ${product.name}, SKU: ${product.default_code}, Stock: ${product.qty_available}`);
    });

    // 4. Listar todos los productos para comparar
    console.log("\n📦 Listando todos los productos para comparar...");
    const allProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[]],
        { fields: ["id", "name", "default_code", "qty_available"] }
      ],
    });

    console.log(`✅ Todos los productos en Odoo (${allProducts.length}):`);
    allProducts.forEach(product => {
      console.log(`   - ID: ${product.id}, Nombre: ${product.name}, SKU: ${product.default_code}, Stock: ${product.qty_available}`);
    });

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

findPnaProduct();

