/**
 * Script de debug y sincronización para "Pantalones cortos"
 * 
 * Este script:
 * 1. Inspecciona la estructura del producto en Medusa
 * 2. Sincroniza el producto a Odoo
 * 3. Muestra logs detallados
 */

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';

async function debugProduct(title = 'Pantalones cortos') {
  try {
    console.log(`\n🔍 Inspeccionando producto: "${title}"...`);
    
    const response = await fetch(`${BACKEND_URL}/admin/debug-product-variants?title=${encodeURIComponent(title)}`);
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      console.log(`❌ ${data.message}`);
      return null;
    }

    console.log(`\n✅ Producto encontrado!`);
    console.log(`📦 Título: ${data.data[0].title}`);
    console.log(`🆔 ID: ${data.data[0].id}`);
    console.log(`📊 Total de variantes: ${data.data[0].totalVariants}`);
    
    console.log(`\n🔍 Opciones del producto:`, data.data[0].productOptions);
    
    console.log(`\n📋 Variantes:`);
    data.data[0].variants.forEach((v, idx) => {
      console.log(`  ${idx + 1}. ${v.title || v.sku}`);
      console.log(`     SKU: ${v.sku}`);
      console.log(`     Options: ${JSON.stringify(v.options)}`);
      console.log(`     Has Options: ${v.hasOptions}`);
    });

    console.log(`\n🐛 Debug info:`, JSON.stringify(data.data[0].debug, null, 2));

    return data.data[0];
  } catch (error) {
    console.error('❌ Error inspeccionando producto:', error.message);
    return null;
  }
}

async function syncProduct(productId) {
  try {
    console.log(`\n🚀 Sincronizando producto ${productId} a Odoo...`);
    
    const response = await fetch(`${BACKEND_URL}/admin/sync-to-odoo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productIds: [productId],
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('\n✅ Sincronización completada!');
    console.log(`📊 Productos sincronizados: ${result.data.syncedProducts}`);
    console.log(`➕ Productos creados: ${result.data.createdProducts}`);
    console.log(`🔄 Productos actualizados: ${result.data.updatedProducts}`);
    console.log(`❌ Errores: ${result.data.errorCount}`);
    
    if (result.data.errors && result.data.errors.length > 0) {
      console.log('\n⚠️ Errores detectados:');
      result.data.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.product}: ${err.error}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error sincronizando:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🧪 Iniciando debug y sincronización de "Pantalones cortos"...\n');
  console.log('═'.repeat(80));
  
  try {
    // Paso 1: Inspeccionar el producto
    const productData = await debugProduct('Pantalones cortos');
    
    if (!productData) {
      console.log('\n⚠️ No se pudo obtener datos del producto. Asegúrate de que:');
      console.log('  1. El servidor backend esté corriendo (npm run dev)');
      console.log('  2. El producto "Pantalones cortos" exista en Medusa');
      process.exit(1);
    }

    console.log('\n' + '═'.repeat(80));
    
    // Paso 2: Sincronizar a Odoo
    await syncProduct(productData.id);
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n🎉 Proceso completado!');
    console.log('\n💡 Ahora verifica en Odoo:');
    console.log('  1. Abre el producto "Pantalones cortos"');
    console.log('  2. Ve a la pestaña "Atributos y variantes"');
    console.log('  3. Deberías ver el atributo "Size" con valores L, M, S, XL');
    
  } catch (error) {
    console.error('\n❌ Error en el proceso:', error.message);
    process.exit(1);
  }
}

// Ejecutar
main();

