import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IProductModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import { container } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🧹 Iniciando limpieza de productos duplicados desde API...")

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
      res.status(200).json({
        success: true,
        message: "No se encontraron productos duplicados",
        data: {
          total_products: allProducts.length,
          duplicates_found: 0,
          products_deleted: 0
        }
      })
      return
    }

    let deletedCount = 0
    const deletedProducts: any[] = []

    // Procesar cada grupo de duplicados
    for (const { handle, products } of duplicates) {
      console.log(`🔄 Procesando duplicados para handle: ${handle}`)
      
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
          
          deletedProducts.push({
            id: productToDelete.id,
            title: productToDelete.title,
            handle: productToDelete.handle
          })
          
          deletedCount++
          console.log(`   ✅ Producto eliminado: ${productToDelete.title}`)
          
        } catch (error: any) {
          console.error(`   ❌ Error eliminando ${productToDelete.title}:`, error.message)
        }
      }
    }

    console.log(`🎉 Limpieza completada:`)
    console.log(`   🗑️ Productos eliminados: ${deletedCount}`)

    res.status(200).json({
      success: true,
      message: "Limpieza de duplicados completada",
      data: {
        total_products: allProducts.length,
        duplicates_found: duplicates.length,
        products_deleted: deletedCount,
        deleted_products: deletedProducts
      }
    })

  } catch (error: any) {
    console.error("❌ Error en limpieza de duplicados:", error)
    res.status(500).json({
      success: false,
      message: "Error en limpieza de duplicados",
      error: error.message
    })
  }
}
