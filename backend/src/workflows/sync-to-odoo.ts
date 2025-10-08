import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"
import { IRegionModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import OdooModuleService from "../modules/odoo/service.js"
import { checkProductExists, updateExistingProduct } from "../utils/duplicate-detector"

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

// Función mejorada para obtener precios desde price_set (método exitoso del endpoint)
async function getProductPriceFromPriceSet(
  variant: any,
  currencyCode: string = 'clp'
): Promise<number> {
  try {
    // Buscar precio en el price_set de la variante (mismo método del endpoint exitoso)
    if (variant.price_set && variant.price_set.prices) {
      const pricesForCurrency = variant.price_set.prices.filter(
        (p: any) => p.currency_code?.toLowerCase() === currencyCode
      )
      
      if (pricesForCurrency.length > 0 && pricesForCurrency[0].amount) {
        // Los precios ya vienen en la unidad correcta (no en centavos)
        const price = Number(pricesForCurrency[0].amount)
        console.log(`💰 Precio encontrado para variant (${currencyCode.toUpperCase()}): $${price}`)
        return price
      }
    }
    
    console.log(`⚠️ No se encontró precio para variant en moneda ${currencyCode}`)
    return 0
  } catch (error) {
    console.error(`❌ Error obteniendo precio para variant:`, error)
    return 0
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
        Modules.REGION
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

// Step 1: Obtener productos de Medusa CON PRECIOS (método mejorado usando query.graph)
const getMedusaProductsStep = createStep(
  "get-medusa-products",
  async (input: { input: SyncToOdooWorkflowInput, region: any }, { container }) => {
    try {
      console.log("🔍 Obteniendo productos con precios usando query.graph...")
      const query = container.resolve(ContainerRegistrationKeys.QUERY)

      const { input: workflowInput, region } = input
      console.log("📋 Parámetros de entrada:", workflowInput)
      console.log("🌍 Región para precios:", region?.name || 'No disponible')
      
      const { productIds, limit = 10, offset = 0 } = workflowInput

      let products
      
      // Usar query.graph para obtener productos con price_set (método exitoso del endpoint)
      const filters: any = {}
      
      if (productIds && productIds.length > 0) {
        filters.id = productIds
        console.log("🎯 Obteniendo productos específicos por IDs:", productIds)
      }

      const productsResult = await query.graph({
        entity: "product",
        fields: [
          "id",
          "title",
          "handle",
          "description",
          "status",
          "thumbnail",
          "variants.id",
          "variants.title",
          "variants.sku",
          "variants.options",
          "variants.calculated_price",
          "variants.price_set.id",
          "variants.price_set.prices.*",
          "categories.*",
          "tags.*",
          "images.*"
        ],
        filters,
        pagination: {
          take: limit,
          skip: offset
        }
      })

      products = productsResult.data || []

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
    const currencyCode = region?.currency_code?.toLowerCase() || 'clp'

    const transformedProducts = []

    for (const product of products) {
      try {
        // Buscar si el producto ya existe en ODOO
        const existingOdooProducts = await odooModuleService.searchProductByExternalId(
          product.id
        )

        // Obtener el precio del primer variant usando el método mejorado (price_set)
        let productPrice = 0
        if (product.variants && product.variants.length > 0) {
          const firstVariant = product.variants[0]
          
          console.log(`🔍 Procesando variant para ${product.title}:`, {
            id: firstVariant.id,
            title: firstVariant.title,
            sku: firstVariant.sku,
            hasPriceSet: !!firstVariant.price_set,
            pricesCount: firstVariant.price_set?.prices?.length || 0
          })
          
          // Usar el método exitoso del endpoint para obtener precios
          productPrice = await getProductPriceFromPriceSet(firstVariant, currencyCode)
          
          if (productPrice === 0) {
            console.log(`⚠️ Precio es 0 para ${product.title}, intentando con calculated_price`)
            // Fallback: intentar usar calculated_price si está disponible
            if (firstVariant.calculated_price?.calculated_amount) {
              productPrice = firstVariant.calculated_price.calculated_amount / 100
              console.log(`💰 Precio calculado encontrado: $${productPrice}`)
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
          active: product.status === "published", // Solo productos published serán activos en Odoo
          image_1920: productImageBase64, // Imagen principal del producto en base64
        }

        // Preparar datos de variantes con precios y opciones para sincronización posterior
        const variantData = product.variants?.map(variant => ({
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          prices: variant.prices || [],
          options: variant.options || [] // Incluir opciones de la variante
        })) || []

        // Debug: mostrar opciones de variantes
        if (variantData.length > 0 && variantData[0].options?.length > 0) {
          console.log(`🔍 Opciones de variantes encontradas para ${product.title}:`)
          variantData.forEach((v, idx) => {
            console.log(`  Variante ${idx + 1} (${v.title || v.sku}):`, v.options.map((o: any) => `${o.title}: ${o.value}`).join(', '))
          })
        }

        transformedProducts.push({
          medusaProduct: product,
          odooProductData,
          variantData,
          existsInOdoo: existingOdooProducts.length > 0,
          odooProductId: existingOdooProducts[0]?.id,
        })

        console.log(`📦 Producto transformado: ${product.title} - Precio: $${productPrice} - Imagen: ${productImageBase64 ? `Sí (${productImageBase64.length} caracteres base64)` : 'No'}`)
      } catch (error) {
        console.error(`❌ Error transformando producto ${product.title}:`, error)
      }
    }

    return new StepResponse({ transformedProducts })
  }
)

// Step 3: Sincronizar productos con ODOO (con lógica anti-duplicados)
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
    let skippedCount = 0
    let errorCount = 0
    const errors = []

    console.log(`🔄 Iniciando sincronización inteligente de ${transformedProducts.length} productos con ODOO...`)

    for (const { medusaProduct, odooProductData, variantData, existsInOdoo, odooProductId } of transformedProducts) {
      try {
        console.log(`📤 Procesando: ${odooProductData.name}`)
        
        // Verificar si el producto ya existe usando la lógica anti-duplicados
        const { exists, existingProduct, isDuplicate } = await checkProductExists(
          odooProductData.name,
          odooProductData.x_medusa_id
        )

        let finalOdooProductId: number | null = null

        if (exists && existingProduct) {
          if (isDuplicate) {
            console.log(`⚠️ Duplicado detectado para ${odooProductData.name}, actualizando en lugar de crear`)
            
            // Actualizar el producto existente con los datos más recientes
            const updateSuccess = await updateExistingProduct(existingProduct.id, {
              name: odooProductData.name,
              list_price: odooProductData.list_price,
              default_code: odooProductData.default_code,
              x_medusa_id: odooProductData.x_medusa_id,
              description: odooProductData.description,
              active: odooProductData.active,
              image_1920: odooProductData.image_1920
            })
            
            if (updateSuccess) {
              updatedCount++
              finalOdooProductId = existingProduct.id
              console.log(`✅ Producto duplicado actualizado: ${odooProductData.name} (ID: ${existingProduct.id})`)
            } else {
              errorCount++
              errors.push({
                product: odooProductData.name,
                medusaId: medusaProduct.id,
                error: "Error actualizando producto duplicado"
              })
            }
          } else {
            // Producto existe pero no es duplicado problemático, actualizar normalmente
            console.log(`🔄 Actualizando producto existente: ${odooProductData.name} (ID: ${existingProduct.id})`)
            await odooModuleService.updateProduct(existingProduct.id, odooProductData)
            updatedCount++
            finalOdooProductId = existingProduct.id
            console.log(`✅ Producto actualizado: ${odooProductData.name}`)
          }
        } else if (existsInOdoo && odooProductId) {
          // Lógica original para productos que ya existían
          console.log(`🔄 Actualizando producto existente en ODOO: ${odooProductData.name} (ID: ${odooProductId})`)
          await odooModuleService.updateProduct(odooProductId, odooProductData)
          updatedCount++
          finalOdooProductId = odooProductId
          console.log(`✅ Producto actualizado en ODOO: ${odooProductData.name}`)
        } else {
          // Crear nuevo producto solo si no existe
          console.log(`➕ Creando nuevo producto en ODOO: ${odooProductData.name}`)
          const newOdooProductId = await odooModuleService.createProduct(odooProductData)
          createdCount++
          finalOdooProductId = newOdooProductId
          console.log(`✅ Producto creado en ODOO: ${odooProductData.name} (ID: ${newOdooProductId})`)
        }

        // Sincronizar variantes si el producto fue creado/actualizado exitosamente
        if (finalOdooProductId && variantData && variantData.length > 0) {
          console.log(`🔄 Sincronizando ${variantData.length} variante(s) para ${odooProductData.name}...`)
          try {
            // Sincronizar atributos y valores de variantes
            await odooModuleService.syncProductVariants(finalOdooProductId, variantData)
            console.log(`✅ Variantes sincronizadas para ${odooProductData.name}`)
            
            // Sincronizar precios de variantes
            console.log(`💰 Sincronizando precios de variantes para ${odooProductData.name}...`)
            await odooModuleService.syncVariantPrices(finalOdooProductId, variantData)
            console.log(`✅ Precios de variantes sincronizados para ${odooProductData.name}`)
          } catch (variantError: any) {
            console.error(`⚠️ Error sincronizando variantes para ${odooProductData.name}:`, variantError.message)
            // No incrementar errorCount porque el producto principal se sincronizó correctamente
          }
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

    console.log(`📊 Resumen de sincronización inteligente:`)
    console.log(`   ✅ Productos creados: ${createdCount}`)
    console.log(`   🔄 Productos actualizados: ${updatedCount}`)
    console.log(`   ⏭️ Productos omitidos: ${skippedCount}`)
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
