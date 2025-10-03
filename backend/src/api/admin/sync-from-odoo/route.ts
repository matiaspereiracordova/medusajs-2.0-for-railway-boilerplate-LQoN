import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { odooClient } from "../../../services/odoo-client";
import { IProductModuleService, IPricingModuleService, IRegionModuleService } from "@medusajs/framework/types";
import { ModuleRegistrationName } from "@medusajs/framework/utils";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🔄 Iniciando sincronización desde Odoo hacia MedusaJS...");
    
    const { product_ids, limit = 10, offset = 0, include_demo = false } = req.body;
    
    // Obtener productos de Odoo
    let domain: any[] = [];
    
    if (product_ids && product_ids.length > 0) {
      // Sincronizar productos específicos
      domain = [["id", "in", product_ids]];
    } else if (!include_demo) {
      // Solo productos que NO tienen x_medusa_id (productos de demostración)
      domain = [["x_medusa_id", "=", false]];
    } else {
      // Todos los productos
      domain = [];
    }

    console.log(`🔍 Buscando productos en Odoo con dominio:`, domain);
    
    const odooProducts = await odooClient.searchRead(
      "product.template",
      domain,
      ["id", "name", "list_price", "default_code", "description", "x_medusa_id", "active", "image_1920"],
      limit
    );

    console.log(`📦 Productos encontrados en Odoo: ${odooProducts.length}`);

    if (odooProducts.length === 0) {
      res.status(200).json({
        success: true,
        message: "No hay productos para sincronizar",
        data: {
          synced_products: 0,
          created_products: 0,
          updated_products: 0,
          errors: []
        }
      });
      return;
    }

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

    // Obtener región por defecto (CLP)
    const regions = await regionModuleService.listRegions({
      currency_code: "clp"
    });
    const chileRegion = regions?.[0];

    if (!chileRegion) {
      res.status(400).json({
        success: false,
        message: "No se encontró región con moneda CLP"
      });
      return;
    }

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Procesar cada producto de Odoo
    for (const odooProduct of odooProducts) {
      try {
        console.log(`📤 Procesando: ${odooProduct.name}`);
        
        // Buscar si ya existe en MedusaJS
        let existingProduct = null;
        if (odooProduct.x_medusa_id) {
          try {
            existingProduct = await productModuleService.retrieveProduct(odooProduct.x_medusa_id);
          } catch (error) {
            // Producto no existe, continuar con creación
          }
        }

        // Preparar datos del producto para MedusaJS
        const productData = {
          title: odooProduct.name,
          handle: odooProduct.default_code || `odoo_${odooProduct.id}`,
          description: odooProduct.description || "",
          status: odooProduct.active ? "published" : "draft",
          // Campo personalizado para almacenar ID de Odoo
          metadata: {
            odoo_id: odooProduct.id,
            synced_from_odoo: true
          }
        };

        // Preparar datos de la variante
        const variantData = {
          title: odooProduct.name,
          sku: odooProduct.default_code || `odoo_${odooProduct.id}`,
          prices: [{
            currency_code: "clp",
            amount: Math.round((odooProduct.list_price || 0) * 100) // Convertir a centavos
          }]
        };

        if (existingProduct) {
          // Actualizar producto existente
          console.log(`🔄 Actualizando producto existente: ${productData.title}`);
          await productModuleService.updateProducts([{
            id: existingProduct.id,
            ...productData
          }]);
          updatedCount++;
        } else {
          // Crear nuevo producto
          console.log(`➕ Creando nuevo producto: ${productData.title}`);
          const newProduct = await productModuleService.createProducts([{
            ...productData,
            variants: [variantData]
          }]);

          // Actualizar Odoo con el ID de MedusaJS
          if (newProduct && newProduct.length > 0) {
            await odooClient.create("product.template", {
              id: odooProduct.id,
              x_medusa_id: newProduct[0].id
            });
          }
          createdCount++;
        }

        console.log(`✅ Producto procesado: ${productData.title}`);
        
      } catch (error: any) {
        errorCount++;
        const errorMsg = `Error procesando producto ${odooProduct.name}: ${error.message || error}`;
        console.error(`❌ ${errorMsg}`);
        errors.push({
          product: odooProduct.name,
          odoo_id: odooProduct.id,
          error: error.message || error
        });
      }
    }

    console.log(`📊 Resumen de sincronización desde Odoo:`);
    console.log(`   ✅ Productos creados: ${createdCount}`);
    console.log(`   🔄 Productos actualizados: ${updatedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);

    res.status(200).json({
      success: true,
      message: "Sincronización desde Odoo completada",
      data: {
        synced_products: createdCount + updatedCount,
        created_products: createdCount,
        updated_products: updatedCount,
        error_count: errorCount,
        errors: errors
      }
    });

  } catch (error: any) {
    console.error("❌ Error en sincronización desde Odoo:", error);
    res.status(500).json({
      success: false,
      message: "Error en sincronización desde Odoo",
      error: error.message || error
    });
  }
}
