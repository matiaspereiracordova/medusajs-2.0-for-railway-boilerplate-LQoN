#!/usr/bin/env node

/**
 * Script para probar el endpoint de precios calculados
 */

const BACKEND_URL = 'https://backend-production-6f9f.up.railway.app';

async function testPricesEndpoint() {
  console.log('🔍 Probando endpoint de precios calculados...\n');

  try {
    const url = `${BACKEND_URL}/admin/list-all-products-prices`;
    console.log(`📡 GET ${url}\n`);

    const response = await fetch(url);
    
    console.log(`Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Error:', text);
      return;
    }

    const data = await response.json();
    
    console.log('✅ Respuesta recibida:\n');
    console.log('Stats:', JSON.stringify(data.stats, null, 2));
    console.log('\nSummary:', JSON.stringify(data.summary, null, 2));
    
    if (data.allProducts && data.allProducts.length > 0) {
      console.log('\n📦 Primer producto:');
      const firstProduct = data.allProducts[0];
      console.log(JSON.stringify(firstProduct, null, 2));
    }

    // Buscar específicamente los Pantalones cortos
    const pantalonesCortos = data.allProducts?.find(p => p.handle === 'pantalones-cortos');
    if (pantalonesCortos) {
      console.log('\n🩳 Pantalones Cortos:');
      console.log(JSON.stringify(pantalonesCortos, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPricesEndpoint();

