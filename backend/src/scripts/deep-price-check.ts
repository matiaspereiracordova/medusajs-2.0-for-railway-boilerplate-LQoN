import { MedusaContainer } from "@medusajs/framework/types"
import { IProductModuleService, IPricingModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

/**
 * Script para hacer una búsqueda profunda de precios
 * Revisar TODAS las estructuras posibles donde pueden estar los precios
 */
export default async function deepPriceCheck(container: MedusaContainer) {
  console.log('🔍 BÚSQUEDA PROFUNDA DE PRECIOS EN MEDUSAJS 2.0\n')
  console.log('═'.repeat(80) + '\n')

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
    // Obtener regiones
    console.log('🌍 Regiones configuradas:')
    const regions = await regionModuleService.listRegions()
    regions.forEach(r => {
      console.log(`  - ${r.name} (${r.currency_code?.toUpperCase()})`)
    })
    console.log('')

    // Obtener un producto como ejemplo
    const products = await productModuleService.listProducts(
      {},
      {
        relations: ["variants"],
        take: 1,
      }
    )

    if (products.length === 0) {
      console.log('❌ No hay productos en el sistema')
      return
    }

    const product = products[0]
    console.log(`📦 Analizando producto: "${product.title}"`)
    console.log(`   ID: ${product.id}`)
    console.log(`   Handle: ${product.handle}`)
    console.log(`   Status: ${product.status}\n`)

    // Obtener TODOS los precios del sistema
    console.log('💰 Obteniendo TODOS los precios del sistema...')
    const allPrices = await pricingModuleService.listPrices()
    console.log(`   Total: ${allPrices.length} precios encontrados\n`)

    // Analizar estructura de precios
    if (allPrices.length > 0) {
      console.log('📊 Estructura de un precio (ejemplo):')
      const samplePrice = allPrices[0]
      console.log(JSON.stringify(samplePrice, null, 2))
      console.log('')
    }

    // Analizar cada variante del producto
    console.log('🔍 Analizando variantes del producto:\n')
    for (const variant of product.variants || []) {
      console.log(`Variante: ${variant.title}`)
      console.log(`  ID: ${variant.id}`)
      console.log(`  SKU: ${variant.sku}`)
      console.log(`  Estructura completa:`)
      console.log(JSON.stringify(variant, null, 2))
      console.log('')

      // Intentar diferentes formas de buscar precios
      console.log('  🔎 Buscando precios por diferentes métodos:')
      
      // Método 1: Por variant_id directo
      const method1 = allPrices.filter((p: any) => p.variant_id === variant.id)
      console.log(`    Método 1 (variant_id directo): ${method1.length} precios`)
      
      // Método 2: Por array de variant_id
      const method2 = allPrices.filter((p: any) => 
        Array.isArray(p.variant_id) && p.variant_id.includes(variant.id)
      )
      console.log(`    Método 2 (array variant_id): ${method2.length} precios`)
      
      // Método 3: Por price_set_id
      const method3 = allPrices.filter((p: any) => p.price_set_id === variant.id)
      console.log(`    Método 3 (price_set_id): ${method3.length} precios`)
      
      // Método 4: Por price_set.variant_id
      const method4 = allPrices.filter((p: any) => 
        p.price_set && p.price_set.variant_id === variant.id
      )
      console.log(`    Método 4 (price_set.variant_id): ${method4.length} precios`)

      // Método 5: Buscar por calculated_price si existe
      if ((variant as any).calculated_price) {
        console.log(`    ✅ Calculated price encontrado:`)
        console.log(`       ${JSON.stringify((variant as any).calculated_price, null, 2)}`)
      }

      // Método 6: Buscar en variant.prices si existe
      if ((variant as any).prices) {
        console.log(`    ✅ Variant.prices encontrado:`)
        console.log(`       ${JSON.stringify((variant as any).prices, null, 2)}`)
      }

      console.log('')
    }

    // Intentar usar el pricing module directamente
    console.log('💡 Intentando obtener precios con PricingModule:')
    try {
      for (const variant of product.variants || []) {
        // Método alternativo: usar listPriceSets
        const priceSets = await pricingModuleService.listPriceSets({
          id: [variant.id]
        })
        console.log(`  Variante ${variant.title}: ${priceSets.length} price sets`)
        if (priceSets.length > 0) {
          console.log('    Estructura:')
          console.log(JSON.stringify(priceSets[0], null, 2))
        }
      }
    } catch (error: any) {
      console.log(`  ⚠️ Error: ${error.message}`)
    }

    console.log('\n' + '═'.repeat(80))
    console.log('✅ ANÁLISIS COMPLETADO')
    console.log('═'.repeat(80))

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

