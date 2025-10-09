const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function checkTrackingValues() {
  console.log("🔍 Verificando valores válidos para tracking...\n");

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

    // 1. Obtener información del campo 'tracking'
    console.log("🔍 Obteniendo información del campo 'tracking'...");
    const fieldInfo = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "ir.model.fields",
        "search_read",
        [[["name", "=", "tracking"], ["model", "=", "product.template"]]],
        { fields: ["name", "field_description", "ttype", "help"] }
      ],
    });

    if (fieldInfo.length > 0) {
      console.log("📋 Información del campo 'tracking':");
      console.log(`   - Nombre: ${fieldInfo[0].name}`);
      console.log(`   - Descripción: ${fieldInfo[0].field_description}`);
      console.log(`   - Tipo: ${fieldInfo[0].ttype}`);
      console.log(`   - Ayuda: ${fieldInfo[0].help || 'N/A'}`);
    }

    // 2. Verificar productos existentes y sus valores de tracking
    console.log("\n📦 Verificando valores de tracking en productos existentes...");
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
        { fields: ["id", "name", "type", "tracking"], limit: 10 }
      ],
    });

    console.log("📊 Valores de tracking encontrados:");
    const trackingCounts = {};
    existingProducts.forEach(product => {
      console.log(`   - ${product.name}: tracking="${product.tracking}"`);
      trackingCounts[product.tracking] = (trackingCounts[product.tracking] || 0) + 1;
    });

    console.log("\n📈 Resumen de valores de tracking:");
    Object.entries(trackingCounts).forEach(([tracking, count]) => {
      console.log(`   - "${tracking}": ${count} productos`);
    });

    // 3. Probar diferentes valores de tracking
    console.log("\n🧪 Probando diferentes valores de tracking...");
    
    const testTrackingValues = ["none", "lot", "serial"];
    
    for (const trackingValue of testTrackingValues) {
      try {
        console.log(`\n🔧 Probando tracking: "${trackingValue}"`);
        
        const testData = {
          name: `Test ${trackingValue} - ${Date.now()}`,
          default_code: `TEST-${trackingValue}-${Date.now()}`,
          type: "consu",
          tracking: trackingValue,
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

        // Verificar configuración
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
          console.log(`   📊 Configuración: tracking="${product.tracking}"`);
          
          // Verificar si esto habilita el tracking de inventario
          if (product.tracking !== "none") {
            console.log(`   🎯 Este valor habilita tracking de inventario!`);
          }
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
        console.log(`   ❌ Error con tracking "${trackingValue}": ${error.message}`);
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

checkTrackingValues();

