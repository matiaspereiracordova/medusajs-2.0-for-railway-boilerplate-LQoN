/**
 * Script de diagnóstico para verificar la conexión con Odoo
 * 
 * Este script verifica:
 * 1. Variables de entorno de Odoo
 * 2. Conexión con la API de Odoo
 * 3. Autenticación
 * 4. Operaciones básicas
 */

const { OdooClient } = require('./src/services/odoo-client.ts');

async function testOdooConnection() {
  console.log('🔍 Iniciando diagnóstico de conexión con Odoo...\n');
  
  // 1. Verificar variables de entorno
  console.log('📋 Verificando variables de entorno:');
  const requiredVars = ['ODOO_URL', 'ODOO_DATABASE', 'ODOO_USERNAME', 'ODOO_PASSWORD'];
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`  ✅ ${varName}: ${value.substring(0, 10)}...`);
    } else {
      console.log(`  ❌ ${varName}: NO DEFINIDA`);
    }
  }
  
  console.log('\n🔌 Probando conexión con Odoo...');
  
  try {
    const odooClient = new OdooClient();
    
    // 2. Probar autenticación
    console.log('🔐 Probando autenticación...');
    const uid = await odooClient.authenticate();
    console.log(`  ✅ Autenticación exitosa. UID: ${uid}`);
    
    // 3. Probar operación básica
    console.log('📊 Probando operación básica...');
    const products = await odooClient.searchRead(
      'product.template',
      [['sale_ok', '=', true]],
      ['id', 'name', 'list_price'],
      5
    );
    console.log(`  ✅ Operación exitosa. Productos encontrados: ${products.length}`);
    
    if (products.length > 0) {
      console.log('  📦 Primeros productos:');
      products.forEach((product, index) => {
        console.log(`    ${index + 1}. ${product.name} - $${product.list_price}`);
      });
    }
    
    console.log('\n🎉 ¡Conexión con Odoo exitosa!');
    
  } catch (error) {
    console.error('\n❌ Error en la conexión con Odoo:');
    console.error(`  Tipo: ${error.constructor.name}`);
    console.error(`  Mensaje: ${error.message}`);
    
    if (error.message.includes('fetch')) {
      console.error('  💡 Posible problema: URL de Odoo incorrecta o servidor no disponible');
    } else if (error.message.includes('authentication') || error.message.includes('credenciales')) {
      console.error('  💡 Posible problema: Credenciales incorrectas');
    } else if (error.message.includes('database')) {
      console.error('  💡 Posible problema: Nombre de base de datos incorrecto');
    }
    
    console.error('\n🔧 Soluciones sugeridas:');
    console.error('  1. Verificar que Odoo esté ejecutándose');
    console.error('  2. Verificar las variables de entorno en Railway');
    console.error('  3. Verificar las credenciales de Odoo');
    console.error('  4. Verificar la URL de Odoo');
  }
}

// Ejecutar diagnóstico
testOdooConnection().catch(console.error);

