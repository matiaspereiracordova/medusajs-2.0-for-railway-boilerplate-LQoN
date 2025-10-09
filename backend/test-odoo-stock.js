const { JSONRPCClient } = require("json-rpc-2.0");

// Configuración de Odoo
const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function testOdooStock() {
  console.log("🔍 Investigando estructura de productos en Odoo...\n");

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

    // 2. Buscar TODOS los product.template
    console.log("📦 Buscando product.template (plantillas de productos)...");
    const templates = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[]],
        { 
          fields: ["id", "name", "default_code", "type", "list_price", "qty_available", "virtual_available"],
          limit: 10 
        }
      ],
    });
    
    console.log(`✅ Encontrados ${templates.length} product.template:`);
    templates.forEach((t, idx) => {
      console.log(`\n  ${idx + 1}. ${t.name}`);
      console.log(`     ID: ${t.id}`);
      console.log(`     SKU (default_code): ${t.default_code || 'NO TIENE'}`);
      console.log(`     Tipo: ${t.type}`);
      console.log(`     Precio: ${t.list_price}`);
      console.log(`     Stock disponible: ${t.qty_available}`);
      console.log(`     Stock virtual: ${t.virtual_available}`);
    });

    // 3. Buscar TODOS los product.product (variantes)
    console.log("\n\n📦 Buscando product.product (variantes de productos)...");
    const products = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[]],
        { 
          fields: ["id", "name", "default_code", "type", "list_price", "qty_available", "virtual_available", "product_tmpl_id"],
          limit: 10 
        }
      ],
    });
    
    console.log(`✅ Encontrados ${products.length} product.product:`);
    products.forEach((p, idx) => {
      console.log(`\n  ${idx + 1}. ${p.name}`);
      console.log(`     ID: ${p.id}`);
      console.log(`     Template ID: ${p.product_tmpl_id ? p.product_tmpl_id[0] : 'N/A'}`);
      console.log(`     SKU (default_code): ${p.default_code || 'NO TIENE'}`);
      console.log(`     Tipo: ${p.type}`);
      console.log(`     Precio: ${p.list_price}`);
      console.log(`     Stock disponible: ${p.qty_available}`);
      console.log(`     Stock virtual: ${p.virtual_available}`);
    });

    // 4. Intentar buscar productos con SKU específico
    console.log("\n\n📦 Intentando buscar productos CON SKU definido...");
    const productsWithSku = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["default_code", "!=", false]]],
        { 
          fields: ["id", "name", "default_code", "qty_available", "virtual_available"],
          limit: 20 
        }
      ],
    });
    
    console.log(`✅ Encontrados ${productsWithSku.length} productos con SKU:`);
    productsWithSku.forEach((p, idx) => {
      console.log(`  ${idx + 1}. SKU: "${p.default_code}" - ${p.name} - Stock: ${p.qty_available}`);
    });

    // 5. Ver campos disponibles de product.product
    console.log("\n\n📋 Campos disponibles en product.product:");
    const fields = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "fields_get",
        [],
        { attributes: ["string", "type", "help"] }
      ],
    });
    
    const relevantFields = ["default_code", "qty_available", "virtual_available", "incoming_qty", "outgoing_qty", "type"];
    console.log("\nCampos relevantes para stock:");
    relevantFields.forEach(field => {
      if (fields[field]) {
        console.log(`  - ${field}:`);
        console.log(`    Nombre: ${fields[field].string}`);
        console.log(`    Tipo: ${fields[field].type}`);
        if (fields[field].help) {
          console.log(`    Ayuda: ${fields[field].help}`);
        }
      }
    });

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testOdooStock();

