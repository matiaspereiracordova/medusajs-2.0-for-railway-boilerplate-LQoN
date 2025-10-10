import { MedusaContainer } from "@medusajs/framework/types"
import { IProductModuleService, IRegionModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import fs from 'fs'
import path from 'path'
import importProductsFromCSV from './import-from-csv'

interface ProductData {
  title: string
  handle: string
  description: string
  sku: string
  category: string
  subcategory?: string
  price: number
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

// Función para generar SKU derivado del nombre del producto
const generateSku = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15)
    .toUpperCase()
}

// Datos de productos basados en la imagen de categorías de perros para Chile
const chileanDogProducts: ProductData[] = [
  // COMIDA (FOOD)
  { title: "Comida Seca Premium para Perros", handle: "comida-seca-premium-perros", description: "Alimento balanceado seco premium para perros de todas las edades. Formulado con ingredientes naturales.", sku: "COMIDASECAPRE", category: "Comida", subcategory: "Comida Seca", price: 25000 },
  { title: "Comida Seca Adultos para Perros", handle: "comida-seca-adultos-perros", description: "Alimento seco especialmente formulado para perros adultos con necesidades nutricionales específicas.", sku: "COMIDASECAADU", category: "Comida", subcategory: "Comida Seca", price: 18000 },
  { title: "Comida Seca Cachorros para Perros", handle: "comida-seca-cachorros-perros", description: "Alimento seco rico en nutrientes para cachorros en crecimiento.", sku: "COMIDASECACACH", category: "Comida", subcategory: "Comida Seca", price: 22000 },
  { title: "Comida Húmeda en Lata para Perros", handle: "comida-humeda-lata-perros", description: "Alimento húmedo enlatado con carne real para perros.", sku: "COMIDAHUMEDALA", category: "Comida", subcategory: "Comida Húmeda", price: 3500 },
  { title: "Comida Húmeda Sobres para Perros", handle: "comida-humeda-sobres-perros", description: "Alimento húmedo en sobres individuales para perros.", sku: "COMIDAHUMEDASO", category: "Comida", subcategory: "Comida Húmeda", price: 2800 },
  { title: "Comida Medicada para Perros", handle: "comida-medicada-perros", description: "Alimento especial con medicamentos prescritos por veterinario.", sku: "COMIDAMEDICADA", category: "Comida", subcategory: "Comida Medicada", price: 45000 },
  { title: "Dieta Especial Renal para Perros", handle: "dieta-especial-renal-perros", description: "Dieta especial para perros con problemas renales.", sku: "DIETARENAL", category: "Comida", subcategory: "Dietas Especiales", price: 38000 },
  { title: "Dieta Especial Digestiva para Perros", handle: "dieta-especial-digestiva-perros", description: "Dieta especial para perros con problemas digestivos.", sku: "DIETADIGESTIVA", category: "Comida", subcategory: "Dietas Especiales", price: 32000 },

  // SNACKS Y PREMIOS
  { title: "Huesos Naturales de Res para Perros", handle: "huesos-naturales-res-perros", description: "Huesos naturales de res para masticar y limpiar dientes.", sku: "HUESOSNATRES", category: "Snacks y Premios", subcategory: "Huesos Naturales", price: 8500 },
  { title: "Bully Sticks Naturales para Perros", handle: "bully-sticks-naturales-perros", description: "Bully sticks 100% naturales para perros de todas las edades.", sku: "BULLYSTICKSNA", category: "Snacks y Premios", subcategory: "Huesos Naturales", price: 12000 },
  { title: "Snacks de Carne Natural para Perros", handle: "snacks-carne-natural-perros", description: "Snacks de carne natural sin conservantes artificiales.", sku: "SNACKSCARNENA", category: "Snacks y Premios", subcategory: "Carne Natural", price: 6500 },
  { title: "Snacks Congelados en Seco para Perros", handle: "snacks-congelados-seco-perros", description: "Snacks congelados en seco manteniendo todos los nutrientes.", sku: "CONGELADOSECO", category: "Snacks y Premios", subcategory: "Congelados en Seco", price: 9500 },
  { title: "Snacks Blandos y Masticables para Perros", handle: "snacks-blandos-masticables-perros", description: "Snacks blandos ideales para perros mayores o con problemas dentales.", sku: "SNACKSBLANDOS", category: "Snacks y Premios", subcategory: "Blandos y Masticables", price: 4200 },
  { title: "Galletas Nutritivas para Perros", handle: "galletas-nutritivas-perros", description: "Galletas nutritivas con vitaminas y minerales esenciales.", sku: "GALLETASNUTRI", category: "Snacks y Premios", subcategory: "Galletas", price: 3800 },
  { title: "Snacks de Larga Duración para Perros", handle: "snacks-larga-duracion-perros", description: "Snacks que duran horas para mantener entretenido a tu perro.", sku: "LARGADURACION", category: "Snacks y Premios", subcategory: "Larga Duración", price: 7800 },
  { title: "Snacks para Higiene Dental", handle: "snacks-higiene-dental-perros", description: "Snacks especiales que ayudan a limpiar dientes y encías.", sku: "HIGIENEDENTAL", category: "Snacks y Premios", subcategory: "Higiene Dental", price: 5500 },

  // JUGUETES
  { title: "Juguetes para Morder y Tirar", handle: "juguetes-morder-tirar-perros", description: "Juguetes resistentes para morder y juegos de tira y afloja.", sku: "MORDERTIRAR", category: "Juguetes", subcategory: "Morder y Tirar", price: 12500 },
  { title: "Peluches Suaves para Perros", handle: "peluches-suaves-perros", description: "Peluches suaves y seguros para perros de todas las edades.", sku: "PELUCHESSUAVES", category: "Juguetes", subcategory: "Peluches", price: 8900 },
  { title: "Juguetes para Recuperar", handle: "juguetes-recuperar-perros", description: "Juguetes especiales para juegos de recuperación y fetch.", sku: "RECUPERAR", category: "Juguetes", subcategory: "Recuperar", price: 9800 },
  { title: "Dispensadores de Premios Interactivos", handle: "dispensadores-premios-interactivos", description: "Juguetes dispensadores de premios que estimulan mentalmente.", sku: "DISPENSADORES", category: "Juguetes", subcategory: "Dispensadores de Premios", price: 15500 },
  { title: "Juguetes Rompecabezas para Perros", handle: "juguetes-rompecabezas-perros", description: "Juguetes rompecabezas que estimulan la inteligencia canina.", sku: "ROMPECABEZAS", category: "Juguetes", subcategory: "Rompecabezas", price: 18500 },

  // ACCESORIOS
  { title: "Camas Ortopédicas para Perros", handle: "camas-ortopedicas-perros", description: "Camas ortopédicas para perros mayores o con problemas articulares.", sku: "CAMASORTOPEDI", category: "Accesorios", subcategory: "Camas", price: 45000 },
  { title: "Camas Regulares para Perros", handle: "camas-regulares-perros", description: "Camas cómodas y lavables para perros de todas las razas.", sku: "CAMASREGULARES", category: "Accesorios", subcategory: "Camas", price: 25000 },
  { title: "Platos y Bowls Antideslizantes", handle: "platos-bowls-antideslizantes", description: "Platos y bowls antideslizantes para comida y agua.", sku: "PLATOSANTIDES", category: "Accesorios", subcategory: "Platos y Bowls", price: 8500 },
  { title: "Correas Retráctiles para Perros", handle: "correas-retractiles-perros", description: "Correas retráctiles de alta calidad para paseos seguros.", sku: "CORREASRETRAC", category: "Accesorios", subcategory: "Correas", price: 18000 },
  { title: "Correas Fijas para Perros", handle: "correas-fijas-perros", description: "Correas fijas resistentes para paseos diarios.", sku: "CORREASFIJAS", category: "Accesorios", subcategory: "Correas", price: 12000 },
  { title: "Collares Ajustables para Perros", handle: "collares-ajustables-perros", description: "Collares ajustables con hebilla de seguridad.", sku: "COLLARESAJUST", category: "Accesorios", subcategory: "Collares y Arneses", price: 7500 },
  { title: "Arneses de Paseo para Perros", handle: "arneses-paseo-perros", description: "Arneses cómodos y seguros para paseos.", sku: "ARNESESPASEO", category: "Accesorios", subcategory: "Collares y Arneses", price: 15000 },
  { title: "Accesorios de Adiestramiento", handle: "accesorios-adiestramiento-perros", description: "Kit completo de accesorios para adiestramiento canino.", sku: "ADIESTRAMIENTO", category: "Accesorios", subcategory: "Adiestramiento", price: 28000 },
  { title: "Jaulas y Transportadores", handle: "jaulas-transportadores-perros", description: "Jaulas y transportadores seguros para viajes.", sku: "JAULASTRANSP", category: "Accesorios", subcategory: "Recintos y Transporte", price: 35000 },

  // HIGIENE Y BAÑO
  { title: "Toallitas Húmedas para Limpieza", handle: "toallitas-humedas-limpieza", description: "Toallitas húmedas hipoalergénicas para limpieza diaria.", sku: "TOALLITASHUME", category: "Higiene y Baño", subcategory: "Toallitas", price: 4200 },
  { title: "Pads Absorbentes para Entrenamiento", handle: "pads-absorbentes-entrenamiento", description: "Pads absorbentes para entrenamiento de cachorros.", sku: "PADSENTRENAM", category: "Higiene y Baño", subcategory: "Pads de Entrenamiento", price: 8500 },
  { title: "Bolsas Biodegradables para Desechos", handle: "bolsas-biodegradables-desechos", description: "Bolsas biodegradables para recoger desechos del perro.", sku: "BOLSASBIO", category: "Higiene y Baño", subcategory: "Bolsas", price: 3200 },
  { title: "Pañales Desechables para Perros", handle: "panales-desechables-perros", description: "Pañales desechables para perros mayores o en período post-operatorio.", sku: "PANALESDESECH", category: "Higiene y Baño", subcategory: "Pañales", price: 12500 },

  // PELUQUERÍA
  { title: "Cepillos de Cerdas para Perros", handle: "cepillos-cerdas-perros", description: "Cepillos de cerdas naturales para el cuidado del pelaje.", sku: "CEPILLOSCERDAS", category: "Peluquería", subcategory: "Cepillos", price: 6800 },
  { title: "Shampoos Hipoalergénicos", handle: "shampoos-hipoalergenicos-perros", description: "Shampoos hipoalergénicos para perros con piel sensible.", sku: "SHAMPOOSHIPO", category: "Peluquería", subcategory: "Shampoos y Acondicionadores", price: 9500 },
  { title: "Acondicionadores para Perros", handle: "acondicionadores-perros", description: "Acondicionadores que suavizan y desenredan el pelaje.", sku: "ACONDICIONADOR", category: "Peluquería", subcategory: "Shampoos y Acondicionadores", price: 7800 },
  { title: "Corta Uñas Profesional", handle: "corta-unas-profesional-perros", description: "Corta uñas profesional con protección de seguridad.", sku: "CORTAUNASPRO", category: "Peluquería", subcategory: "Corta Uñas y Herramientas", price: 12000 },
  { title: "Productos Skin Care para Perros", handle: "productos-skin-care-perros", description: "Productos especializados para cuidado de la piel canina.", sku: "SKINCAREPERRO", category: "Peluquería", subcategory: "Skin Care", price: 15000 },

  // FARMACIA
  { title: "Tratamiento Antipulgas y Garrapatas", handle: "tratamiento-antipulgas-garrapatas", description: "Tratamiento efectivo para control de pulgas y garrapatas.", sku: "ANTIPULGAS", category: "Farmacia", subcategory: "Pulgas y Garrapatas", price: 18000 },
  { title: "Vitaminas Multivitamínicas", handle: "vitaminas-multivitaminicas-perros", description: "Vitaminas multivitamínicas para mantener la salud óptima.", sku: "VITAMINASMULTI", category: "Farmacia", subcategory: "Vitaminas y Suplementos", price: 22000 },
  { title: "Suplementos Articulares", handle: "suplementos-articulares-perros", description: "Suplementos para mantener la salud articular en perros mayores.", sku: "SUPLEMENTOSART", category: "Farmacia", subcategory: "Vitaminas y Suplementos", price: 28000 },
  { title: "Productos para Alergias", handle: "productos-alergias-perros", description: "Productos especializados para tratar alergias e irritaciones.", sku: "ALERGIASPERRO", category: "Farmacia", subcategory: "Alergias y Picazón", price: 25000 },
  { title: "Termómetro Digital para Perros", handle: "termometro-digital-perros", description: "Termómetro digital específico para mascotas.", sku: "TERMOMETRODIG", category: "Farmacia", subcategory: "Control de Temperatura", price: 15000 },
  { title: "Medicamentos Veterinarios", handle: "medicamentos-veterinarios-perros", description: "Medicamentos veterinarios prescritos por profesionales.", sku: "MEDICAMENTOSVET", category: "Farmacia", subcategory: "Medicamentos", price: 35000 }
]

export default async function seedChileanProducts({
  container
}: {
  container: MedusaContainer
}) {
  console.log("🇨🇱 Iniciando seed de productos para Chile...")

  try {
    // Verificar si ya se ejecutó el seed
    const seedMarkerPath = path.join(process.cwd(), '.seed-completed')
    const forceSeed = process.env.FORCE_SEED === 'true'
    
    if (fs.existsSync(seedMarkerPath) && !forceSeed) {
      console.log("✅ Seed ya completado, saltando...")
      console.log("ℹ️ Para forzar seed, configura FORCE_SEED=true")
      return
    }

    // Verificar si existe archivo CSV para importar
    const csvPath = path.join(process.cwd(), 'product-import-template.csv')
    if (fs.existsSync(csvPath)) {
      console.log("📥 Archivo CSV encontrado, importando productos desde CSV...")
      try {
        await importProductsFromCSV({ container, csvFilePath: csvPath })
        console.log("✅ Importación desde CSV completada")
        return
      } catch (csvError) {
        console.log("⚠️ Error importando desde CSV, continuando con productos por defecto:", csvError)
      }
    }

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

    // Verificar productos existentes
    const existingProducts = await productModuleService.listProducts({})

    if (existingProducts.length > 0 && !forceSeed) {
      console.log(`ℹ️ Ya existen ${existingProducts.length} productos en la base de datos`)
      console.log("ℹ️ Para forzar creación de productos, configura FORCE_SEED=true")
      return
    }

    console.log(`📦 Creando ${chileanDogProducts.length} productos para Chile...`)

    let createdCount = 0
    let errorCount = 0

    for (const productData of chileanDogProducts) {
      try {
        const handle = generateValidHandle(productData.title)
        const sku = generateSku(productData.title)

        const product = {
          title: productData.title,
          handle: handle,
          description: productData.description,
          status: "published" as const,
          thumbnail: `https://via.placeholder.com/300x300.png?text=${encodeURIComponent(productData.title)}`,
          variants: [
            {
              title: productData.title,
              sku: sku,
              inventory_quantity: Math.floor(Math.random() * 100) + 50, // Stock aleatorio entre 50-150
              prices: [
                {
                  currency_code: "clp",
                  amount: productData.price * 100 // Convertir a centavos
                }
              ]
            }
          ],
          // Agregar metadatos para categorización
          metadata: {
            category: productData.category,
            subcategory: productData.subcategory,
            region: "chile",
            created_by: "seed_script"
          }
        }

        await productModuleService.createProducts(product)
        createdCount++
        console.log(`✅ Producto creado: ${productData.title} (SKU: ${sku}) - $${productData.price.toLocaleString('es-CL')} CLP`)
        
      } catch (error: any) {
        errorCount++
        console.error(`❌ Error creando ${productData.title}:`, error.message)
      }
    }

    // Crear archivo marcador de seed completado
    if (createdCount > 0) {
      fs.writeFileSync(seedMarkerPath, JSON.stringify({
        completed: true,
        timestamp: new Date().toISOString(),
        products_created: createdCount,
        errors: errorCount
      }))
      console.log("📝 Marcador de seed completado creado")
    }

    console.log(`🎉 Seed completado para Chile:`)
    console.log(`   ✅ Productos creados: ${createdCount}`)
    console.log(`   ❌ Errores: ${errorCount}`)
    console.log(`   🇨🇱 Región: Chile (CLP)`)

  } catch (error) {
    console.error("❌ Error en seed de productos para Chile:", error)
    throw error
  }
}
