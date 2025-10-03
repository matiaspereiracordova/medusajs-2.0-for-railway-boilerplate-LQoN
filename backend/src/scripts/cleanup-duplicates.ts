import { IProductModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import { container } from "@medusajs/framework/utils"

async function cleanupDuplicateProducts() {
  console.log("🧹 Iniciando limpieza de productos duplicados...")

  try {
    // Resolver servicio de productos
    const productModuleService: IProductModuleService = container.resolve(
      ModuleRegistrationName.PRODUCT
    )

    // Obtener todos los productos
    const allProducts = await productModuleService.listProducts({
      relations: ["variants"]
    })

    console.log(`📦 Total de productos encontrados: ${allProducts.length}`)

    // Agrupar productos por handle
    const productsByHandle = new Map<string, any[]>()
    
    allProducts.forEach(product => {
      const handle = product.handle
      if (!productsByHandle.has(handle)) {
        productsByHandle.set(handle, [])
      }
      productsByHandle.get(handle)!.push(product)
    })

    // Encontrar duplicados
    const duplicates: { handle: string; products: any[] }[] = []
    
    for (const [handle, products] of productsByHandle.entries()) {
      if (products.length > 1) {
        duplicates.push({ handle, products })
      }
    }

    console.log(`🔍 Productos duplicados encontrados: ${duplicates.length}`)

    if (duplicates.length === 0) {
      console.log("✅ No se encontraron duplicados")
      return
    }

    let deletedCount = 0

    // Procesar cada grupo de duplicados
    for (const { handle, products } of duplicates) {
      console.log(`\n🔄 Procesando duplicados para handle: ${handle}`)
      
      // Ordenar por fecha de creación (más reciente primero)
      const sortedProducts = products.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return dateB - dateA
      })

      // Mantener el primero (más reciente) y eliminar el resto
      const [keepProduct, ...productsToDelete] = sortedProducts

      console.log(`   ✅ Manteniendo: ${keepProduct.title} (ID: ${keepProduct.id})`)
      
      for (const productToDelete of productsToDelete) {
        try {
          console.log(`   🗑️ Eliminando: ${productToDelete.title} (ID: ${productToDelete.id})`)
          
          // Eliminar el producto
          await productModuleService.deleteProducts([productToDelete.id])
          
          deletedCount++
          console.log(`   ✅ Producto eliminado: ${productToDelete.title}`)
          
        } catch (error: any) {
          console.error(`   ❌ Error eliminando ${productToDelete.title}:`, error.message)
        }
      }
    }

    console.log(`\n🎉 Limpieza completada:`)
    console.log(`   🗑️ Productos eliminados: ${deletedCount}`)
    console.log(`   ✅ Productos únicos mantenidos`)

  } catch (error) {
    console.error("❌ Error en limpieza de duplicados:", error)
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  cleanupDuplicateProducts()
    .then(() => {
      console.log("✅ Script de limpieza completado")
      process.exit(0)
    })
    .catch((error) => {
      console.error("❌ Error ejecutando script:", error)
      process.exit(1)
    })
}

export default cleanupDuplicateProducts
