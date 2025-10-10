import { MedusaContainer } from "@medusajs/framework/types"
import { IProductModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

interface ProductData {
  title: string
  handle: string
  description: string
  sku: string
  category: string
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

// Función para generar SKU
const generateSku = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20)
    .toUpperCase()
}

// Datos de productos basados en la imagen de categorías de perros
const dogProducts: ProductData[] = [
  // COMIDA (FOOD)
  { title: "Comida Seca para Perros", handle: "comida-seca-perros", description: "Alimento balanceado seco para perros de todas las edades", sku: "COMIDASECA", category: "Comida" },
  { title: "Comida Húmeda para Perros", handle: "comida-humeda-perros", description: "Alimento húmedo enlatado para perros", sku: "COMIDAHUMEDA", category: "Comida" },
  { title: "Comida Medicada para Perros", handle: "comida-medicada-perros", description: "Alimento especial con medicamentos para perros", sku: "COMIDAMEDICADA", category: "Comida" },
  { title: "Dietas Especiales para Perros", handle: "dietas-especiales-perros", description: "Dietas especiales para perros con necesidades específicas", sku: "DIETASESpeciales", category: "Comida" },

  // SNACKS Y PREMIOS
  { title: "Huesos Naturales para Perros", handle: "huesos-naturales-perros", description: "Huesos naturales para masticar", sku: "HUESOSNATURALES", category: "Snacks y Premios" },
  { title: "Bully Sticks para Perros", handle: "bully-sticks-perros", description: "Bully sticks naturales para perros", sku: "BULLYSTICKS", category: "Snacks y Premios" },
  { title: "Carne Natural para Perros", handle: "carne-natural-perros", description: "Snacks de carne natural para perros", sku: "CARNENATURAL", category: "Snacks y Premios" },
  { title: "Congelados en Seco para Perros", handle: "congelados-seco-perros", description: "Snacks congelados en seco para perros", sku: "CONGELADOSSECO", category: "Snacks y Premios" },
  { title: "Snacks Blandos y Masticables", handle: "snacks-blandos-masticables", description: "Snacks blandos y masticables para perros", sku: "SNACKSBLANDOS", category: "Snacks y Premios" },
  { title: "Galletas para Perros", handle: "galletas-perros", description: "Galletas nutritivas para perros", sku: "GALLETAS", category: "Snacks y Premios" },
  { title: "Snacks de Larga Duración", handle: "snacks-larga-duracion", description: "Snacks de larga duración para perros", sku: "LARGADURACION", category: "Snacks y Premios" },
  { title: "Snacks para Higiene Dental", handle: "snacks-higiene-dental", description: "Snacks especiales para higiene dental", sku: "HIGIENEDENTAL", category: "Snacks y Premios" },

  // JUGUETES
  { title: "Juguetes para Morder y Tirar", handle: "juguetes-morder-tirar", description: "Juguetes resistentes para morder y tirar", sku: "MORDERTIRAR", category: "Juguetes" },
  { title: "Peluches para Perros", handle: "peluches-perros", description: "Peluches suaves para perros", sku: "PELUCHES", category: "Juguetes" },
  { title: "Juguetes para Recuperar", handle: "juguetes-recuperar", description: "Juguetes para juegos de recuperación", sku: "RECUPERAR", category: "Juguetes" },
  { title: "Dispensadores de Premios", handle: "dispensadores-premios", description: "Juguetes dispensadores de premios", sku: "DISPENSADORES", category: "Juguetes" },
  { title: "Juguetes Rompecabezas", handle: "juguetes-rompecabezas", description: "Juguetes rompecabezas para estimular la mente", sku: "ROMPECABEZAS", category: "Juguetes" },

  // ACCESORIOS
  { title: "Camas para Perros", handle: "camas-perros", description: "Camas cómodas para perros", sku: "CAMAS", category: "Accesorios" },
  { title: "Platos y Bowls para Perros", handle: "platos-bowls-perros", description: "Platos y bowls para comida y agua", sku: "PLATOSBOWLS", category: "Accesorios" },
  { title: "Correas para Perros", handle: "correas-perros", description: "Correas de paseo para perros", sku: "CORREAS", category: "Accesorios" },
  { title: "Collares y Arneses", handle: "collares-arneses", description: "Collares y arneses para perros", sku: "COLLARESARNESES", category: "Accesorios" },
  { title: "Accesorios de Adiestramiento", handle: "accesorios-adiestramiento", description: "Accesorios para adiestramiento canino", sku: "ADIESTRAMIENTO", category: "Accesorios" },
  { title: "Recintos, Jaulas y Transporte", handle: "recintos-jaulas-transporte", description: "Recintos, jaulas y transportadores", sku: "RECINTOSJAULAS", category: "Accesorios" },

  // HIGIENE Y BAÑO
  { title: "Toallitas de Limpieza", handle: "toallitas-limpieza", description: "Toallitas húmedas para limpieza", sku: "TOALLITAS", category: "Higiene y Baño" },
  { title: "Pads de Entrenamiento", handle: "pads-entrenamiento", description: "Pads absorbentes para entrenamiento", sku: "PADSENTRENAMIENTO", category: "Higiene y Baño" },
  { title: "Bolsas para Desechos", handle: "bolsas-desechos", description: "Bolsas para recoger desechos", sku: "BOLSASDESECHOS", category: "Higiene y Baño" },
  { title: "Pañales para Perros", handle: "panales-perros", description: "Pañales desechables para perros", sku: "PANALES", category: "Higiene y Baño" },

  // PELUQUERÍA
  { title: "Cepillos para Perros", handle: "cepillos-perros", description: "Cepillos para el cuidado del pelaje", sku: "CEPILLOS", category: "Peluquería" },
  { title: "Shampoos y Acondicionadores", handle: "shampoos-acondicionadores", description: "Shampoos y acondicionadores para perros", sku: "SHAMPOOSACOND", category: "Peluquería" },
  { title: "Corta Uñas y Herramientas", handle: "corta-unas-herramientas", description: "Herramientas para cortar uñas", sku: "CORTAUNAS", category: "Peluquería" },
  { title: "Productos Skin Care", handle: "productos-skin-care", description: "Productos para cuidado de la piel", sku: "SKINCARE", category: "Peluquería" },

  // FARMACIA
  { title: "Tratamiento Pulgas y Garrapatas", handle: "pulgas-garrapatas", description: "Productos para control de pulgas y garrapatas", sku: "PULGASGARRAPATAS", category: "Farmacia" },
  { title: "Vitaminas y Suplementos", handle: "vitaminas-suplementos", description: "Vitaminas y suplementos nutricionales", sku: "VITAMINASSUPLEMENTOS", category: "Farmacia" },
  { title: "Productos para Alergias", handle: "productos-alergias", description: "Productos para alergias y picazón", sku: "ALERGIAS", category: "Farmacia" },
  { title: "Control de Temperatura", handle: "control-temperatura", description: "Productos para control de temperatura", sku: "CONTROLTEMP", category: "Farmacia" },
  { title: "Medicamentos para Perros", handle: "medicamentos-perros", description: "Medicamentos veterinarios para perros", sku: "MEDICAMENTOS", category: "Farmacia" }
]

export default async function createDogProducts({
  container
}: {
  container: MedusaContainer
}) {
  console.log("🐕 Iniciando creación de productos para perros...")

  try {
    // Resolver servicios
    const productModuleService: IProductModuleService = container.resolve(
      ModuleRegistrationName.PRODUCT
    )
    const regionModuleService: IRegionModuleService = container.resolve(
      ModuleRegistrationName.REGION
    )

    // Obtener región por defecto (CLP)
    const regions = await regionModuleService.listRegions({
      currency_code: "clp"
    })
    const chileRegion = regions?.[0]

    if (!chileRegion) {
      console.log("⚠️ No se encontró región CLP, saltando creación de productos")
      return
    }

    // Verificar si ya existen productos de perros
    const existingProducts = await productModuleService.listProducts({
      handle: dogProducts.map(p => generateValidHandle(p.title))
    })

    if (existingProducts.length > 0) {
      console.log(`ℹ️ Ya existen ${existingProducts.length} productos de perros, saltando creación`)
      return
    }

    console.log(`📦 Creando ${dogProducts.length} productos para perros...`)

    let createdCount = 0

    for (const productData of dogProducts) {
      try {
        const handle = generateValidHandle(productData.title)
        const sku = generateSku(productData.sku)

        const product = {
          title: productData.title,
          handle: handle,
          description: productData.description,
          status: "published" as const,
          thumbnail: "https://via.placeholder.com/300x300.png?text=Perro+Product", // Imagen por defecto
          variants: [
            {
              title: productData.title,
              sku: sku,
              inventory_quantity: 100, // Stock de 100 por producto
              prices: [
                {
                  currency_code: "clp",
                  amount: 10000 // Precio base de $100.00 CLP (en centavos)
                }
              ]
            }
          ]
        }

        await productModuleService.createProducts(product)
        createdCount++
        console.log(`✅ Producto creado: ${productData.title} (SKU: ${sku})`)
        
      } catch (error: any) {
        console.error(`❌ Error creando ${productData.title}:`, error.message)
      }
    }

    console.log(`🎉 Creación de productos completada: ${createdCount} productos creados`)

  } catch (error) {
    console.error("❌ Error en creación de productos:", error)
  }
}
