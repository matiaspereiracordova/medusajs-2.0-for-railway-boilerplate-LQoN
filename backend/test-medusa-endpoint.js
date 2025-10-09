const fetch = require('node-fetch');

const MEDUSA_URL = "https://backend-production-6f9f.up.railway.app";

async function testMedusaEndpoint() {
  console.log("🧪 Probando endpoints de MedusaJS...\n");

  // Probar con diferentes SKUs
  const skus = ["comida-seca-de-gato", "PNA", "comida"];
  
  for (const sku of skus) {
    try {
      console.log(`🔍 Probando SKU: ${sku}`);
      
      const response = await fetch(`${MEDUSA_URL}/store/check-stock?sku=${sku}&quantity=1`);
      const data = await response.text();
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${data.substring(0, 200)}...`);
      
      if (response.ok) {
        try {
          const jsonData = JSON.parse(data);
          console.log(`   ✅ En stock: ${jsonData.inStock}`);
          console.log(`   📦 Disponible: ${jsonData.available}`);
        } catch (e) {
          console.log(`   ⚠️ Respuesta no es JSON válido`);
        }
      }
      console.log();
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  // Probar endpoint de sincronización manual
  console.log("🔧 Probando endpoint de sincronización manual...");
  try {
    const response = await fetch(`${MEDUSA_URL}/admin/sync-stock-now?limit=10`);
    const data = await response.text();
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${data.substring(0, 300)}...`);
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

testMedusaEndpoint();

