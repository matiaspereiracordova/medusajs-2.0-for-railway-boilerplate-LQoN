import { ExecArgs } from "@medusajs/framework"
import { IProductModuleService, IPricingModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export default async function setupProductPrices({ container }: ExecArgs) {
  const logger = container.resolve("logger")
  
  const productModuleService: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  )
  
  const pricingModuleService: IPricingModuleService = container.resolve(
    ModuleRegistrationName.PRICING
  )
  
  const regionModuleService: IRegionModuleService = container.resolve(
    ModuleRegistrationName.REGION
  )

  try {
    console.log("🔧 Configurando precios para productos...")
    
    // 1. Obtener región de Chile
    const regions = await regionModuleService.listRegions({
      currency_code: "clp"
    })
    const chileRegion = regions?.[0]
    
    if (!chileRegion) {
      console.error("❌ No se encontró región de Chile (CLP)")
      return
    }
    
    console.log(`🌍 Región encontrada: ${chileRegion.name} (${chileRegion.currency_code})`)
    
    // 2. Obtener productos
    const products = await productModuleService.listProducts(
      {},
      {
        relations: ["variants"],
        take: 50
      }
    )
    
    console.log(`📦 Productos encontrados: ${products.length}`)
    
    // 3. Configurar precios para cada producto
    for (const product of products) {
      console.log(`\n🔍 Procesando: ${product.title}`)
      
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          console.log(`   📋 Variant: ${variant.title} (ID: ${variant.id})`)
          
          // Verificar si ya tiene precios
          const existingPrices = await pricingModuleService.listPrices()
          const variantPrices = existingPrices.filter((price: any) => {
            return price.variant_id === variant.id || 
                   (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id))
          })
          
          if (variantPrices.length > 0) {
            console.log(`   ✅ Ya tiene ${variantPrices.length} precios configurados`)
            continue
          }
          
          // Crear precio para el variant
          const priceAmount = Math.floor(Math.random() * 50000) + 5000 // Precio aleatorio entre $5,000 y $55,000 CLP
          
          try {
            // Crear precio usando el módulo de precios
            const newPrice = await pricingModuleService.createPrices([{
              variant_id: variant.id,
              currency_code: "clp",
              amount: priceAmount * 100, // Convertir a centavos
              region_id: chileRegion.id
            }])
            
            console.log(`   💰 Precio creado: $${priceAmount} CLP (${priceAmount * 100} centavos)`)
            
          } catch (error) {
            console.error(`   ❌ Error creando precio para variant ${variant.id}:`, error)
          }
        }
      } else {
        console.log(`   ⚠️ Producto sin variants`)
      }
    }
    
    console.log("\n✅ Configuración de precios completada")
    
    // 4. Verificar precios creados
    console.log("\n🔍 Verificando precios creados...")
    const allPrices = await pricingModuleService.listPrices()
    console.log(`💰 Total de precios en el sistema: ${allPrices.length}`)
    
    if (allPrices.length > 0) {
      console.log("🔍 Últimos 5 precios creados:")
      allPrices.slice(-5).forEach((price: any, index: number) => {
        const amount = Number(price.amount) || 0
        console.log(`   ${index + 1}. Variant: ${price.variant_id}, Currency: ${price.currency_code}, Amount: $${amount / 100}`)
      })
    }
    
  } catch (error) {
    console.error("❌ Error configurando precios:", error)
  }
}
