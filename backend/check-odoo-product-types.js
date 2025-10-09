const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function checkOdooProductTypes() {
  console.log("🔍 Verificando tipos de producto válidos en Odoo...\n");

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

    // 1. Obtener información del campo 'type' del modelo product.template
    console.log("🔍 Obteniendo información del campo 'type'...");
    const fieldInfo = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "ir.model.fields",
        "search_read",
        [[["name", "=", "type"], ["model", "=", "product.template"]]],
        { fields: ["name", "field_description", "ttype", "help"] }
      ],
    });

    if (fieldInfo.length > 0) {
      console.log("📋 Información del campo 'type':");
      console.log(`   - Nombre: ${fieldInfo[0].name}`);
      console.log(`   - Descripción: ${fieldInfo[0].field_description}`);
      console.log(`   - Tipo: ${fieldInfo[0].ttype}`);
      console.log(`   - Ayuda: ${fieldInfo[0].help || 'N/A'}`);
    }

    // 2. Verificar productos existentes y sus tipos
    console.log("\n📦 Verificando tipos de productos existentes...");
    const existingProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[]],
        { fields: ["id", "name", "type", "tracking", "sale_ok", "purchase_ok"], limit: 10 }
      ],
    });

    console.log("📊 Productos existentes y sus tipos:");
    const typeCounts = {};
    existingProducts.forEach(product => {
      console.log(`   - ${product.name}: tipo="${product.type}", tracking="${product.tracking}"`);
      typeCounts[product.type] = (typeCounts[product.type] || 0) + 1;
    });

    console.log("\n📈 Resumen de tipos encontrados:");
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`   - "${type}": ${count} productos`);
    });

    // 3. Intentar crear un producto con diferentes tipos
    console.log("\n🧪 Probando creación con diferentes tipos...");
    
    const testTypes = ["consu", "service", "product"];
    
    for (const testType of testTypes) {
      try {
        console.log(`\n🔧 Probando tipo: "${testType}"`);
        
        const testData = {
          name: `Test ${testType} - ${Date.now()}`,
          default_code: `TEST-${testType}-${Date.now()}`,
          type: testType,
          tracking: "none",
          sale_ok: true,
          purchase_ok: true,
          list_price: 1000
        };

        const productId = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.template",
            "create",
            [testData],
          ],
        });

        console.log(`   ✅ Éxito! Producto creado con ID: ${productId}`);

        // Verificar si tiene tracking habilitado
        const createdProduct = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.template",
            "search_read",
            [[["id", "=", productId]]],
            { fields: ["type", "tracking", "sale_ok", "purchase_ok"] }
          ],
        });

        if (createdProduct.length > 0) {
          const product = createdProduct[0];
          console.log(`   📊 Configuración: tipo="${product.type}", tracking="${product.tracking}"`);
        }

        // Limpiar
        try {
          await client.request("call", {
            service: "object",
            method: "execute_kw",
            args: [
              ODOO_DATABASE,
              uid,
              ODOO_PASSWORD,
              "product.template",
              "unlink",
              [[productId]],
            ],
          });
          console.log(`   🧹 Producto de prueba eliminado`);
        } catch (deleteError) {
          console.log(`   ⚠️ No se pudo eliminar el producto de prueba`);
        }

      } catch (error) {
        console.log(`   ❌ Error con tipo "${testType}": ${error.message}`);
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

checkOdooProductTypes();

