#!/usr/bin/env node

/**
 * Script para resetear el marker del seed
 * Úsalo cuando quieras que el seed se vuelva a ejecutar automáticamente
 */

const fs = require('fs');
const path = require('path');

const seedMarkerPath = path.join(__dirname, '.seed-completed');

console.log('🔄 Reseteando marker del seed...\n');

if (fs.existsSync(seedMarkerPath)) {
  const timestamp = fs.readFileSync(seedMarkerPath, 'utf8');
  console.log('📝 Marker encontrado:');
  console.log('  - Última ejecución:', timestamp);
  
  fs.unlinkSync(seedMarkerPath);
  console.log('  - Estado: ✅ Eliminado\n');
  
  console.log('✅ Marker reseteado exitosamente!');
  console.log('');
  console.log('💡 Próximos pasos:');
  console.log('  1. El seed se ejecutará automáticamente en el próximo deployment');
  console.log('  2. O ejecuta manualmente: npm run seed');
  console.log('  3. O en Railway, haz un re-deploy');
} else {
  console.log('ℹ️ No existe marker file');
  console.log('  - El seed no se ha ejecutado aún, o ya fue eliminado');
  console.log('  - No hay nada que resetear');
}

console.log('');


