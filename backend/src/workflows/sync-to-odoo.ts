import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"
import { IProductModuleService, IRegionModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import OdooModuleService, { OdooProduct } from "../modules/odoo/service.js"

// Función para convertir imagen URL a base64
async function convertImageToBase64(imageUrl: string): Promise<string | null> {
  try {
    if (!imageUrl) return null
    
    console.log(`🖼️ Descargando imagen: ${imageUrl}`)
    const response = await fetch(imageUrl)
    
    if (!response.ok) {
      console.warn(`⚠️ No se pudo descargar la imagen: ${imageUrl} (${response.status})`)
      return null
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    
    console.log(`✅ Imagen convertida a base64 (${base64.length} caracteres)`)
    return base64
  } catch (error) {
    console.error(`❌ Error convirtiendo imagen a base64:`, error)
    return null
  }
}

// Función para obtener precios usando el módulo de precios (enfoque correcto según documentación)
async function getVariantPricesFromPricingModule(pricingModuleService: IPricingModuleService, variantId: string) {
  try {
    console.log(`💰 Obteniendo precios desde módulo de precios para variant: ${variantId}`)
    
    // Obtener todos los precios
    const allPrices = await pricingModuleService.listPrices()
    
    // Debug: mostrar estructura de los primeros precios
    console.log(`🔍 Debug: Total de precios encontrados: ${allPrices.length}`)
    if (allPrices.length > 0) {
      console.log(`🔍 Debug: Estructura del primer precio:`, Object.keys(allPrices[0]))
      console.log(`🔍 Debug: Primer precio completo:`, allPrices[0])
    }
    
    // Filtrar precios por variant_id (usando diferentes posibles propiedades)
    const variantPrices = allPrices.filter(price => {
      const priceObj = price as any
      return priceObj.variant_id === variantId || 
             (Array.isArray(priceObj.variant_id) && priceObj.variant_id.includes(variantId)) ||
             priceObj.price_set_id === variantId ||
             (priceObj.price_set && priceObj.price_set.variant_id === variantId)
    })
    
    console.log(`💰 Precios encontrados para variant ${variantId}: ${variantPrices.length}`)
    variantPrices.forEach((price, index) => {
      const amount = Number(price.amount) || 0
      console.log(`  ${index + 1}. ${price.currency_code}: ${amount} centavos ($${amount / 100})`)
    })
    
    return variantPrices
  } catch (error) {
    console.error(`❌ Error obteniendo precios desde módulo de precios para variant ${variantId}:`, error)
    return []
  }
}

type SyncToOdooWorkflowInput = {
  productIds?: string[]
  limit?: number
  offset?: number
}

// Step 0: Obtener región por defecto
const getDefaultRegionStep = createStep(
  "get-default-region",
  async (input: SyncToOdooWorkflowInput, { container }) => {
    try {
      console.log("🌍 Resolviendo servicio de regiones...")
      const regionModuleService: IRegionModuleService = container.resolve(
        ModuleRegistrationName.REGION
      )

      // Buscar región de Chile (CLP)
      const regions = await regionModuleService.listRegions({
        currency_code: "clp"
      })

      const chileRegion = regions?.[0]
      console.log(`🌍 Región encontrada: ${chileRegion?.name || 'No encontrada'} (${chileRegion?.currency_code || 'N/A'})`)

      return new StepResponse({ region: chileRegion })
    } catch (error) {
      console.error("❌ Error obteniendo región:", error)
      return new StepResponse({ region: null })
    }
  }
)

type SyncToOdooWorkflowOutput = {
  syncedProducts: number
  createdProducts: number
  updatedProducts: number
  errorCount: number
  errors: Array<{
    product: string
    medusaId: string
    error: string
  }>
}

// Step 1: Obtener productos de Medusa
const getMedusaProductsStep = createStep(
  "get-medusa-products",
  async (input: { input: SyncToOdooWorkflowInput, region: any }, { container }) => {
    try {
      console.log("🔍 Resolviendo servicio de productos...")
      const productModuleService: IProductModuleService = container.resolve(
        ModuleRegistrationName.PRODUCT
      )

      const { input: workflowInput, region } = input
      console.log("📋 Parámetros de entrada:", workflowInput)
      console.log("🌍 Región para precios:", region?.name || 'No disponible')
      
      const { productIds, limit = 10, offset = 0 } = workflowInput

      let products
      if (productIds && productIds.length > 0) {
        console.log("🎯 Obteniendo productos específicos por IDs:", productIds)
        products = await Promise.all(
          productIds.map((id) =>
            productModuleService.retrieveProduct(id, {
              relations: ["variants", "categories", "tags", "images"],
              // Intentar incluir contexto de región para calculated_price
              ...(region && { region_id: region.id })
            })
          )
        )
      } else {
        console.log(`📦 Obteniendo productos (limit: ${limit}, offset: ${offset})`)
        products = await productModuleService.listProducts(
          {},
          {
            relations: ["variants", "categories", "tags", "images"],
            take: limit,
            skip: offset,
            // Intentar incluir contexto de región para calculated_price
            ...(region && { region_id: region.id })
          }
        )
      }

      console.log(`✅ Productos obtenidos: ${products?.length || 0}`)
      console.log("🔍 Primer producto:", products?.[0] ? {
        id: products[0].id,
        title: products[0].title,
        variants: products[0].variants?.length || 0,
        images: products[0].images?.length || 0,
        thumbnail: products[0].thumbnail ? 'Sí' : 'No',
        price: products[0].variants?.[0]?.prices?.[0]?.amount ? (products[0].variants[0].prices[0].amount / 100) : 'No disponible'
      } : "No hay productos")
      
      // Debug detallado del primer producto
      if (products?.[0]) {
        console.log("🔍 Debug detallado del primer producto:")
        console.log("  - Variants:", products[0].variants?.length || 0)
        if (products[0].variants?.[0]) {
          console.log("  - Primer variant:", {
            id: products[0].variants[0].id,
            title: products[0].variants[0].title,
            sku: products[0].variants[0].sku,
            prices: products[0].variants[0].prices?.length || 0
          })
          if (products[0].variants[0].prices?.length > 0) {
            console.log("  - Precios disponibles:")
            products[0].variants[0].prices.forEach((price, index) => {
              console.log(`    ${index + 1}. ${price.currency_code}: ${price.amount} centavos ($${price.amount / 100})`)
            })
          } else {
            console.log("  - ⚠️ No se encontraron precios en el variant")
          }
        }
      }

      return new StepResponse({ products })
    } catch (error) {
      console.error("❌ Error obteniendo productos de Medusa:", error)
      return new StepResponse({ products: [] })
    }
  }
)

// Step 2: Transformar productos de Medusa a formato ODOO
const transformProductsStep = createStep(
  "transform-products",
  async (input, { container }) => {
    const { products, region } = input as { products: any[], region: any }
    
    if (!products || !Array.isArray(products)) {
      console.error("❌ Error: products no es un array válido:", products)
      return new StepResponse({ transformedProducts: [] })
    }
    
    const odooModuleService: OdooModuleService = container.resolve("ODOO")
    const pricingModuleService: IPricingModuleService = container.resolve(
      ModuleRegistrationName.PRICING
    )

    const transformedProducts = []

    for (const product of products) {
      try {
        // Buscar si el producto ya existe en ODOO
        const existingOdooProducts = await odooModuleService.searchProductByExternalId(
          product.id
        )

        // Obtener el precio del primer variant disponible
        let productPrice = 0
        if (product.variants && product.variants.length > 0) {
          const firstVariant = product.variants[0]
          
          // Debug: mostrar estructura completa del variant
          console.log(`🔍 Debug variant para ${product.title}:`, {
            id: firstVariant.id,
            title: firstVariant.title,
            sku: firstVariant.sku,
            hasCalculatedPrice: !!firstVariant.calculated_price,
            calculatedPrice: firstVariant.calculated_price
          })
          
          // Intentar usar calculated_price primero (MedusaJS 2.0 approach)
          if (firstVariant.calculated_price?.calculated_amount) {
            productPrice = firstVariant.calculated_price.calculated_amount / 100
            console.log(`💰 Precio calculado encontrado: ${firstVariant.calculated_price.calculated_amount} centavos = $${productPrice}`)
          } else {
            // Usar el módulo de precios para obtener precios
            const variantPrices = await getVariantPricesFromPricingModule(pricingModuleService, firstVariant.id)
            
            if (variantPrices.length > 0) {
              // Buscar precio en CLP (Chilean Peso) primero, luego USD como fallback
              const clpPrice = variantPrices.find(price => price.currency_code === 'clp')
              const usdPrice = variantPrices.find(price => price.currency_code === 'usd')
              
              if (clpPrice) {
                const amount = Number(clpPrice.amount) || 0
                productPrice = amount / 100 // Convertir de centavos
                console.log(`💰 Precio CLP encontrado: ${amount} centavos = $${productPrice}`)
              } else if (usdPrice) {
                const amount = Number(usdPrice.amount) || 0
                productPrice = amount / 100 // Convertir de centavos
                console.log(`💰 Precio USD encontrado: ${amount} centavos = $${productPrice}`)
              } else {
                // Si no hay CLP ni USD, usar el primer precio disponible
                const amount = Number(variantPrices[0].amount) || 0
                productPrice = amount / 100
                console.log(`💰 Usando primer precio disponible: ${amount} centavos = $${productPrice}`)
              }
            } else {
              console.log(`⚠️ No se encontraron precios para variant ${firstVariant.id}`)
            }
          }
        }

        // Obtener la imagen principal del producto y convertirla a base64
        let productImageBase64 = null
        if (product.images && product.images.length > 0) {
          // Usar la primera imagen disponible
          productImageBase64 = await convertImageToBase64(product.images[0].url)
        } else if (product.thumbnail) {
          // Usar thumbnail si no hay imágenes
          productImageBase64 = await convertImageToBase64(product.thumbnail)
        }

        const odooProductData = {
          name: product.title,
          default_code: product.handle || `MEDUSA_${product.id}`,
          list_price: productPrice,
          x_medusa_id: product.id, // Campo personalizado para almacenar ID de Medusa
          description: product.description || "",
          active: product.status === "published",
          image_1920: productImageBase64, // Imagen principal del producto en base64
        }

        transformedProducts.push({
          medusaProduct: product,
          odooProductData,
          existsInOdoo: existingOdooProducts.length > 0,
          odooProductId: existingOdooProducts[0]?.id,
        })

        console.log(`📦 Producto transformado: ${product.title} - Precio: $${productPrice} - Imagen: ${productImageBase64 ? 'Sí (base64)' : 'No'}`)
        
        // Debug adicional para el precio
        if (productPrice === 0) {
          console.log(`⚠️ Precio es 0 para ${product.title}. Debug:`)
          console.log(`  - Variants: ${product.variants?.length || 0}`)
          if (product.variants?.[0]) {
            console.log(`  - Primer variant prices: ${product.variants[0].prices?.length || 0}`)
            if (product.variants[0].prices?.length > 0) {
              product.variants[0].prices.forEach((price, index) => {
                console.log(`    ${index + 1}. ${price.currency_code}: ${price.amount} centavos`)
              })
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error transformando producto ${product.title}:`, error)
      }
    }

    return new StepResponse({ transformedProducts })
  }
)

// Step 3: Sincronizar productos con ODOO
const syncProductsToOdooStep = createStep(
  "sync-products-to-odoo",
  async (input, { container }) => {
    const { transformedProducts } = input as { transformedProducts: any[] }
    
    if (!transformedProducts || !Array.isArray(transformedProducts)) {
      console.error("❌ Error: transformedProducts no es un array válido:", transformedProducts)
      return new StepResponse({
        createdCount: 0,
        updatedCount: 0,
        totalSynced: 0,
        errorCount: 1,
        errors: [{ product: "N/A", medusaId: "N/A", error: "No hay productos para sincronizar" }],
      })
    }
    const odooModuleService: OdooModuleService = container.resolve("ODOO")

    let createdCount = 0
    let updatedCount = 0
    let errorCount = 0
    const errors = []

    console.log(`🔄 Iniciando sincronización de ${transformedProducts.length} productos con ODOO...`)

    for (const { medusaProduct, odooProductData, existsInOdoo, odooProductId } of transformedProducts) {
      try {
        console.log(`📤 Procesando: ${odooProductData.name}`)
        
        if (existsInOdoo && odooProductId) {
          // Actualizar producto existente
          console.log(`🔄 Actualizando producto existente en ODOO: ${odooProductData.name} (ID: ${odooProductId})`)
          await odooModuleService.updateProduct(odooProductId, odooProductData)
          updatedCount++
          console.log(`✅ Producto actualizado en ODOO: ${odooProductData.name}`)
        } else {
          // Crear nuevo producto
          console.log(`➕ Creando nuevo producto en ODOO: ${odooProductData.name}`)
          const newOdooProductId = await odooModuleService.createProduct(odooProductData)
          createdCount++
          console.log(`✅ Producto creado en ODOO: ${odooProductData.name} (ID: ${newOdooProductId})`)
        }
      } catch (error: any) {
        errorCount++
        const errorMsg = `Error sincronizando producto ${odooProductData.name}: ${error.message || error}`
        console.error(`❌ ${errorMsg}`)
        errors.push({
          product: odooProductData.name,
          medusaId: medusaProduct.id,
          error: error.message || error
        })
      }
    }

    console.log(`📊 Resumen de sincronización:`)
    console.log(`   ✅ Productos creados: ${createdCount}`)
    console.log(`   🔄 Productos actualizados: ${updatedCount}`)
    console.log(`   ❌ Errores: ${errorCount}`)
    
    if (errors.length > 0) {
      console.log(`❌ Productos con errores:`)
      errors.forEach(err => {
        console.log(`   - ${err.product} (${err.medusaId}): ${err.error}`)
      })
    }

    return new StepResponse({
      createdCount,
      updatedCount,
      totalSynced: createdCount + updatedCount,
      errorCount,
      errors,
    })
  }
)

// Crear el workflow principal
const syncToOdooWorkflow = createWorkflow(
  "sync-to-odoo",
  function (input) {
    const { region } = getDefaultRegionStep(input)
    // @ts-ignore - MedusaJS workflow steps require input
    const { products } = getMedusaProductsStep({ input, region })
    // @ts-ignore - MedusaJS workflow steps require input
    const { transformedProducts } = transformProductsStep({ products, region })
    // @ts-ignore - MedusaJS workflow steps require input
    const { createdCount, updatedCount, totalSynced, errorCount, errors } = syncProductsToOdooStep({ transformedProducts })

    return new WorkflowResponse({
      syncedProducts: totalSynced,
      createdProducts: createdCount,
      updatedProducts: updatedCount,
      errorCount,
      errors,
    })
  }
)

export default syncToOdooWorkflow
