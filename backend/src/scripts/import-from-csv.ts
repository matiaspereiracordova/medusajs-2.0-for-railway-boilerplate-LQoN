import { MedusaContainer } from "@medusajs/framework/types"
import { IProductModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import fs from 'fs'
import path from 'path'

interface CSVProduct {
  productHandle: string
  productTitle: string
  productDescription: string
  variantSku: string
  variantPriceEUR: number
  variantPriceUSD: number
  variantOption1Value: string
  productImage1Url?: string
  productImage2Url?: string
}

// Función para generar handle válido
const generateValidHandle = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

// Función para convertir precio EUR a CLP (aproximadamente 1 EUR = 1000 CLP)
const convertEURtoCLP = (eurPrice: number): number => {
  return Math.round(eurPrice * 1000) // Conversión aproximada
}

// Función para convertir precio USD a CLP (aproximadamente 1 USD = 900 CLP)
const convertUSDtoCLP = (usdPrice: number): number => {
  return Math.round(usdPrice * 900) // Conversión aproximada
}

// Función para parsear CSV
function parseCSV(csvContent: string): CSVProduct[] {
  const lines = csvContent.split('\n')
  const headers = lines[0].split(',')
  const products: CSVProduct[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(',')
    if (values.length < headers.length) continue

    const product: CSVProduct = {
      productHandle: values[1] || '',
      productTitle: values[2] || '',
      productDescription: values[4] || '',
      variantSku: values[21] || '',
      variantPriceEUR: parseFloat(values[33]) || 0,
      variantPriceUSD: parseFloat(values[34]) || 0,
      variantOption1Value: values[36] || '',
      productImage1Url: values[37] || undefined,
      productImage2Url: values[38] || undefined
    }

    if (product.productTitle && product.variantSku) {
      products.push(product)
    }
  }

  return products
}

export default async function importProductsFromCSV({
  container,
  csvFilePath
}: {
  container: MedusaContainer
  csvFilePath?: string
}) {
  console.log("📥 Iniciando importación de productos desde CSV...")

  try {
    // Determinar ruta del archivo CSV
    const defaultCSVPath = path.join(process.cwd(), 'product-import-template.csv')
    const csvPath = csvFilePath || defaultCSVPath

    // Verificar si el archivo existe
    if (!fs.existsSync(csvPath)) {
      console.log(`❌ Archivo CSV no encontrado: ${csvPath}`)
      console.log("💡 Coloca el archivo CSV en la raíz del proyecto o especifica la ruta completa")
      return
    }

    console.log(`📂 Leyendo archivo CSV: ${csvPath}`)
    
    // Leer archivo CSV
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const csvProducts = parseCSV(csvContent)

    if (csvProducts.length === 0) {
      console.log("❌ No se encontraron productos válidos en el CSV")
      return
    }

    console.log(`📦 Encontrados ${csvProducts.length} productos en el CSV`)

    // Resolver servicios
    const productModuleService: IProductModuleService = container.resolve(
      ModuleRegistrationName.PRODUCT
    )
    const regionModuleService: IRegionModuleService = container.resolve(
      ModuleRegistrationName.REGION
    )

    // Crear o obtener región de Chile
    console.log("🌍 Configurando región de Chile...")
    let chileRegion
    
    try {
      const regions = await regionModuleService.listRegions({
        currency_code: "clp"
      })
      chileRegion = regions?.[0]
      
      if (!chileRegion) {
        console.log("📝 Creando región de Chile...")
        chileRegion = await regionModuleService.createRegions({
          name: "Chile",
          currency_code: "clp",
          countries: ["cl"]
        })
        console.log("✅ Región de Chile creada exitosamente")
      } else {
        console.log("✅ Región de Chile ya existe")
      }
    } catch (regionError: any) {
      console.log("⚠️ Error configurando región:", regionError.message)
      console.log("🔄 Continuando con productos...")
    }

    console.log(`📦 Importando ${csvProducts.length} productos desde CSV...`)

    let createdCount = 0
    let errorCount = 0

    for (const csvProduct of csvProducts) {
      try {
        const handle = generateValidHandle(csvProduct.productHandle || csvProduct.productTitle)
        const sku = csvProduct.variantSku

        // Usar precio EUR si está disponible, sino USD
        const priceCLP = csvProduct.variantPriceEUR > 0 
          ? convertEURtoCLP(csvProduct.variantPriceEUR)
          : convertUSDtoCLP(csvProduct.variantPriceUSD)

        const product = {
          title: csvProduct.productTitle,
          handle: handle,
          description: csvProduct.productDescription,
          status: "published" as const,
          thumbnail: csvProduct.productImage1Url || csvProduct.productImage2Url || `https://via.placeholder.com/300x300.png?text=${encodeURIComponent(csvProduct.productTitle)}`,
          variants: [
            {
              title: csvProduct.productTitle,
              sku: sku,
              inventory_quantity: Math.floor(Math.random() * 100) + 50, // Stock aleatorio entre 50-150
              prices: [
                {
                  currency_code: "clp",
                  amount: priceCLP * 100 // Convertir a centavos
                }
              ]
            }
          ],
          // Agregar metadatos
          metadata: {
            imported_from: "csv",
            original_price_eur: csvProduct.variantPriceEUR,
            original_price_usd: csvProduct.variantPriceUSD,
            size: csvProduct.variantOption1Value,
            region: "chile",
            created_by: "csv_import_script"
          }
        }

        await productModuleService.createProducts(product)
        createdCount++
        console.log(`✅ Producto importado: ${csvProduct.productTitle} (SKU: ${sku}) - $${priceCLP.toLocaleString('es-CL')} CLP`)
        
      } catch (error: any) {
        errorCount++
        console.error(`❌ Error importando ${csvProduct.productTitle}:`, error.message)
      }
    }

    console.log(`🎉 Importación desde CSV completada:`)
    console.log(`   ✅ Productos creados: ${createdCount}`)
    console.log(`   ❌ Errores: ${errorCount}`)
    console.log(`   🇨🇱 Región: Chile (CLP)`)

  } catch (error) {
    console.error("❌ Error en importación desde CSV:", error)
    throw error
  }
}

// Función auxiliar para ejecutar desde línea de comandos
export async function runCSVImport(csvFilePath?: string) {
  // Esta función se puede usar para ejecutar la importación desde scripts externos
  console.log("🚀 Ejecutando importación CSV...")
  
  // Aquí necesitarías inicializar el container de Medusa
  // Esto es solo un ejemplo de cómo se podría usar
  console.log(`📂 Archivo CSV: ${csvFilePath || 'product-import-template.csv'}`)
}
