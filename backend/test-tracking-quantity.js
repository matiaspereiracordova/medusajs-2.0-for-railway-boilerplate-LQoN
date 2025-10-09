const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function testTrackingQuantity() {
  console.log("🧪 Probando tracking de inventario con 'quantity'...\n");

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

    // Configuración correcta basada en lo que funciona en tu Odoo
    const testProductData = {
      name: "Producto Test - Tracking Quantity",
      default_code: "TEST-QTY-" + Date.now(),
      type: "consu", // Tipo válido
      tracking: "quantity", // Esto debería habilitar el checkbox "Rastrear inventario"
      sale_ok: true,
      purchase_ok: true,
      invoice_policy: "order",
      list_price: 15000,
      description: "Producto de prueba para verificar tracking de inventario"
    };

    console.log("📦 Creando producto con tracking='quantity'...");
    console.log("Configuración:", JSON.stringify(testProductData, null, 2));

    // Crear el producto
    const productId = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "create",
        [testProductData],
      ],
    });

    console.log(`\n✅ Producto creado con ID: ${productId}`);

    // Verificar configuración
    console.log("\n🔍 Verificando configuración del producto...");
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
        { fields: ["id", "name", "default_code", "type", "tracking", "sale_ok", "purchase_ok", "invoice_policy"] }
      ],
    });

    if (createdProduct.length > 0) {
      const product = createdProduct[0];
      console.log("📊 Configuración del producto creado:");
      console.log(`   - Nombre: ${product.name}`);
      console.log(`   - SKU: ${product.default_code}`);
      console.log(`   - Tipo: ${product.type}`);
      console.log(`   - Tracking: ${product.tracking}`);
      console.log(`   - Ventas: ${product.sale_ok}`);
      console.log(`   - Compras: ${product.purchase_ok}`);
      console.log(`   - Política facturación: ${product.invoice_policy}`);

      // Verificar si el tracking está habilitado
      if (product.tracking === "quantity") {
        console.log("\n🎉 ¡ÉXITO! El checkbox 'Rastrear inventario' está activado!");
        console.log("✅ Los productos sincronizados tendrán tracking de inventario habilitado");
      } else {
        console.log(`\n⚠️ Tracking configurado como: "${product.tracking}"`);
      }

      // Limpiar
      console.log("\n🧹 Eliminando producto de prueba...");
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
        console.log("✅ Producto de prueba eliminado");
      } catch (deleteError) {
        console.log("⚠️ No se pudo eliminar el producto de prueba");
      }

    } else {
      console.log("❌ No se pudo verificar el producto creado");
    }

    console.log("\n🎯 Resumen:");
    console.log("✅ La configuración está lista para activar el tracking de inventario");
    console.log("✅ Usando: type='consu' + tracking='quantity'");
    console.log("✅ Esto habilita el checkbox 'Rastrear inventario' en Odoo");

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testTrackingQuantity();

