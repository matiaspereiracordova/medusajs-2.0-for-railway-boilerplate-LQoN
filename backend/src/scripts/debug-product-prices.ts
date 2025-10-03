import { ExecArgs } from "@medusajs/framework"
import { IProductModuleService, IPricingModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export default async function debugProductPrices({ container }: ExecArgs) {
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
    console.log("🔍 Debugging product prices...")
    
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
        relations: ["variants", "categories", "tags", "images"],
        take: 10
      }
    )
    
    console.log(`📦 Productos encontrados: ${products.length}`)
    
    // 3. Verificar precios de cada producto
    for (const product of products) {
      console.log(`\n🔍 Producto: ${product.title} (ID: ${product.id})`)
      console.log(`   Variants: ${product.variants?.length || 0}`)
      
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          console.log(`   📋 Variant: ${variant.title} (ID: ${variant.id})`)
          
          // Verificar calculated_price
          if (variant.calculated_price) {
            console.log(`   ✅ Calculated price: ${variant.calculated_price.calculated_amount} ${variant.calculated_price.currency_code}`)
          } else {
            console.log(`   ❌ No calculated_price`)
          }
          
          // Verificar precios en el módulo de precios
          const allPrices = await pricingModuleService.listPrices()
          const variantPrices = allPrices.filter((price: any) => {
            return price.variant_id === variant.id || 
                   (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
                   price.price_set_id === variant.id ||
                   (price.price_set && price.price_set.variant_id === variant.id)
          })
          
          console.log(`   💰 Precios en módulo: ${variantPrices.length}`)
          variantPrices.forEach((price: any, index: number) => {
            const amount = Number(price.amount) || 0
            console.log(`     ${index + 1}. ${price.currency_code}: ${amount} centavos ($${amount / 100})`)
          })
        }
      }
    }
    
    // 4. Verificar price lists
    const priceLists = await pricingModuleService.listPriceLists()
    console.log(`\n📋 Price Lists encontradas: ${priceLists.length}`)
    priceLists.forEach((priceList: any, index: number) => {
      console.log(`   ${index + 1}. ${priceList.name || priceList.id} (ID: ${priceList.id})`)
    })
    
    // 5. Verificar todos los precios disponibles
    const allPrices = await pricingModuleService.listPrices()
    console.log(`\n💰 Total de precios en el sistema: ${allPrices.length}`)
    
    if (allPrices.length > 0) {
      console.log("🔍 Primeros 5 precios:")
      allPrices.slice(0, 5).forEach((price: any, index: number) => {
        console.log(`   ${index + 1}. Variant: ${price.variant_id}, Currency: ${price.currency_code}, Amount: ${price.amount}`)
      })
    }
    
  } catch (error) {
    console.error("❌ Error debugging prices:", error)
  }
}
