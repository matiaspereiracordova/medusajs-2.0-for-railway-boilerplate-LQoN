const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function configureStock() {
  console.log("🔧 Configurando productos para gestión de stock en Odoo...\n");

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

    // 1. Verificar si el módulo de inventario está instalado
    console.log("📦 Verificando módulos de inventario...");
    const modules = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "ir.module.module",
        "search_read",
        [[["name", "in", ["stock", "inventory"]]]],
        { fields: ["name", "state"] }
      ],
    });

    console.log("Módulos encontrados:");
    modules.forEach(m => {
      console.log(`  - ${m.name}: ${m.state}`);
    });

    // 2. Obtener productos que necesitan configuración
    console.log("\n📦 Obteniendo productos tipo 'consu'...");
    const products = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["type", "=", "consu"]]],
        { fields: ["id", "name", "default_code", "tracking", "sale_ok", "purchase_ok"] }
      ],
    });

    console.log(`✅ Encontrados ${products.length} productos tipo 'consu'\n`);

    // 3. Intentar configurar cada producto para gestión de stock
    console.log("🔧 Configurando productos para gestión de stock...\n");
    let updatedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        console.log(`  Configurando: ${product.name} (ID: ${product.id})`);
        
        // Intentar diferentes configuraciones
        const updateData = {
          // Configurar para que sea rastreable
          tracking: "none", // Sin rastreo de lotes
          sale_ok: true,    // Se puede vender
          purchase_ok: true // Se puede comprar
        };

        await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.template",
            "write",
            [[product.id], updateData]
          ],
        });

        console.log(`    ✅ Configurado: ${product.name}`);
        updatedCount++;
      } catch (error) {
        console.error(`    ❌ Error configurando ${product.name}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Productos configurados: ${updatedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);

    // 4. Verificar si ahora aparecen en el stock
    console.log("\n🔍 Verificando si los productos ahora tienen stock...");
    
    // Buscar productos con stock > 0
    const stockProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.product",
        "search_read",
        [[["qty_available", ">", 0]]],
        { fields: ["id", "name", "default_code", "qty_available", "virtual_available"] }
      ],
    });

    if (stockProducts.length > 0) {
      console.log(`✅ Productos con stock > 0: ${stockProducts.length}`);
      stockProducts.forEach(p => {
        console.log(`  - ${p.name}: ${p.qty_available} unidades`);
      });
    } else {
      console.log("ℹ️ No hay productos con stock > 0");
      console.log("\n💡 Próximo paso: Establecer stock inicial para los productos");
      console.log("   Esto se puede hacer desde la interfaz de Odoo:");
      console.log("   1. Ve a Inventario > Operaciones > Ajustes de Inventario");
      console.log("   2. Crea un nuevo ajuste");
      console.log("   3. Añade los productos con cantidades iniciales");
      console.log("   4. Confirma el ajuste");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

configureStock();

