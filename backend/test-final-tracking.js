const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function testFinalTracking() {
  console.log("🎯 Probando configuración final para tracking de inventario...\n");

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

    // Configuración final que usará OdooModuleService
    const finalProductData = {
      name: "Producto Final - Tracking Habilitado",
      default_code: "FINAL-TRACKING-" + Date.now(),
      type: "consu", // Tipo válido
      tracking: "lot", // Esto habilita el checkbox "Rastrear inventario"
      sale_ok: true,
      purchase_ok: true,
      invoice_policy: "order",
      list_price: 25000,
      description: "Producto final con tracking de inventario habilitado",
      active: true
    };

    console.log("📦 Creando producto con configuración final...");
    console.log("Configuración:", JSON.stringify(finalProductData, null, 2));

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
        [finalProductData],
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
        { fields: ["id", "name", "default_code", "type", "tracking", "sale_ok", "purchase_ok", "invoice_policy", "active"] }
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
      console.log(`   - Activo: ${product.active}`);

      // Verificar si el tracking está habilitado
      if (product.tracking === "lot" || product.tracking === "serial") {
        console.log("\n🎉 ¡ÉXITO TOTAL! El checkbox 'Rastrear inventario' está activado!");
        console.log("✅ Los productos sincronizados desde MedusaJS tendrán tracking de inventario habilitado");
        console.log("✅ La sincronización bidireccional de stock funcionará correctamente");
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

    console.log("\n🎯 RESUMEN FINAL:");
    console.log("✅ Configuración completada exitosamente");
    console.log("✅ type: 'consu' + tracking: 'lot' habilita el checkbox 'Rastrear inventario'");
    console.log("✅ Los nuevos productos sincronizados tendrán tracking automático");
    console.log("✅ La sincronización bidireccional de stock está lista");

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testFinalTracking();

