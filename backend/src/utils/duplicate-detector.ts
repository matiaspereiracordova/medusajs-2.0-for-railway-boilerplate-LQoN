import { odooClient } from "../services/odoo-client";

export interface OdooProduct {
  id: number;
  name: string;
  list_price: number;
  default_code?: string;
  x_medusa_id?: string;
  active: boolean;
  write_date: string;
}

export interface DuplicateGroup {
  key: string;
  products: OdooProduct[];
  keepProduct: OdooProduct;
  productsToDelete: OdooProduct[];
}

/**
 * Detecta productos duplicados en Odoo basándose en x_medusa_id y nombre
 */
export async function detectOdooDuplicates(): Promise<{
  duplicatesByMedusaId: Map<string, OdooProduct[]>;
  duplicatesByName: Map<string, OdooProduct[]>;
  duplicateGroups: DuplicateGroup[];
}> {
  console.log("🔍 Detectando duplicados en Odoo...");

  // Obtener todos los productos de Odoo
  const allProducts = await odooClient.searchRead(
    "product.template",
    [["type", "=", "product"]],
    ["id", "name", "list_price", "default_code", "x_medusa_id", "active", "write_date"]
  );

  console.log(`📦 Total de productos en Odoo: ${allProducts.length}`);

  // Agrupar por x_medusa_id
  const duplicatesByMedusaId = new Map<string, OdooProduct[]>();
  for (const product of allProducts) {
    if (product.x_medusa_id) {
      if (!duplicatesByMedusaId.has(product.x_medusa_id)) {
        duplicatesByMedusaId.set(product.x_medusa_id, []);
      }
      duplicatesByMedusaId.get(product.x_medusa_id)!.push(product);
    }
  }

  // Agrupar por nombre
  const duplicatesByName = new Map<string, OdooProduct[]>();
  for (const product of allProducts) {
    const normalizedName = product.name.toLowerCase().trim();
    if (!duplicatesByName.has(normalizedName)) {
      duplicatesByName.set(normalizedName, []);
    }
    duplicatesByName.get(normalizedName)!.push(product);
  }

  // Crear grupos de duplicados para procesamiento
  const duplicateGroups: DuplicateGroup[] = [];

  // Procesar duplicados por x_medusa_id
  for (const [medusaId, products] of duplicatesByMedusaId.entries()) {
    if (products.length > 1) {
      const sortedProducts = products.sort((a, b) => {
        // Priorizar: activo > inactivo, precio mayor > precio menor, más reciente
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        if (a.list_price > b.list_price) return -1;
        if (a.list_price < b.list_price) return 1;
        return new Date(b.write_date).getTime() - new Date(a.write_date).getTime();
      });

      duplicateGroups.push({
        key: `x_medusa_id: ${medusaId}`,
        products,
        keepProduct: sortedProducts[0],
        productsToDelete: sortedProducts.slice(1)
      });
    }
  }

  // Procesar duplicados por nombre (solo casos mixtos)
  for (const [name, products] of duplicatesByName.entries()) {
    if (products.length > 1) {
      const productsWithoutMedusaId = products.filter(p => !p.x_medusa_id);
      const productsWithMedusaId = products.filter(p => p.x_medusa_id);
      
      // Caso mixto: algunos tienen x_medusa_id y otros no
      if (productsWithoutMedusaId.length > 0 && productsWithMedusaId.length > 0) {
        // Buscar el producto original de Odoo (sin x_medusa_id, con precio > 0)
        const originalProduct = productsWithoutMedusaId.find(p => p.list_price > 0);
        const syncProducts = productsWithMedusaId.filter(p => p.list_price === 0);
        
        if (originalProduct && syncProducts.length > 0) {
          duplicateGroups.push({
            key: `name: ${name} (mixto - eliminar sync con precio 0)`,
            products: [originalProduct, ...syncProducts],
            keepProduct: originalProduct,
            productsToDelete: syncProducts
          });
        }
      }
    }
  }

  console.log(`🔍 Grupos de duplicados encontrados: ${duplicateGroups.length}`);

  return {
    duplicatesByMedusaId,
    duplicatesByName,
    duplicateGroups
  };
}

/**
 * Verifica si un producto ya existe en Odoo antes de crearlo
 */
export async function checkProductExists(
  name: string, 
  medusaId?: string
): Promise<{ exists: boolean; existingProduct?: OdooProduct; isDuplicate?: boolean }> {
  try {
    // Buscar por x_medusa_id si existe
    if (medusaId) {
      const productsByMedusaId = await odooClient.searchRead(
        "product.template",
        [["x_medusa_id", "=", medusaId]],
        ["id", "name", "list_price", "default_code", "x_medusa_id", "active", "write_date"]
      );
      
      if (productsByMedusaId.length > 0) {
        return { exists: true, existingProduct: productsByMedusaId[0] };
      }
    }

    // Buscar por nombre exacto
    const productsByName = await odooClient.searchRead(
      "product.template",
      [["name", "=", name]],
      ["id", "name", "list_price", "default_code", "x_medusa_id", "active", "write_date"]
    );

    if (productsByName.length > 0) {
      // Verificar si es un duplicado problemático
      const hasMedusaId = productsByName.some(p => p.x_medusa_id);
      const hasNoMedusaId = productsByName.some(p => !p.x_medusa_id);
      const hasDifferentPrices = productsByName.some(p => p.list_price !== productsByName[0].list_price);
      
      const isDuplicate = hasMedusaId && hasNoMedusaId && hasDifferentPrices;
      
      return { 
        exists: true, 
        existingProduct: productsByName[0], 
        isDuplicate 
      };
    }

    return { exists: false };
  } catch (error) {
    console.error("❌ Error verificando existencia de producto:", error);
    return { exists: false };
  }
}

/**
 * Actualiza un producto existente en lugar de crear uno nuevo
 */
export async function updateExistingProduct(
  productId: number, 
  updateData: any
): Promise<boolean> {
  try {
    await odooClient.update("product.template", productId, updateData);
    console.log(`✅ Producto actualizado exitosamente (ID: ${productId})`);
    return true;
  } catch (error) {
    console.error(`❌ Error actualizando producto ${productId}:`, error);
    return false;
  }
}
