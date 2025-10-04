import { JSONRPCClient } from "json-rpc-2.0";

// Configuración de Odoo desde variables de entorno
const ODOO_URL = process.env.ODOO_URL || "https://odoo-production-340c.up.railway.app";
const ODOO_DATABASE = process.env.ODOO_DATABASE || "railway";
const ODOO_USERNAME = process.env.ODOO_USERNAME || "admin";
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || "admin";

interface OdooProduct {
  id: number;
  name: string;
  default_code?: string;
  x_medusa_id?: string;
  list_price: number;
  active: boolean;
  create_date: string;
  write_date: string;
}

class SimpleOdooClient {
  private client: JSONRPCClient;
  private url: string;
  private db: string;
  private username: string;
  private password: string;
  private uid: number | null = null;

  constructor() {
    this.url = ODOO_URL;
    this.db = ODOO_DATABASE;
    this.username = ODOO_USERNAME;
    this.password = ODOO_PASSWORD;

    this.client = new JSONRPCClient(async (jsonRPCRequest) => {
      const response = await fetch(`${this.url}/jsonrpc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonRPCRequest),
      });

      if (response.status === 200) {
        const jsonRPCResponse = await response.json();
        return this.client.receive(jsonRPCResponse);
      } else {
        throw new Error(`Odoo API error: ${response.status}`);
      }
    });
  }

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;

    try {
      console.log(`🔐 Intentando autenticar en Odoo: ${this.url}/jsonrpc`);
      console.log(`📊 Base de datos: ${this.db}, Usuario: ${this.username}`);
      
      const result = await this.client.request("call", {
        service: "common",
        method: "authenticate",
        args: [this.db, this.username, this.password, {}],
      });

      if (typeof result !== 'number' || result === 0) {
        throw new Error("Autenticación fallida: credenciales inválidas o usuario no autorizado");
      }

      this.uid = result as number;
      console.log("✅ Autenticado en Odoo con UID:", this.uid);
      return this.uid;
    } catch (error: any) {
      console.error("❌ Error de autenticación en Odoo:", error);
      throw new Error(`Error de autenticación: ${error.message || 'Credenciales inválidas'}`);
    }
  }

  async searchRead(
    model: string,
    domain: any[] = [],
    fields: string[] = [],
    limit: number = 10
  ): Promise<any[]> {
    await this.authenticate();

    return await this.client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        this.db,
        this.uid,
        this.password,
        model,
        "search_read",
        [domain],
        { fields, limit },
      ],
    }) as any[];
  }

  async updateProduct(productId: number, productData: any): Promise<boolean> {
    await this.authenticate();

    try {
      console.log(`📤 Actualizando producto en Odoo (ID: ${productId}):`, productData);
      
      const result = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.db,
          this.uid,
          this.password,
          "product.template",
          "write",
          [[productId], productData],
        ],
      });

      console.log(`✅ Producto actualizado exitosamente`);
      return result as boolean;
    } catch (error: any) {
      console.error(`❌ Error actualizando producto en Odoo:`, error);
      throw new Error(`Error actualizando producto: ${error.message || error}`);
    }
  }
}

async function cleanupOdooDuplicatesSimple() {
  console.log("🧹 Iniciando limpieza de productos duplicados en Odoo (modo simple)...");

  const odooClient = new SimpleOdooClient();

  try {
    // Autenticar con Odoo
    await odooClient.authenticate();
    console.log("✅ Autenticado en Odoo");

    // Obtener todos los productos de Odoo
    console.log("📦 Obteniendo todos los productos de Odoo...");
    const allProducts = await odooClient.searchRead(
      "product.template",
      [], // Sin filtros para obtener todos los productos
      [
        "id",
        "name", 
        "default_code",
        "x_medusa_id",
        "list_price",
        "active",
        "create_date",
        "write_date"
      ],
      10000 // Límite alto para obtener todos los productos
    ) as OdooProduct[];

    console.log(`📦 Total de productos encontrados en Odoo: ${allProducts.length}`);

    if (allProducts.length === 0) {
      console.log("✅ No hay productos en Odoo para procesar");
      return;
    }

    // Agrupar productos por diferentes criterios
    const duplicatesByMedusaId = new Map<string, OdooProduct[]>();
    const duplicatesByName = new Map<string, OdooProduct[]>();
    
    allProducts.forEach(product => {
      // Agrupar por x_medusa_id (productos sincronizados desde MedusaJS)
      if (product.x_medusa_id) {
        const key = product.x_medusa_id;
        if (!duplicatesByMedusaId.has(key)) {
          duplicatesByMedusaId.set(key, []);
        }
        duplicatesByMedusaId.get(key)!.push(product);
      }
      
      // Agrupar por nombre (normalizado)
      const normalizedName = product.name.toLowerCase().trim();
      if (!duplicatesByName.has(normalizedName)) {
        duplicatesByName.set(normalizedName, []);
      }
      duplicatesByName.get(normalizedName)!.push(product);
    });

    // Encontrar duplicados
    const duplicateGroups: Array<{
      key: string;
      products: OdooProduct[];
      keepProduct: OdooProduct;
      productsToDelete: OdooProduct[];
    }> = [];

    // Duplicados por x_medusa_id (más críticos)
    for (const [medusaId, products] of duplicatesByMedusaId.entries()) {
      if (products.length > 1) {
        const sortedProducts = products.sort((a, b) => {
          // Priorizar: activo > precio > fecha de modificación más reciente
          if (a.active && !b.active) return -1;
          if (!a.active && b.active) return 1;
          if (a.list_price > 0 && b.list_price === 0) return -1;
          if (a.list_price === 0 && b.list_price > 0) return 1;
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

    // Duplicados por nombre - manejar casos mixtos (con y sin x_medusa_id)
    for (const [name, products] of duplicatesByName.entries()) {
      if (products.length > 1) {
        const productsWithoutMedusaId = products.filter(p => !p.x_medusa_id);
        const productsWithMedusaId = products.filter(p => p.x_medusa_id);
        
        // Caso 1: Solo productos sin x_medusa_id
        if (productsWithoutMedusaId.length > 1 && productsWithMedusaId.length === 0) {
          const sortedProducts = productsWithoutMedusaId.sort((a, b) => {
            if (a.active && !b.active) return -1;
            if (!a.active && b.active) return 1;
            if (a.list_price > 0 && b.list_price === 0) return -1;
            if (a.list_price === 0 && b.list_price > 0) return 1;
            return new Date(b.write_date).getTime() - new Date(a.write_date).getTime();
          });

          duplicateGroups.push({
            key: `name: ${name} (sin x_medusa_id)`,
            products: productsWithoutMedusaId,
            keepProduct: sortedProducts[0],
            productsToDelete: sortedProducts.slice(1)
          });
        }
        
        // Caso 2: Productos mixtos - priorizar el original de Odoo (sin x_medusa_id, con precio > 0)
        else if (productsWithoutMedusaId.length > 0 && productsWithMedusaId.length > 0) {
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

    if (duplicateGroups.length === 0) {
      console.log("✅ No se encontraron duplicados en Odoo");
      return {
        totalProducts: allProducts.length,
        duplicateGroups: 0,
        productsDeleted: 0,
        errors: 0,
        errorDetails: []
      };
    }

    // Mostrar resumen de duplicados
    console.log("\n📋 Resumen de duplicados encontrados:");
    duplicateGroups.forEach((group, index) => {
      console.log(`\n${index + 1}. ${group.key}`);
      console.log(`   Total productos: ${group.products.length}`);
      console.log(`   ✅ Mantener: ${group.keepProduct.name} (ID: ${group.keepProduct.id})`);
      console.log(`   🗑️ Eliminar: ${group.productsToDelete.length} productos`);
      group.productsToDelete.forEach(product => {
        console.log(`      - ${product.name} (ID: ${product.id})`);
      });
    });

    // Confirmar eliminación
    console.log(`\n⚠️ Se eliminarán ${duplicateGroups.reduce((total, group) => total + group.productsToDelete.length, 0)} productos duplicados.`);
    console.log("🔄 Iniciando eliminación...");

    let totalDeleted = 0;
    const errors: Array<{ product: string; id: number; error: string }> = [];

    // Eliminar productos duplicados
    for (const group of duplicateGroups) {
      console.log(`\n🔄 Procesando grupo: ${group.key}`);
      
      for (const productToDelete of group.productsToDelete) {
        try {
          console.log(`   🗑️ Eliminando: ${productToDelete.name} (ID: ${productToDelete.id})`);
          
          // Desactivar producto en Odoo
          await odooClient.updateProduct(productToDelete.id, {
            active: false // Desactivar en lugar de eliminar para mantener integridad
          });
          
          totalDeleted++;
          console.log(`   ✅ Producto desactivado: ${productToDelete.name}`);
          
        } catch (error: any) {
          const errorMsg = `Error eliminando ${productToDelete.name}: ${error.message || error}`;
          console.error(`   ❌ ${errorMsg}`);
          errors.push({
            product: productToDelete.name,
            id: productToDelete.id,
            error: error.message || error
          });
        }
      }
    }

    // Resumen final
    console.log(`\n🎉 Limpieza completada:`);
    console.log(`   🗑️ Productos desactivados: ${totalDeleted}`);
    console.log(`   ❌ Errores: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Productos con errores:`);
      errors.forEach(err => {
        console.log(`   - ${err.product} (ID: ${err.id}): ${err.error}`);
      });
    }

    return {
      totalProducts: allProducts.length,
      duplicateGroups: duplicateGroups.length,
      productsDeleted: totalDeleted,
      errors: errors.length,
      errorDetails: errors
    };

  } catch (error) {
    console.error("❌ Error en limpieza de duplicados de Odoo:", error);
    throw error;
  }
}

// Función para solo identificar duplicados sin eliminarlos
async function identifyOdooDuplicatesSimple() {
  console.log("🔍 Identificando productos duplicados en Odoo (modo simple)...");

  const odooClient = new SimpleOdooClient();

  try {
    await odooClient.authenticate();
    console.log("✅ Autenticado en Odoo");

    const allProducts = await odooClient.searchRead(
      "product.template",
      [],
      [
        "id",
        "name", 
        "default_code",
        "x_medusa_id",
        "list_price",
        "active",
        "create_date",
        "write_date"
      ],
      10000
    ) as OdooProduct[];

    console.log(`📦 Total de productos encontrados: ${allProducts.length}`);

    // Agrupar por diferentes criterios
    const duplicatesByMedusaId = new Map<string, OdooProduct[]>();
    const duplicatesByName = new Map<string, OdooProduct[]>();
    
    allProducts.forEach(product => {
      // Agrupar por x_medusa_id
      if (product.x_medusa_id) {
        const key = product.x_medusa_id;
        if (!duplicatesByMedusaId.has(key)) {
          duplicatesByMedusaId.set(key, []);
        }
        duplicatesByMedusaId.get(key)!.push(product);
      }
      
      // Agrupar por nombre
      const normalizedName = product.name.toLowerCase().trim();
      if (!duplicatesByName.has(normalizedName)) {
        duplicatesByName.set(normalizedName, []);
      }
      duplicatesByName.get(normalizedName)!.push(product);
    });

    let totalDuplicateCount = 0;

    // Mostrar duplicados por x_medusa_id
    console.log("\n🔍 Duplicados por x_medusa_id:");
    let medusaDuplicateCount = 0;
    for (const [medusaId, products] of duplicatesByMedusaId.entries()) {
      if (products.length > 1) {
        medusaDuplicateCount++;
        console.log(`\n${medusaDuplicateCount}. Medusa ID: ${medusaId} (${products.length} productos)`);
        products.forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name} (ID: ${product.id}) - ${product.active ? 'Activo' : 'Inactivo'} - $${product.list_price} - ${product.write_date}`);
        });
      }
    }

    if (medusaDuplicateCount === 0) {
      console.log("✅ No se encontraron duplicados por x_medusa_id");
    }

    totalDuplicateCount += medusaDuplicateCount;

    // Mostrar duplicados por nombre
    console.log("\n🔍 Duplicados por nombre:");
    let nameDuplicateCount = 0;
    for (const [name, products] of duplicatesByName.entries()) {
      if (products.length > 1) {
        nameDuplicateCount++;
        console.log(`\n${nameDuplicateCount}. Nombre: "${name}" (${products.length} productos)`);
        products.forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name} (ID: ${product.id}) - ${product.active ? 'Activo' : 'Inactivo'} - $${product.list_price} - Ref: ${product.default_code || 'N/A'} - MedusaID: ${product.x_medusa_id || 'N/A'} - ${product.write_date}`);
        });
        
        // Verificar si hay diferencias importantes
        const hasMedusaId = products.some(p => p.x_medusa_id);
        const hasNoMedusaId = products.some(p => !p.x_medusa_id);
        const hasDifferentPrices = products.some(p => p.list_price !== products[0].list_price);
        
        if (hasMedusaId && hasNoMedusaId) {
          console.log(`   ⚠️ MIXTO: Algunos tienen x_medusa_id y otros no`);
        }
        if (hasDifferentPrices) {
          console.log(`   ⚠️ PRECIOS DIFERENTES: Los productos tienen precios distintos`);
        }
      }
    }

    if (nameDuplicateCount === 0) {
      console.log("✅ No se encontraron duplicados por nombre");
    }

    totalDuplicateCount += nameDuplicateCount;

    return {
      totalProducts: allProducts.length,
      duplicatesFound: totalDuplicateCount
    };

  } catch (error) {
    console.error("❌ Error identificando duplicados:", error);
    throw error;
  }
}

// Función principal para ejecutar desde línea de comandos
async function main() {
  const action = process.argv[2];
  
  if (action === "identify") {
    return await identifyOdooDuplicatesSimple();
  } else {
    return await cleanupOdooDuplicatesSimple();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main()
    .then(result => {
      console.log("\n📊 Resumen:", result);
      process.exit(0);
    })
    .catch(error => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
}

export { cleanupOdooDuplicatesSimple, identifyOdooDuplicatesSimple };
export default main;
