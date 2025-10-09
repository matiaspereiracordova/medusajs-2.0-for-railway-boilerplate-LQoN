/**
 * Script específico para probar la verificación de duplicados de variantes
 * Este script prueba directamente el método checkAttributeLineExists
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Probando verificación de duplicados de variantes...\n');

async function testDuplicateCheck() {
  try {
    console.log('📋 Ejecutando script de prueba de duplicados...');
    
    // Crear un script temporal que pruebe la funcionalidad
    const testScript = `
import OdooModuleService from './src/modules/odoo/service.js';
import { ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD } from './src/lib/constants.js';

async function testDuplicateCheck() {
  try {
    console.log('🔧 Inicializando servicio Odoo...');
    
    const odooService = new OdooModuleService({}, {
      url: ODOO_URL,
      dbName: ODOO_DATABASE,
      username: ODOO_USERNAME,
      apiKey: ODOO_PASSWORD
    });
    
    console.log('🔐 Autenticando con Odoo...');
    await odooService.login();
    
    console.log('🔍 Probando verificación de duplicados...');
    
    // Buscar un producto existente para probar
    const products = await odooService.fetchProducts({ limit: 1 });
    
    if (products.length === 0) {
      console.log('⚠️ No hay productos en Odoo para probar');
      return;
    }
    
    const testProductId = products[0].id;
    console.log(\`📦 Usando producto de prueba: \${products[0].name} (ID: \${testProductId})\`);
    
    // Crear un atributo de prueba
    console.log('➕ Creando atributo de prueba...');
    const attributeId = await odooService.getOrCreateAttribute('TestVariant');
    
    // Verificar si existe la línea de atributo (primera vez - debería ser false)
    console.log('🔍 Verificando existencia de línea de atributo (primera vez)...');
    const existsFirst = await odooService.checkAttributeLineExists(testProductId, attributeId);
    console.log(\`📊 Resultado primera verificación: \${existsFirst}\`);
    
    // Agregar la línea de atributo
    console.log('➕ Agregando línea de atributo...');
    const valueId = await odooService.getOrCreateAttributeValue(attributeId, 'TestValue');
    await odooService.addAttributeLineToProduct(testProductId, attributeId, [valueId]);
    
    // Verificar si existe la línea de atributo (segunda vez - debería ser true)
    console.log('🔍 Verificando existencia de línea de atributo (segunda vez)...');
    const existsSecond = await odooService.checkAttributeLineExists(testProductId, attributeId);
    console.log(\`📊 Resultado segunda verificación: \${existsSecond}\`);
    
    // Intentar agregar la misma línea de atributo otra vez
    console.log('🔄 Intentando agregar la misma línea de atributo otra vez...');
    const existsThird = await odooService.checkAttributeLineExists(testProductId, attributeId);
    console.log(\`📊 Resultado tercera verificación: \${existsThird}\`);
    
    if (existsFirst === false && existsSecond === true && existsThird === true) {
      console.log('✅ ¡Prueba exitosa! La verificación de duplicados funciona correctamente');
      console.log('📝 La línea de atributo se detectó correctamente como existente');
    } else {
      console.log('❌ Prueba fallida - la verificación de duplicados no funciona como esperado');
      console.log(\`📊 Resultados: Primera=\${existsFirst}, Segunda=\${existsSecond}, Tercera=\${existsThird}\`);
    }
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
}

testDuplicateCheck();
`;

    // Escribir el script temporal
    const fs = require('fs');
    const tempScriptPath = path.join(__dirname, 'temp-test-duplicate-check.js');
    fs.writeFileSync(tempScriptPath, testScript);
    
    // Ejecutar el script temporal
    const result = execSync(`npx medusa exec ${tempScriptPath}`, {
      cwd: path.join(__dirname),
      encoding: 'utf8'
    });
    
    console.log('📊 Resultado de la prueba:');
    console.log(result);
    
    // Limpiar archivo temporal
    fs.unlinkSync(tempScriptPath);
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    console.error('📋 Asegúrate de que:');
    console.error('   1. Las variables de entorno de Odoo estén configuradas');
    console.error('   2. Odoo esté ejecutándose y accesible');
    console.error('   3. El backend de Medusa esté ejecutándose');
  }
}

// Ejecutar la prueba
testDuplicateCheck();

