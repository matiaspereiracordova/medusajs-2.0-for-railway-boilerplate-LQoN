const { JSONRPCClient } = require("json-rpc-2.0");

const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

async function fixRemainingStockSync() {
  console.log("🔧 Sincronizando stock restante de MedusaJS a Odoo...\n");

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

    // 2. Productos específicos que necesitan sincronización
    const remainingProducts = [
      { sku: "medusa-t-shirt", name: "Polera manga corta", medusaStock: 100 },
      { sku: "poleron", name: "Poleron", medusaStock: 100 }
    ];

    console.log("📦 Sincronizando productos restantes...\n");

    // 3. Obtener ubicación de stock
    const locations = await client.request("call", {
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

    const mainLocation = locations[0];
    console.log(`📍 Usando ubicación: ${mainLocation.name} (ID: ${mainLocation.id})\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const product of remainingProducts) {
      console.log(`🔧 Procesando: ${product.name} (${product.sku})`);
      console.log(`   📊 Stock en MedusaJS: ${product.medusaStock} unidades`);

      try {
        // Obtener producto de Odoo
        const odooProducts = await client.request("call", {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DATABASE,
            uid,
            ODOO_PASSWORD,
            "product.template",
            "search_read",
            [[["default_code", "=", product.sku]]],
            { fields: ["id", "name", "default_code", "qty_available", "type", "tracking"] }
          ],
        });

        if (odooProducts.length === 0) {
          console.log(`   ❌ Producto no encontrado en Odoo para SKU: ${product.sku}`);
          continue;
        }

        const odooProduct = odooProducts[0];
        console.log(`   📦 Stock actual en Odoo: ${odooProduct.qty_available} unidades`);
        console.log(`   📋 Tipo: ${odooProduct.type}, Tracking: ${odooProduct.tracking}`);

        // Intentar diferentes enfoques para establecer el stock
        let stockSet = false;

        // Enfoque 1: Crear/actualizar stock.quant
        try {
          console.log(`   🔄 Intentando crear/actualizar stock.quant...`);
          
          // Buscar stock.quant existente
          const existingQuants = await client.request("call", {
            service: "object",
            method: "execute_kw",
            args: [
              ODOO_DATABASE,
              uid,
              ODOO_PASSWORD,
              "stock.quant",
              "search_read",
              [[["product_id", "=", odooProduct.id], ["location_id", "=", mainLocation.id]]],
              { fields: ["id", "quantity"] }
            ],
          });

          if (existingQuants.length > 0) {
            // Actualizar existente
            const quant = existingQuants[0];
            await client.request("call", {
              service: "object",
              method: "execute_kw",
              args: [
                ODOO_DATABASE,
                uid,
                ODOO_PASSWORD,
                "stock.quant",
                "write",
                [[quant.id], { quantity: product.medusaStock }],
              ],
            });
            console.log(`   ✅ Stock.quant actualizado: ${quant.quantity} → ${product.medusaStock}`);
          } else {
            // Crear nuevo
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
                  product_id: odooProduct.id,
                  location_id: mainLocation.id,
                  quantity: product.medusaStock,
                }],
              ],
            });
            console.log(`   ✅ Stock.quant creado: ${product.medusaStock} unidades (ID: ${quantId})`);
          }
          
          stockSet = true;

        } catch (quantError) {
          console.log(`   ❌ Error con stock.quant: ${quantError.message}`);
          
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
                  name: `Sincronización desde MedusaJS - ${product.name}`,
                  product_id: odooProduct.id,
                  product_uom_qty: product.medusaStock,
                  product_uom: 1, // Units
                  location_id: mainLocation.id,
                  location_dest_id: mainLocation.id,
                  origin: `MedusaJS Sync - ${product.sku}`,
                  state: "done",
                  move_type: "in",
                }],
              ],
            });
            
            console.log(`   ✅ Movimiento de stock creado: ${product.medusaStock} unidades (ID: ${moveId})`);
            stockSet = true;

          } catch (moveError) {
            console.log(`   ❌ Error con movimiento de stock: ${moveError.message}`);
            
            // Enfoque 3: Actualizar directamente el producto (último recurso)
            try {
              console.log(`   🔄 Intentando actualización directa del producto...`);
              
              await client.request("call", {
                service: "object",
                method: "execute_kw",
                args: [
                  ODOO_DATABASE,
                  uid,
                  ODOO_PASSWORD,
                  "product.template",
                  "write",
                  [[odooProduct.id], { 
                    qty_available: product.medusaStock,
                    virtual_available: product.medusaStock 
                  }],
                ],
              });
              
              console.log(`   ✅ Producto actualizado directamente: ${product.medusaStock} unidades`);
              stockSet = true;

            } catch (directError) {
              console.log(`   ❌ Error con actualización directa: ${directError.message}`);
            }
          }
        }

        if (stockSet) {
          // Verificar que el stock se actualizó
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
              [[odooProduct.id]],
              { fields: ["id", "name", "qty_available", "virtual_available"] }
            ],
          });

          if (updatedProduct.length > 0) {
            const updated = updatedProduct[0];
            console.log(`   📊 Stock verificado: ${updated.qty_available} unidades (Virtual: ${updated.virtual_available})`);
            
            if (updated.qty_available > 0) {
              successCount++;
              console.log(`   ✅ ${product.name} sincronizado exitosamente`);
            } else {
              console.log(`   ⚠️ ${product.name} aún muestra 0 stock (puede ser un problema de tipo de producto)`);
            }
          }
        } else {
          errorCount++;
          console.log(`   ❌ No se pudo establecer stock para ${product.name}`);
        }

      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error procesando ${product.name}: ${error.message}`);
      }

      console.log("");
    }

    // 4. Resumen final
    console.log("📊 RESUMEN FINAL:");
    console.log("=" .repeat(60));
    console.log(`✅ Productos procesados exitosamente: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);

    if (successCount === remainingProducts.length) {
      console.log("\n🎉 ¡Todos los productos restantes sincronizados!");
      console.log("💡 El stock en Odoo ahora refleja exactamente el stock de MedusaJS");
    } else {
      console.log("\n⚠️ Algunos productos aún necesitan configuración manual");
      console.log("💡 Los productos de tipo 'consu' pueden requerir configuración especial en Odoo");
    }

    // 5. Verificación final
    console.log("\n🔍 VERIFICACIÓN FINAL DEL STOCK:");
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

  } catch (error) {
    console.error("❌ Error general:", error);
  }
}

fixRemainingStockSync();
