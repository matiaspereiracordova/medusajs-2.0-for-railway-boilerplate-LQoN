import fetch from 'node-fetch'

async function checkPricesRemote() {
  try {
    console.log("🔍 Verificando precios desde servidor remoto...")
    
    // URL de tu API de MedusaJS en Railway
    const baseUrl = 'https://backend-production-6f9f.up.railway.app'
    
    // 1. Verificar que el servidor esté funcionando
    console.log(`📡 Verificando servidor: ${baseUrl}`)
    const healthResponse = await fetch(`${baseUrl}/health`)
    
    if (!healthResponse.ok) {
      console.error(`❌ Servidor no disponible: ${healthResponse.status}`)
      return
    }
    
    console.log("✅ Servidor funcionando")
    
    // 2. Obtener productos usando el endpoint de admin
    console.log(`📡 Obteniendo productos desde: ${baseUrl}/admin/products`)
    
    // Necesitamos autenticarnos para usar el endpoint de admin
    // Vamos a usar el endpoint de store que es público
    const productsResponse = await fetch(`${baseUrl}/store/products`)
    
    if (!productsResponse.ok) {
      console.error(`❌ Error obteniendo productos: ${productsResponse.status}`)
      console.log("Intentando con endpoint alternativo...")
      
      // Intentar con el endpoint de admin sin autenticación (puede que funcione)
      const adminResponse = await fetch(`${baseUrl}/admin/products`)
      if (adminResponse.ok) {
        console.log("✅ Endpoint de admin funciona")
        const adminData = await adminResponse.json()
        console.log(`📦 Productos encontrados: ${adminData.products?.length || 0}`)
        
        if (adminData.products && adminData.products.length > 0) {
          for (const product of adminData.products.slice(0, 3)) {
            console.log(`\n🔍 Producto: ${product.title} (ID: ${product.id})`)
            console.log(`   Variants: ${product.variants?.length || 0}`)
            
            if (product.variants && product.variants.length > 0) {
              for (const variant of product.variants) {
                console.log(`   📋 Variant: ${variant.title} (ID: ${variant.id})`)
                
                if (variant.calculated_price) {
                  console.log(`   ✅ Calculated price: ${variant.calculated_price.calculated_amount} ${variant.calculated_price.currency_code}`)
                  console.log(`   💰 Precio final: $${variant.calculated_price.calculated_amount / 100}`)
                } else {
                  console.log(`   ❌ No calculated_price`)
                }
                
                if (variant.prices && variant.prices.length > 0) {
                  console.log(`   💰 Precios directos: ${variant.prices.length}`)
                  variant.prices.forEach((price: any, index: number) => {
                    const amount = Number(price.amount) || 0
                    console.log(`     ${index + 1}. ${price.currency_code}: ${amount} centavos ($${amount / 100})`)
                  })
                } else {
                  console.log(`   ❌ No prices array`)
                }
              }
            }
          }
        }
      }
      return
    }
    
    const products = await productsResponse.json()
    console.log(`📦 Productos encontrados: ${products.products?.length || 0}`)
    
    // 3. Verificar precios de cada producto
    if (products.products && products.products.length > 0) {
      for (const product of products.products.slice(0, 3)) {
        console.log(`\n🔍 Producto: ${product.title} (ID: ${product.id})`)
        console.log(`   Variants: ${product.variants?.length || 0}`)
        
        if (product.variants && product.variants.length > 0) {
          for (const variant of product.variants) {
            console.log(`   📋 Variant: ${variant.title} (ID: ${variant.id})`)
            
            if (variant.calculated_price) {
              console.log(`   ✅ Calculated price: ${variant.calculated_price.calculated_amount} ${variant.calculated_price.currency_code}`)
              console.log(`   💰 Precio final: $${variant.calculated_price.calculated_amount / 100}`)
            } else {
              console.log(`   ❌ No calculated_price`)
            }
            
            if (variant.prices && variant.prices.length > 0) {
              console.log(`   💰 Precios directos: ${variant.prices.length}`)
              variant.prices.forEach((price: any, index: number) => {
                const amount = Number(price.amount) || 0
                console.log(`     ${index + 1}. ${price.currency_code}: ${amount} centavos ($${amount / 100})`)
              })
            } else {
              console.log(`   ❌ No prices array`)
            }
          }
        }
      }
    }
    
    // 4. Verificar regiones
    console.log(`\n📡 Obteniendo regiones desde: ${baseUrl}/store/regions`)
    const regionsResponse = await fetch(`${baseUrl}/store/regions`)
    
    if (regionsResponse.ok) {
      const regions = await regionsResponse.json()
      console.log(`🌍 Regiones encontradas: ${regions.regions?.length || 0}`)
      
      if (regions.regions) {
        regions.regions.forEach((region: any, index: number) => {
          console.log(`   ${index + 1}. ${region.name} (${region.currency_code}) - ID: ${region.id}`)
        })
      }
    }
    
  } catch (error) {
    console.error("❌ Error verificando precios:", error)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  checkPricesRemote()
}

export default checkPricesRemote
