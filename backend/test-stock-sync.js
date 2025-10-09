const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function testStockSync() {
  console.log("🧪 Probando sincronización de stock...\n");

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

    // 1. Verificar stock de "comida seca gato"
    console.log("🔍 Verificando stock de 'comida seca gato'...");
    const products = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["default_code", "=", "comida-seca-de-gato"]]],
        { fields: ["id", "name", "default_code", "qty_available", "virtual_available", "incoming_qty", "outgoing_qty"] }
      ],
    });

    if (products.length === 0) {
      console.log("❌ Producto 'comida-seca-de-gato' no encontrado");
      return;
    }

    const product = products[0];
    console.log(`✅ Producto encontrado: ${product.name}`);
    console.log(`   SKU: ${product.default_code}`);
    console.log(`   Cantidad disponible: ${product.qty_available}`);
    console.log(`   Cantidad virtual: ${product.virtual_available}`);
    console.log(`   Cantidad entrante: ${product.incoming_qty}`);
    console.log(`   Cantidad saliente: ${product.outgoing_qty}\n`);

    if (product.qty_available > 0) {
      console.log("🎉 ¡Stock disponible! La sincronización debería funcionar.\n");
      
      // 2. Probar endpoint de MedusaJS
      console.log("🔗 Probando endpoint de verificación de stock en MedusaJS...");
      try {
        const medusaResponse = await fetch("https://backend-production-6f9f.up.railway.app/store/check-stock?sku=comida-seca-de-gato&quantity=1");
        if (medusaResponse.ok) {
          const stockData = await medusaResponse.json();
          console.log("✅ Endpoint de MedusaJS funcionando:");
          console.log(`   En stock: ${stockData.inStock}`);
          console.log(`   Disponible: ${stockData.available}`);
          console.log(`   Virtual disponible: ${stockData.virtual_available}`);
          console.log(`   Solicitado: ${stockData.requested}`);
        } else {
          console.log(`❌ Error en endpoint MedusaJS: ${medusaResponse.status}`);
        }
      } catch (error) {
        console.log(`❌ Error conectando con MedusaJS: ${error.message}`);
      }

    } else {
      console.log("⚠️ Stock = 0. Necesitas establecer stock inicial:");
      console.log("   1. Ve al ajuste de inventario en Odoo");
      console.log("   2. En 'Cantidades contadas' escribe una cantidad (ej: 100)");
      console.log("   3. Haz clic en 'Aplicar'");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testStockSync();

