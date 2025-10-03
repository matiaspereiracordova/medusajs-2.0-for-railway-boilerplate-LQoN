// Script para verificar productos en la tienda
const fetch = require('node-fetch');

const BACKEND_URL = process.env.BACKEND_PUBLIC_URL || 'http://localhost:9000';

async function checkProducts() {
  try {
    console.log('🔍 Verificando productos en la tienda...');
    
    // Verificar productos desde la API del store
    const response = await fetch(`${BACKEND_URL}/store/products`);
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const products = data.products || [];
    
    console.log(`\n📦 Productos encontrados: ${products.length}`);
    
    if (products.length > 0) {
      console.log('\n🛍️ Lista de productos:');
      products.forEach((product, index) => {
        console.log(`${index + 1}. ${product.title}`);
        console.log(`   Handle: ${product.handle}`);
        console.log(`   Status: ${product.status}`);
        console.log(`   Variants: ${product.variants?.length || 0}`);
        
        if (product.variants && product.variants.length > 0) {
          console.log('   Precios:');
          product.variants.forEach(variant => {
            if (variant.prices) {
              variant.prices.forEach(price => {
                console.log(`     ${price.currency_code.toUpperCase()}: $${price.amount}`);
              });
            }
          });
        }
        console.log('');
      });
    } else {
      console.log('\n❌ No se encontraron productos');
      console.log('💡 Sugerencias:');
      console.log('   1. Verifica que el script de seed se haya ejecutado');
      console.log('   2. Revisa los logs del backend');
      console.log('   3. Verifica la configuración de la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error verificando productos:', error.message);
  }
}

checkProducts();
