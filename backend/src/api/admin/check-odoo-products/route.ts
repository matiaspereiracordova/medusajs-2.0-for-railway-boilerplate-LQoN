import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { odooClient } from "../../../services/odoo-client";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🔍 Verificando productos en Odoo...");
    
    // Obtener todos los productos de Odoo
    const allProducts = await odooClient.searchRead(
      "product.template",
      [], // Sin filtros para obtener todos
      ["id", "name", "list_price", "default_code", "x_medusa_id", "active"],
      100 // Límite de 100 productos
    );

    console.log(`📊 Total de productos en Odoo: ${allProducts.length}`);

    // Separar productos sincronizados vs productos de demostración
    const syncedProducts = allProducts.filter(product => product.x_medusa_id);
    const demoProducts = allProducts.filter(product => !product.x_medusa_id);

    console.log(`✅ Productos sincronizados desde MedusaJS: ${syncedProducts.length}`);
    console.log(`🎭 Productos de demostración: ${demoProducts.length}`);

    // Mostrar detalles de productos sincronizados
    console.log("\n📋 Productos sincronizados desde MedusaJS:");
    syncedProducts.forEach(product => {
      console.log(`  - ${product.name} (ID: ${product.id}, Medusa ID: ${product.x_medusa_id}, Precio: $${product.list_price})`);
    });

    // Mostrar algunos productos de demostración
    console.log("\n🎭 Primeros productos de demostración:");
    demoProducts.slice(0, 5).forEach(product => {
      console.log(`  - ${product.name} (ID: ${product.id}, Precio: $${product.list_price})`);
    });

    res.status(200).json({
      success: true,
      message: "Análisis de productos completado",
      data: {
        total_products: allProducts.length,
        synced_products: syncedProducts.length,
        demo_products: demoProducts.length,
        synced_products_list: syncedProducts.map(p => ({
          id: p.id,
          name: p.name,
          medusa_id: p.x_medusa_id,
          price: p.list_price,
          default_code: p.default_code
        })),
        demo_products_sample: demoProducts.slice(0, 5).map(p => ({
          id: p.id,
          name: p.name,
          price: p.list_price,
          default_code: p.default_code
        }))
      }
    });
  } catch (error: any) {
    console.error("❌ Error verificando productos de Odoo:", error);
    res.status(500).json({
      success: false,
      message: "Error verificando productos de Odoo",
      error: error.message || error
    });
  }
}
