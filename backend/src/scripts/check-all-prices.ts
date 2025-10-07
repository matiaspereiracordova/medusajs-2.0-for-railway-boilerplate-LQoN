import { MedusaContainer } from "@medusajs/framework/types"
import { IProductModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

/**
 * Script para verificar todos los productos y sus precios
 * Ejecutar con: npx medusa exec ./src/scripts/check-all-prices.ts
 */
export default async function checkAllPrices(container: MedusaContainer) {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  🔍 DIAGNÓSTICO COMPLETO DE PRECIOS - MEDUSAJS           ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  const productModuleService: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  )
  const pricingModuleService: IPricingModuleService = container.resolve(
    ModuleRegistrationName.PRICING
  )

  try {
    // Obtener todos los productos
    console.log('📦 Obteniendo productos...')
    const products = await productModuleService.listProducts(
      {},
      {
        relations: ["variants"],
        take: 100,
      }
    )
    console.log(`✅ Productos encontrados: ${products.length}\n`)

    // Obtener todos los precios
    console.log('💰 Obteniendo precios...')
    const allPrices = await pricingModuleService.listPrices()
    console.log(`✅ Total de precios en el sistema: ${allPrices.length}\n`)

    console.log('═'.repeat(80))
    console.log('📊 ANÁLISIS POR PRODUCTO')
    console.log('═'.repeat(80) + '\n')

    let productsOK = 0
    let productsWithIssues = 0
    const issuesList = []

    for (const product of products) {
      let hasIssues = false
      const variantDetails = []

      for (const variant of product.variants || []) {
        // Buscar precios de esta variante
        const variantPrices = allPrices.filter((price: any) => {
          return price.variant_id === variant.id || 
                 (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
                 price.price_set_id === variant.id ||
                 (price.price_set && price.price_set.variant_id === variant.id)
        })

        const hasPrices = variantPrices.length > 0
        if (!hasPrices) hasIssues = true

        const priceInfo = variantPrices.map((p: any) => {
          const amount = p.amount ? Number(p.amount) / 100 : 0
          return `${p.currency_code?.toUpperCase()}: $${amount.toLocaleString('es-CL')}`
        }).join(', ') || '❌ SIN PRECIOS'

        variantDetails.push({
          title: variant.title || 'Sin título',
          sku: variant.sku || 'Sin SKU',
          hasPrices,
          priceInfo
        })
      }

      if (hasIssues) {
        productsWithIssues++
        issuesList.push({ product, variantDetails })
        
        console.log(`⚠️  PROBLEMA DETECTADO`)
        console.log(`─────────────────────────────────────────────────────────`)
        console.log(`Producto: ${product.title}`)
        console.log(`ID: ${product.id}`)
        console.log(`Status: ${product.status}`)
        console.log(`Total variantes: ${product.variants?.length || 0}`)
        console.log('\nVariantes:')
        variantDetails.forEach((v, i) => {
          const icon = v.hasPrices ? '✅' : '❌'
          console.log(`  ${icon} ${i + 1}. ${v.title} (SKU: ${v.sku})`)
          console.log(`     Precios: ${v.priceInfo}`)
        })
        console.log('\n')
      } else {
        productsOK++
      }
    }

    // Resumen final
    console.log('═'.repeat(80))
    console.log('📈 RESUMEN GENERAL')
    console.log('═'.repeat(80))
    console.log(`Total de productos: ${products.length}`)
    console.log(`✅ Productos OK (con precios): ${productsOK}`)
    console.log(`⚠️  Productos con problemas: ${productsWithIssues}`)
    console.log(`💰 Total precios en sistema: ${allPrices.length}`)
    console.log('═'.repeat(80) + '\n')

    if (productsWithIssues > 0) {
      console.log('🔧 ACCIÓN REQUERIDA:')
      console.log('─'.repeat(80))
      console.log('Los siguientes productos necesitan que agregues precios:')
      console.log('')
      issuesList.forEach(({ product }) => {
        console.log(`  • ${product.title}`)
        console.log(`    URL: https://backend-production-6f9f.up.railway.app/app/products/${product.id}`)
      })
      console.log('\n📝 PASOS:')
      console.log('  1. Abre cada URL arriba')
      console.log('  2. Edita cada variante')
      console.log('  3. Agrega precio en CLP')
      console.log('  4. Guarda')
      console.log('  5. La sincronización con Odoo será automática\n')
    } else {
      console.log('🎉 ¡EXCELENTE! Todos los productos tienen precios configurados.')
      console.log('   Puedes ejecutar la sincronización con Odoo.\n')
    }

    console.log('╔═══════════════════════════════════════════════════════════╗')
    console.log('║  ✅ DIAGNÓSTICO COMPLETADO                                ║')
    console.log('╚═══════════════════════════════════════════════════════════╝')

  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error)
    throw error
  }
}

