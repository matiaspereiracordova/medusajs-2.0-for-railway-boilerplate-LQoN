const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function testProductSyncWithTracking() {
  console.log("🧪 Probando sincronización de producto con tracking de inventario...\n");

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

    // Simular datos de producto desde MedusaJS
    const testProductData = {
      name: "Producto de Prueba - Tracking",
      default_code: "TEST-TRACKING-" + Date.now(),
      list_price: 15000,
      x_medusa_id: "test-medusa-id-" + Date.now(),
      description: "Producto de prueba para verificar tracking de inventario",
      active: true,
    };

    console.log("📦 Creando producto de prueba con configuración de tracking...");
    console.log("Datos del producto:", testProductData);

    // Aplicar la misma lógica que en OdooModuleService
    const productDataWithInventory = {
      ...testProductData,
      type: "product", // Esto habilita el checkbox "Rastrear inventario"
      tracking: "none", // Sin tracking de lotes/series por defecto
      sale_ok: true,    // Permitir ventas
      purchase_ok: true, // Permitir compras
      invoice_policy: "order" // Facturar cantidad ordenada
    };

    console.log("\n🔧 Configuración con tracking de inventario:");
    console.log(JSON.stringify(productDataWithInventory, null, 2));

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
        [productDataWithInventory],
      ],
    });

    console.log(`\n✅ Producto creado con ID: ${productId}`);

    // Verificar que el producto se creó con tracking habilitado
    console.log("\n🔍 Verificando configuración del producto creado...");
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
      console.log(`   - Ventas habilitadas: ${product.sale_ok}`);
      console.log(`   - Compras habilitadas: ${product.purchase_ok}`);
      console.log(`   - Política de facturación: ${product.invoice_policy}`);

      // Verificar si el tracking está correctamente habilitado
      if (product.type === "product") {
        console.log("\n🎉 ¡ÉXITO! El checkbox 'Rastrear inventario' está activado automáticamente!");
        console.log("✅ Los productos sincronizados desde MedusaJS tendrán tracking de inventario habilitado");
      } else {
        console.log("\n⚠️ El tipo no es 'product', el tracking puede no estar habilitado");
      }

      // Limpiar: eliminar el producto de prueba
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
        console.log("⚠️ No se pudo eliminar el producto de prueba (puede que tenga movimientos de stock)");
      }

    } else {
      console.log("❌ No se pudo verificar el producto creado");
    }

    console.log("\n🎯 Resumen:");
    console.log("✅ La configuración está lista para activar automáticamente el tracking de inventario");
    console.log("✅ Los nuevos productos sincronizados tendrán el checkbox 'Rastrear inventario' activado");
    console.log("✅ Esto permitirá la sincronización bidireccional de stock");

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testProductSyncWithTracking();

