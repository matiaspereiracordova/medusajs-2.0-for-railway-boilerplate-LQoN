import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import syncToOdooWorkflow from "../../../workflows/sync-to-odoo.js"
import { IProductModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] 🧪 TEST: Iniciando sincronización específica del producto "pierna"`)

    // Buscar el producto "pierna" por nombre
    const productModuleService: IProductModuleService = req.scope.resolve(
      ModuleRegistrationName.PRODUCT
    )

    const products = await productModuleService.listProducts({
      title: "pierna"
    }, {
      relations: ["variants", "categories", "tags", "images"],
      take: 1
    })

    if (products.length === 0) {
      console.log(`[${timestamp}] ❌ TEST: No se encontró producto "pierna"`)
      res.status(404).json({
        success: false,
        message: "Producto 'pierna' no encontrado",
        timestamp
      })
      return
    }

    const product = products[0]
    console.log(`[${timestamp}] 📦 TEST: Producto encontrado - "${product.title}" (${product.status})`)
    console.log(`[${timestamp}] 📦 TEST: ID: ${product.id}, Variants: ${product.variants?.length || 0}`)

    // Ejecutar sincronización específica
    console.log(`[${timestamp}] 🚀 TEST: Ejecutando sincronización con Odoo...`)
    const result = await syncToOdooWorkflow(req.scope).run({
      input: {
        productIds: [product.id],
        limit: 1,
        offset: 0,
      },
    })

    const response = {
      success: true,
      message: "Sincronización del producto 'pierna' completada",
      data: {
        product: {
          id: product.id,
          title: product.title,
          status: product.status,
          variants: product.variants?.length || 0
        },
        syncResult: {
          syncedProducts: result.result.syncedProducts,
          createdProducts: result.result.createdProducts,
          updatedProducts: result.result.updatedProducts,
          errorCount: result.result.errorCount,
          errors: result.result.errors,
        },
        timestamp
      },
    }

    console.log(`[${timestamp}] ✅ TEST: Sincronización completada:`, response.data.syncResult)

    res.json(response)
  } catch (error: any) {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ❌ TEST: Error en sincronización del producto "pierna":`, error)
    
    res.status(500).json({
      success: false,
      message: "Error sincronizando producto 'pierna'",
      error: error.message,
      timestamp
    })
  }
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  res.json({
    success: true,
    message: "Endpoint de prueba para sincronizar producto 'pierna'",
    usage: {
      method: "POST",
      endpoint: "/admin/sync-product-pierna",
      description: "Sincroniza específicamente el producto 'pierna' con Odoo"
    }
  })
}
