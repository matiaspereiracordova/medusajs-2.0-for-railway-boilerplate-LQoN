import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"
import { IProductModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"
import OdooModuleService, { OdooProduct } from "../modules/odoo/service.js"

type SyncToOdooWorkflowInput = {
  productIds?: string[]
  limit?: number
  offset?: number
}

type SyncToOdooWorkflowOutput = {
  syncedProducts: number
  createdProducts: number
  updatedProducts: number
}

// Step 1: Obtener productos de Medusa
const getMedusaProductsStep = createStep(
  "get-medusa-products",
  async (input: SyncToOdooWorkflowInput, { container }) => {
    const productModuleService: IProductModuleService = container.resolve(
      ModuleRegistrationName.PRODUCT
    )

    const { productIds, limit = 10, offset = 0 } = input

    let products
    if (productIds && productIds.length > 0) {
      products = await Promise.all(
        productIds.map((id) =>
          productModuleService.retrieveProduct(id, {
            relations: ["variants", "categories", "tags"],
          })
        )
      )
    } else {
      products = await productModuleService.listProducts(
        {},
        {
          relations: ["variants", "categories", "tags"],
          take: limit,
          skip: offset,
        }
      )
    }

    return new StepResponse({ products })
  }
)

// Step 2: Transformar productos de Medusa a formato ODOO
const transformProductsStep = createStep(
  "transform-products",
  async ({ products }, { container }) => {
    const odooModuleService: OdooModuleService = container.resolve("ODOO")

    const transformedProducts = []

    for (const product of products) {
      // Buscar si el producto ya existe en ODOO
      const existingOdooProducts = await odooModuleService.searchProductByExternalId(
        product.id
      )

      const odooProductData = {
        name: product.title,
        code: product.handle,
        list_price: product.variants?.[0]?.prices?.[0]?.amount || 0,
        currency_id: 1, // ID de la moneda en ODOO (ajustar según configuración)
        type: "product",
        sale_ok: true,
        purchase_ok: true,
        x_medusa_id: product.id, // Campo personalizado para almacenar ID de Medusa
        description: product.description || "",
        // Agregar más campos según necesidades
      }

      transformedProducts.push({
        medusaProduct: product,
        odooProductData,
        existsInOdoo: existingOdooProducts.length > 0,
        odooProductId: existingOdooProducts[0]?.id,
      })
    }

    return new StepResponse({ transformedProducts })
  }
)

// Step 3: Sincronizar productos con ODOO
const syncProductsToOdooStep = createStep(
  "sync-products-to-odoo",
  async ({ transformedProducts }, { container }) => {
    const odooModuleService: OdooModuleService = container.resolve("ODOO")

    let createdCount = 0
    let updatedCount = 0

    for (const { odooProductData, existsInOdoo, odooProductId } of transformedProducts) {
      try {
        if (existsInOdoo && odooProductId) {
          // Actualizar producto existente
          await odooModuleService.updateProduct(odooProductId, odooProductData)
          updatedCount++
          console.log(`✅ Producto actualizado en ODOO: ${odooProductData.name}`)
        } else {
          // Crear nuevo producto
          const newOdooProductId = await odooModuleService.createProduct(odooProductData)
          createdCount++
          console.log(`✅ Producto creado en ODOO: ${odooProductData.name} (ID: ${newOdooProductId})`)
        }
      } catch (error) {
        console.error(`❌ Error sincronizando producto ${odooProductData.name}:`, error)
      }
    }

    return new StepResponse({
      createdCount,
      updatedCount,
      totalSynced: createdCount + updatedCount,
    })
  }
)

// Crear el workflow principal
const syncToOdooWorkflow = createWorkflow(
  "sync-to-odoo",
  function (input) {
    const { products } = getMedusaProductsStep(input)
    const { transformedProducts } = transformProductsStep()
    const { createdCount, updatedCount, totalSynced } = syncProductsToOdooStep()

    return new WorkflowResponse({
      syncedProducts: totalSynced,
      createdProducts: createdCount,
      updatedProducts: updatedCount,
    })
  }
)

export default syncToOdooWorkflow