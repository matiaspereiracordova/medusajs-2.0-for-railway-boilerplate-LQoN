#!/usr/bin/env node

/**
 * Script para probar el seed manualmente en Railway
 * URL: https://backend-production-6f9f.up.railway.app
 */

const https = require('https');

const RAILWAY_URL = 'https://backend-production-6f9f.up.railway.app';

console.log('🧪 Probando endpoint de seed en Railway...\n');
console.log('📍 URL:', RAILWAY_URL);
console.log('🔗 Endpoint:', `${RAILWAY_URL}/admin/seed`);
console.log('');

// Test GET primero (verificar que existe)
console.log('1️⃣ Verificando que el endpoint existe (GET)...');

https.get(`${RAILWAY_URL}/admin/seed`, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('   Status:', res.statusCode);
    if (res.statusCode === 200) {
      console.log('   ✅ Endpoint disponible');
      console.log('   Respuesta:', data);
      console.log('');
      
      // Ahora probar POST
      console.log('2️⃣ ¿Deseas ejecutar el seed ahora? (POST)');
      console.log('   ⚠️  ADVERTENCIA: Esto creará productos en la base de datos');
      console.log('   ⚠️  Si ya tienes productos, creará duplicados a menos que tengas FORCE_SEED=false');
      console.log('');
      console.log('   Para ejecutar el seed, usa:');
      console.log('   → npm run railway:seed');
      console.log('   O ejecuta:');
      console.log(`   → curl -X POST ${RAILWAY_URL}/admin/seed`);
    } else {
      console.log('   ❌ Endpoint no disponible');
      console.log('   Respuesta:', data);
    }
  });
}).on('error', (err) => {
  console.error('   ❌ Error conectando:', err.message);
  console.log('');
  console.log('💡 Posibles causas:');
  console.log('   - El servicio no está corriendo en Railway');
  console.log('   - La URL es incorrecta');
  console.log('   - Hay un error de red');
});


