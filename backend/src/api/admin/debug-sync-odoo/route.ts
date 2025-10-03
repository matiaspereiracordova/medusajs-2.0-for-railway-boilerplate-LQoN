import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { odooClient } from "../../../services/odoo-client";
import { IProductModuleService, IPricingModuleService, IRegionModuleService } from "@medusajs/framework/types";
import { ModuleRegistrationName } from "@medusajs/framework/utils";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🔍 Debug: Iniciando análisis detallado de sincronización...");
    
    // Obtener un producto de demostración específico
    const demoProducts = await odooClient.searchRead(
      "product.template",
      [["x_medusa_id", "=", false]], // Solo productos sin x_medusa_id
      ["id", "name", "list_price", "default_code", "description", "x_medusa_id", "active", "image_1920"],
      1 // Solo 1 producto para debug
    );

    if (demoProducts.length === 0) {
      res.status(200).json({
        success: false,
        message: "No hay productos de demostración para debuggear"
      });
      return;
    }

    const testProduct = demoProducts[0];
    console.log("🎯 Producto de prueba:", testProduct);

    // Resolver servicios de MedusaJS
    const productModuleService: IProductModuleService = req.scope.resolve(
      ModuleRegistrationName.PRODUCT
    );
    const pricingModuleService: IPricingModuleService = req.scope.resolve(
      ModuleRegistrationName.PRICING
    );
    const regionModuleService: IRegionModuleService = req.scope.resolve(
      ModuleRegistrationName.REGION
    );

    // Obtener región por defecto
    const regions = await regionModuleService.listRegions({
      currency_code: "clp"
    });
    const chileRegion = regions?.[0];

    const debugInfo = {
      odooProduct: testProduct,
      medusaRegion: chileRegion ? {
        id: chileRegion.id,
        name: chileRegion.name,
        currency_code: chileRegion.currency_code
      } : null,
      errors: []
    };

    // Probar creación de producto paso a paso
    try {
      console.log("🔍 Paso 1: Preparando datos del producto...");
      
      const productData = {
        title: testProduct.name,
        handle: testProduct.default_code || `odoo_${testProduct.id}`,
        description: testProduct.description || "",
        status: testProduct.active ? "published" as const : "draft" as const,
        metadata: {
          odoo_id: testProduct.id,
          synced_from_odoo: true
        }
      };

      console.log("📋 Datos del producto preparados:", productData);

      console.log("🔍 Paso 2: Verificando si el producto ya existe...");
      
      // Buscar si ya existe
      let existingProduct = null;
      if (testProduct.x_medusa_id) {
        try {
          existingProduct = await productModuleService.retrieveProduct(testProduct.x_medusa_id);
          console.log("✅ Producto existente encontrado:", existingProduct.id);
        } catch (error) {
          console.log("ℹ️ Producto no existe, continuando con creación");
        }
      }

      if (existingProduct) {
        debugInfo.errors.push("Producto ya existe en MedusaJS");
      } else {
        console.log("🔍 Paso 3: Intentando crear producto...");
        
        // Preparar datos de la variante
        const variantData = {
          title: testProduct.name,
          sku: testProduct.default_code || `odoo_${testProduct.id}`,
          prices: [{
            currency_code: "clp",
            amount: Math.round((testProduct.list_price || 0) * 100)
          }]
        };

        console.log("📋 Datos de variante:", variantData);

        // Intentar crear producto
        const newProduct = await productModuleService.createProducts({
          ...productData,
          variants: [variantData]
        });

        console.log("✅ Producto creado exitosamente:", newProduct);
        debugInfo.errors.push("✅ Producto creado exitosamente");
        
        // Intentar actualizar Odoo
        try {
          await odooClient.create("product.template", {
            id: testProduct.id,
            x_medusa_id: newProduct.id
          });
          console.log("✅ Odoo actualizado con ID de MedusaJS");
          debugInfo.errors.push("✅ Odoo actualizado con ID de MedusaJS");
        } catch (error: any) {
          console.error("❌ Error actualizando Odoo:", error);
          debugInfo.errors.push(`❌ Error actualizando Odoo: ${error.message}`);
        }
      }

    } catch (error: any) {
      console.error("❌ Error en creación de producto:", error);
      debugInfo.errors.push(`❌ Error en creación: ${error.message}`);
    }

    res.status(200).json({
      success: true,
      message: "Debug completado",
      data: debugInfo
    });

  } catch (error: any) {
    console.error("❌ Error en debug:", error);
    res.status(500).json({
      success: false,
      message: "Error en debug",
      error: error.message || error
    });
  }
}
