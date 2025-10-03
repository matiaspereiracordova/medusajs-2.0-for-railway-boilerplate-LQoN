import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"
import { IProductModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

type DebugPricesWorkflowInput = {
  productId?: string
  variantId?: string
}

type DebugPricesWorkflowOutput = {
  totalPrices: number
  prices: any[]
  productVariants: any[]
  variantPrices: any[]
}

// Step 1: Obtener todos los precios del sistema
const getAllPricesStep = createStep(
  "get-all-prices",
  async (input: DebugPricesWorkflowInput, { container }) => {
    try {
      console.log("🔍 Resolviendo servicio de precios...")
      const pricingModuleService: IPricingModuleService = container.resolve(
        ModuleRegistrationName.PRICING
      )

      const allPrices = await pricingModuleService.listPrices()
      console.log(`💰 Total de precios en el sistema: ${allPrices.length}`)

      // Mostrar estructura detallada de los primeros 3 precios
      console.log("🔍 Estructura detallada de precios:")
      allPrices.slice(0, 3).forEach((price, index) => {
        console.log(`\n--- Precio ${index + 1} ---`)
        console.log("ID:", price.id)
        console.log("Título:", price.title)
        console.log("Currency Code:", price.currency_code)
        console.log("Amount:", price.amount)
        console.log("Raw Amount:", (price as any).raw_amount)
        console.log("Price Set ID:", (price as any).price_set_id)
        console.log("Price Set:", (price as any).price_set)
        console.log("Price List ID:", (price as any).price_list_id)
        console.log("Price List:", (price as any).price_list)
        console.log("Min Quantity:", (price as any).min_quantity)
        console.log("Max Quantity:", (price as any).max_quantity)
        console.log("Rules Count:", (price as any).rules_count)
        console.log("Created At:", price.created_at)
        console.log("Updated At:", price.updated_at)
        console.log("Deleted At:", price.deleted_at)
      })

      return new StepResponse({ allPrices })
    } catch (error) {
      console.error("❌ Error obteniendo precios:", error)
      return new StepResponse({ allPrices: [] })
    }
  }
)

// Step 2: Obtener productos y sus variantes
const getProductsStep = createStep(
  "get-products",
  async (input: DebugPricesWorkflowInput, { container }) => {
    try {
      console.log("🔍 Resolviendo servicio de productos...")
      const productModuleService: IProductModuleService = container.resolve(
        ModuleRegistrationName.PRODUCT
      )

      const { productId, variantId } = input

      let products
      if (productId) {
        console.log(`🎯 Obteniendo producto específico: ${productId}`)
        products = [await productModuleService.retrieveProduct(productId, {
          relations: ["variants", "categories", "tags", "images"]
        })]
      } else {
        console.log("📦 Obteniendo todos los productos")
        products = await productModuleService.listProducts(
          {},
          {
            relations: ["variants", "categories", "tags", "images"],
            take: 10
          }
        )
      }

      console.log(`✅ Productos obtenidos: ${products?.length || 0}`)

      // Mostrar información detallada de cada producto y sus variantes
      products.forEach((product, productIndex) => {
        console.log(`\n--- Producto ${productIndex + 1}: ${product.title} ---`)
        console.log("ID:", product.id)
        console.log("Handle:", product.handle)
        console.log("Status:", product.status)
        console.log("Variants:", product.variants?.length || 0)
        
        if (product.variants) {
          product.variants.forEach((variant, variantIndex) => {
            console.log(`\n  --- Variant ${variantIndex + 1}: ${variant.title} ---`)
            console.log("  ID:", variant.id)
            console.log("  SKU:", variant.sku)
            console.log("  Title:", variant.title)
            console.log("  Calculated Price:", variant.calculated_price)
            console.log("  Prices Array:", variant.prices)
          })
        }
      })

      return new StepResponse({ products })
    } catch (error) {
      console.error("❌ Error obteniendo productos:", error)
      return new StepResponse({ products: [] })
    }
  }
)

// Step 3: Intentar mapear precios con variantes
const mapPricesToVariantsStep = createStep(
  "map-prices-to-variants",
  async (input: { allPrices: any[], products: any[] }, { container }) => {
    const { allPrices, products } = input

    console.log("\n🔍 Intentando mapear precios con variantes...")

    // Asegurar que products es un array
    const productsArray = Array.isArray(products) ? products : []
    
    // Crear un mapa de price_set_id a variant_id
    const priceSetToVariantMap = new Map()
    
    productsArray.forEach(product => {
      if (product.variants) {
        product.variants.forEach(variant => {
          // Buscar precios que tengan el mismo price_set_id
          const variantPrices = allPrices.filter(price => {
            const priceObj = price as any
            return priceObj.price_set_id === variant.id
          })
          
          if (variantPrices.length > 0) {
            priceSetToVariantMap.set(variant.id, variantPrices)
            console.log(`\n✅ Variant ${variant.id} (${variant.title}) tiene ${variantPrices.length} precios:`)
            variantPrices.forEach((price, index) => {
              const amount = Number(price.amount) || 0
              console.log(`  ${index + 1}. ${price.currency_code}: ${amount} centavos ($${amount / 100})`)
            })
          } else {
            console.log(`❌ Variant ${variant.id} (${variant.title}) no tiene precios asociados`)
          }
        })
      }
    })

    // Mostrar resumen
    console.log(`\n📊 Resumen de mapeo:`)
    console.log(`- Total de precios: ${allPrices.length}`)
    console.log(`- Total de productos: ${productsArray.length}`)
    console.log(`- Total de variantes: ${productsArray.reduce((acc, p) => acc + (p.variants?.length || 0), 0)}`)
    console.log(`- Variantes con precios: ${priceSetToVariantMap.size}`)

    return new StepResponse({ 
      priceSetToVariantMap: Array.from(priceSetToVariantMap.entries()),
      totalPrices: allPrices.length,
      totalVariants: productsArray.reduce((acc, p) => acc + (p.variants?.length || 0), 0),
      variantsWithPrices: priceSetToVariantMap.size
    })
  }
)

// Crear el workflow principal
const debugPricesWorkflow = createWorkflow(
  "debug-prices",
  function (input) {
    const { allPrices } = getAllPricesStep(input)
    const { products } = getProductsStep(input)
    const { priceSetToVariantMap, totalPrices, totalVariants, variantsWithPrices } = mapPricesToVariantsStep({ allPrices, products })

    // Asegurar que products es un array antes de usar flatMap
    const productsArray = Array.isArray(products) ? products : []
    
    return new WorkflowResponse({
      totalPrices,
      prices: allPrices,
      productVariants: productsArray.flatMap(p => p.variants || []),
      variantPrices: priceSetToVariantMap,
      variantsWithPrices
    })
  }
)

export default debugPricesWorkflow
