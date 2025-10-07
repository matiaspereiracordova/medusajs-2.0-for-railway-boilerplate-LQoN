#!/usr/bin/env node

/**
 * Script manual para probar la sincronización de precios
 * Ejecutar con: node test-price-sync-manual.js
 */

const fetch = require('node-fetch');

const BACKEND_URL = process.env.BACKEND_URL || 'https://backend-production-6f9f.up.railway.app';

async function testPriceSync() {
  console.log('🧪 Iniciando test manual de sincronización de precios...\n');
  
  try {
    // Sincronizar precios
    console.log(`📤 Enviando request a: ${BACKEND_URL}/admin/sync-prices-to-odoo`);
    
    const response = await fetch(`${BACKEND_URL}/admin/sync-prices-to-odoo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 10,
        offset: 0
      })
    });

    const data = await response.json();
    
    console.log('\n📊 Resultado de la sincronización:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ Sincronización exitosa!');
      console.log(`   - Productos sincronizados: ${data.data.syncedProducts}`);
      console.log(`   - Variantes sincronizadas: ${data.data.syncedVariants}`);
      console.log(`   - Precios sincronizados: ${data.data.syncedPrices}`);
      console.log(`   - Errores: ${data.data.errorCount}`);
      
      if (data.data.errors && data.data.errors.length > 0) {
        console.log('\n⚠️ Errores encontrados:');
        data.data.errors.forEach(err => {
          console.log(`   - ${err.product}: ${err.error}`);
        });
      }
    } else {
      console.log('\n❌ Error en la sincronización:');
      console.log(`   ${data.message}`);
      if (data.error) {
        console.log(`   ${data.error}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error ejecutando el test:', error.message);
    console.error(error);
  }
}

// Ejecutar el test
testPriceSync();

