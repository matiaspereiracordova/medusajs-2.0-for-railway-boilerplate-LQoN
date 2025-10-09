const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function testProductTypeValues() {
  console.log("🔍 Investigando valores válidos para product.template.type...\n");

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

    // Obtener información del campo 'type'
    const fields = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "fields_get",
        [],
        { attributes: ["string", "type", "help", "selection"] }
      ],
    });

    console.log("📋 Información del campo 'type':");
    console.log(JSON.stringify(fields.type, null, 2));

    if (fields.type && fields.type.selection) {
      console.log("\n✅ Valores válidos para 'type':");
      fields.type.selection.forEach(([value, label]) => {
        console.log(`  - "${value}": ${label}`);
      });
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testProductTypeValues();

