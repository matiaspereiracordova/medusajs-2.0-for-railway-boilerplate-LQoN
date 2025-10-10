#!/usr/bin/env node

/**
 * Script para verificar cuántos productos hay en Railway
 * URL: https://backend-production-6f9f.up.railway.app
 */

const https = require('https');

const RAILWAY_URL = 'https://backend-production-6f9f.up.railway.app';

console.log('🔍 Verificando productos en Railway...\n');
console.log('📍 URL:', RAILWAY_URL);
console.log('');

// Intentar obtener productos via API pública
console.log('📊 Consultando productos...');

https.get(`${RAILWAY_URL}/store/products?limit=100`, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('   Status:', res.statusCode);
    console.log('');
    
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data);
        const products = json.products || [];
        
        console.log('✅ Productos encontrados:', products.length);
        
        if (products.length === 0) {
          console.log('');
          console.log('ℹ️  No hay productos aún.');
          console.log('');
          console.log('💡 Para crear productos:');
          console.log('   1. Espera a que termine el deployment en Railway');
          console.log('   2. El seed debería ejecutarse automáticamente');
          console.log('   3. O ejecuta manualmente: npm run railway:seed');
        } else {
          console.log('');
          console.log('📦 Primeros productos:');
          products.slice(0, 5).forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.title} (${p.status})`);
          });
          
          if (products.length > 5) {
            console.log(`   ... y ${products.length - 5} más`);
          }
          
          console.log('');
          console.log('✅ El seed se ejecutó correctamente!');
          console.log('🎉 Puedes ver todos los productos en:');
          console.log(`   → ${RAILWAY_URL}/app/products`);
        }
      } catch (e) {
        console.log('❌ Error parseando respuesta:', e.message);
        console.log('Respuesta raw:', data);
      }
    } else {
      console.log('❌ Error consultando productos');
      console.log('Respuesta:', data);
    }
  });
}).on('error', (err) => {
  console.error('❌ Error conectando:', err.message);
  console.log('');
  console.log('💡 Verifica:');
  console.log('   - Que el servicio esté corriendo en Railway');
  console.log('   - Que el deployment haya terminado');
  console.log('   - Los logs de Railway');
});


