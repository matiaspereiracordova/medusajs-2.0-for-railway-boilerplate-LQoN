#!/usr/bin/env node

/**
 * Script para verificar el estado del seed en Railway
 * Útil para diagnosticar problemas de seeding
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando estado del seed...\n');

// 1. Verificar variables de entorno
console.log('📋 Variables de Entorno:');
console.log('  - NODE_ENV:', process.env.NODE_ENV || '(no configurada)');
console.log('  - RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT || '(no configurada)');
console.log('  - RAILWAY_PROJECT_ID:', process.env.RAILWAY_PROJECT_ID || '(no configurada)');
console.log('  - FORCE_SEED:', process.env.FORCE_SEED || '(no configurada)');
console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configurada' : '❌ No configurada');
console.log('');

// 2. Verificar archivo marker
const seedMarkerPath = path.join(__dirname, '.seed-completed');
if (fs.existsSync(seedMarkerPath)) {
  const timestamp = fs.readFileSync(seedMarkerPath, 'utf8');
  console.log('📝 Marker File:');
  console.log('  - Estado: ✅ Existe');
  console.log('  - Fecha de última ejecución:', timestamp);
} else {
  console.log('📝 Marker File:');
  console.log('  - Estado: ❌ No existe (seed no se ha ejecutado)');
}
console.log('');

// 3. Verificar archivos necesarios
console.log('📁 Archivos del Sistema:');
const filesToCheck = [
  './src/scripts/seed.ts',
  './railway-post-deploy.js',
  './railway.json',
  './package.json'
];

filesToCheck.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  console.log(`  - ${file}: ${exists ? '✅' : '❌'}`);
});
console.log('');

// 4. Verificar railway.json
console.log('⚙️ Configuración Railway:');
try {
  const railwayConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'railway.json'), 'utf8'));
  console.log('  - postDeployCommand:', railwayConfig.deploy?.postDeployCommand || '(no configurado)');
  
  if (railwayConfig.deploy?.postDeployCommand === 'node railway-post-deploy.js') {
    console.log('  - Estado: ✅ Configuración correcta');
  } else {
    console.log('  - Estado: ⚠️ Debería ser "node railway-post-deploy.js"');
  }
} catch (error) {
  console.log('  - Estado: ❌ Error leyendo railway.json');
}
console.log('');

// 5. Recomendaciones
console.log('💡 Recomendaciones:');

if (!process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_PROJECT_ID) {
  console.log('  ⚠️ No estás en Railway. Este script es principalmente para Railway.');
}

if (fs.existsSync(seedMarkerPath) && process.env.FORCE_SEED !== 'true') {
  console.log('  ℹ️ El seed ya se ejecutó. Para re-ejecutar:');
  console.log('     1. Configura FORCE_SEED=true en Railway');
  console.log('     2. O ejecuta: npm run seed:force');
  console.log('     3. O elimina el archivo .seed-completed');
}

if (!fs.existsSync(seedMarkerPath)) {
  console.log('  ℹ️ El seed no se ha ejecutado aún.');
  console.log('     - Debería ejecutarse automáticamente en el próximo deployment');
  console.log('     - O ejecútalo manualmente: npm run seed');
}

console.log('');
console.log('✅ Verificación completada!');
console.log('');
console.log('📚 Para más información, consulta: RAILWAY-SEED-GUIDE.md');


