const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function fixRemainingProductsStock() {
  console.log("🔧 Estableciendo stock para productos restantes...\n");

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
    // 1. Autenticar con Odoo
    const uid = await client.request("call", {
      service: "common",
      method: "authenticate",
      args: [ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD, {}],
    });
    console.log(`✅ Autenticado con Odoo (UID: ${uid})\n`);

    // 2. Obtener productos específicos sin stock
    const remainingProducts = ["medusa-t-shirt", "poleron"];
    
    console.log("📦 Obteniendo productos restantes sin stock...");
    
    const products = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["active", "=", true], ["default_code", "in", remainingProducts]]],
        { 
          fields: ["id", "name", "default_code", "qty_available", "type", "tracking"]
        }
      ],
    });

    console.log(`✅ Encontrados ${products.length} productos restantes\n`);

    if (products.length === 0) {
      console.log("🎉 Todos los productos ya tienen stock!");
      return;
    }

    // 3. Obtener ubicación de stock principal
    const mainLocation = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "stock.location",
        "search_read",
        [[["usage", "=", "internal"]]],
        { fields: ["id", "name"], limit: 1 }
      ],
    });

    if (mainLocation.length === 0) {
      console.log("❌ No se encontraron ubicaciones de stock internas");
      return;
    }

    const location = mainLocation[0];
    console.log(`📍 Usando ubicación: ${location.name} (ID: ${location.id})\n`);

    // 4. Intentar diferentes enfoques para establecer stock
    for (const product of products) {
      console.log(`🔧 Procesando: ${product.name} (${product.default_code})`);
      console.log(`   * Tipo: ${product.type}`);
      console.log(`   * Tracking: ${product.tracking}`);
      console.log(`   * Stock actual: ${product.qty_available}`);
      
      let success = false;

      // Enfoque 1: Crear stock.quant directamente
      try {
        console.log(`   🔄 Intentando crear stock.quant directamente...`);
        
        const quantId = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "stock.quant",
            "create",
            [{
              product_id: product.id,
              location_id: location.id,
              quantity: 100,
            }],
          ],
        });
        
        console.log(`   ✅ Stock.quant creado exitosamente (ID: ${quantId})`);
        success = true;
        
      } catch (error1) {
        console.log(`   ❌ Error creando stock.quant: ${error1.message}`);
        
        // Enfoque 2: Crear movimiento de stock
        try {
          console.log(`   🔄 Intentando crear movimiento de stock...`);
          
          const moveId = await client.request("call", {
            service: "object",
            method: "execute_kw",
            args: [
              ODOO_DATABASE,
              uid,
              ODOO_PASSWORD,
              "stock.move",
              "create",
              [{
                name: `Stock inicial - ${product.name}`,
                product_id: product.id,
                product_uom_qty: 100,
                product_uom: 1, // Units
                location_id: location.id,
                location_dest_id: location.id,
                origin: "Stock inicial automático",
                state: "done",
                move_type: "in",
              }],
            ],
          });
          
          console.log(`   ✅ Movimiento de stock creado (ID: ${moveId})`);
          success = true;
          
        } catch (error2) {
          console.log(`   ❌ Error creando movimiento: ${error2.message}`);
          
          // Enfoque 3: Actualizar directamente el campo qty_available
          try {
            console.log(`   🔄 Intentando actualizar qty_available directamente...`);
            
            await client.request("call", {
              service: "object",
              method: "execute_kw",
              args: [
                ODOO_DATABASE,
                uid,
                ODOO_PASSWORD,
                "product.template",
                "write",
                [[product.id], { qty_available: 100 }],
              ],
            });
            
            console.log(`   ✅ qty_available actualizado directamente`);
            success = true;
            
          } catch (error3) {
            console.log(`   ❌ Error actualizando qty_available: ${error3.message}`);
          }
        }
      }

      // Verificar resultado
      if (success) {
        console.log(`   🔍 Verificando stock actualizado...`);
        
        const updatedProduct = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.template",
            "read",
            [[product.id]],
            { fields: ["id", "name", "qty_available", "virtual_available"] }
          ],
        });

        if (updatedProduct.length > 0) {
          const updated = updatedProduct[0];
          console.log(`   📊 Stock actualizado: ${updated.qty_available} unidades (Virtual: ${updated.virtual_available})`);
        }
      }
      
      console.log("");
    }

    // 5. Verificación final
    console.log("🔍 VERIFICACIÓN FINAL:");
    console.log("=" .repeat(60));
    
    const finalProducts = await client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DATABASE,
        uid,
        ODOO_PASSWORD,
        "product.template",
        "search_read",
        [[["active", "=", true]]],
        { 
          fields: ["id", "name", "default_code", "qty_available"]
        }
      ],
    });

    let totalStock = 0;
    let productsWithStock = 0;

    finalProducts.forEach(product => {
      if (product.qty_available > 0) {
        productsWithStock++;
      }
      totalStock += product.qty_available || 0;
      console.log(`📦 ${product.name}: ${product.qty_available || 0} unidades`);
    });

    console.log(`\n📈 Estadísticas finales:`);
    console.log(`   * Productos con stock: ${productsWithStock}/${finalProducts.length}`);
    console.log(`   * Stock total: ${totalStock} unidades`);

    if (productsWithStock === finalProducts.length) {
      console.log(`\n🎉 ¡SISTEMA COMPLETAMENTE CONFIGURADO!`);
      console.log(`💡 Todos los productos tienen stock inicial establecido.`);
      console.log(`🔄 La sincronización bidireccional está lista para funcionar.`);
      console.log(`\n📋 Para probar la sincronización:`);
      console.log(`   1. Hacer una orden en MedusaJS`);
      console.log(`   2. Verificar que se actualice el stock en Odoo`);
      console.log(`   3. Modificar stock en Odoo y esperar 15 minutos`);
      console.log(`   4. Verificar que se actualice en MedusaJS`);
    } else {
      console.log(`\n⚠️ Algunos productos aún necesitan configuración manual.`);
      console.log(`💡 Puedes establecer el stock manualmente en Odoo:`);
      console.log(`   Operaciones → Inventario → Ajustes de inventario`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

fixRemainingProductsStock();
