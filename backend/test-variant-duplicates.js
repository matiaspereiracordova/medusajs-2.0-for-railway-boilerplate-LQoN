/**
 * Script de prueba para verificar que no se crean duplicados de variantes
 * Este script simula múltiples ejecuciones de sincronización para verificar
 * que las variantes no se duplican
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Iniciando prueba de duplicados de variantes...\n');

async function testVariantDuplicates() {
  try {
    console.log('📋 Paso 1: Ejecutando sincronización inicial...');
    
    // Ejecutar sincronización inicial
    const initialSync = execSync('npx medusa exec ./src/workflows/sync-to-odoo.ts --limit=1', {
      cwd: path.join(__dirname),
      encoding: 'utf8'
    });
    
    console.log('✅ Sincronización inicial completada');
    console.log('📊 Resultado:', initialSync.split('\n').slice(-5).join('\n'));
    
    console.log('\n📋 Paso 2: Ejecutando segunda sincronización (debería omitir duplicados)...');
    
    // Ejecutar segunda sincronización (debería omitir duplicados)
    const secondSync = execSync('npx medusa exec ./src/workflows/sync-to-odoo.ts --limit=1', {
      cwd: path.join(__dirname),
      encoding: 'utf8'
    });
    
    console.log('✅ Segunda sincronización completada');
    console.log('📊 Resultado:', secondSync.split('\n').slice(-5).join('\n'));
    
    console.log('\n📋 Paso 3: Ejecutando tercera sincronización (debería omitir duplicados)...');
    
    // Ejecutar tercera sincronización (debería omitir duplicados)
    const thirdSync = execSync('npx medusa exec ./src/workflows/sync-to-odoo.ts --limit=1', {
      cwd: path.join(__dirname),
      encoding: 'utf8'
    });
    
    console.log('✅ Tercera sincronización completada');
    console.log('📊 Resultado:', thirdSync.split('\n').slice(-5).join('\n'));
    
    console.log('\n🎉 Prueba completada exitosamente!');
    console.log('📝 Verifica en Odoo que no se hayan creado variantes duplicadas');
    console.log('💡 Las sincronizaciones 2 y 3 deberían mostrar mensajes como:');
    console.log('   "ℹ️ Línea de atributo ya existe para \'Variant\', omitiendo creación"');
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    console.error('📋 Asegúrate de que:');
    console.error('   1. Las variables de entorno de Odoo estén configuradas');
    console.error('   2. Odoo esté ejecutándose y accesible');
    console.error('   3. El backend de Medusa esté ejecutándose');
  }
}

// Ejecutar la prueba
testVariantDuplicates();

