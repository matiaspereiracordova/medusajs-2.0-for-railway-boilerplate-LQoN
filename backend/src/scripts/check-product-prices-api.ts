import fetch from 'node-fetch'

async function checkProductPrices() {
  try {
    console.log("🔍 Verificando precios de productos via API...")
    
    // URL de tu API de MedusaJS en Railway
    const baseUrl = process.env.BACKEND_PUBLIC_URL || 'https://medusajs-2-0-for-railway-boilerplate-lqon-production.up.railway.app'
    
    // 1. Obtener productos
    console.log(`📡 Obteniendo productos desde: ${baseUrl}/store/products`)
    const productsResponse = await fetch(`${baseUrl}/store/products`)
    
    if (!productsResponse.ok) {
      console.error(`❌ Error obteniendo productos: ${productsResponse.status}`)
      return
    }
    
    const products = await productsResponse.json()
    console.log(`📦 Productos encontrados: ${products.products?.length || 0}`)
    
    // 2. Verificar precios de cada producto
    if (products.products && products.products.length > 0) {
      for (const product of products.products.slice(0, 5)) { // Solo los primeros 5
        console.log(`\n🔍 Producto: ${product.title} (ID: ${product.id})`)
        console.log(`   Variants: ${product.variants?.length || 0}`)
        
        if (product.variants && product.variants.length > 0) {
          for (const variant of product.variants) {
            console.log(`   📋 Variant: ${variant.title} (ID: ${variant.id})`)
            
            // Verificar calculated_price
            if (variant.calculated_price) {
              console.log(`   ✅ Calculated price: ${variant.calculated_price.calculated_amount} ${variant.calculated_price.currency_code}`)
              console.log(`   💰 Precio final: $${variant.calculated_price.calculated_amount / 100}`)
            } else {
              console.log(`   ❌ No calculated_price`)
            }
            
            // Verificar si tiene prices array
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
    
    // 3. Verificar regiones
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
  checkProductPrices()
}

export default checkProductPrices
