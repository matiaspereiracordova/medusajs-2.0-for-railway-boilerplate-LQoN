import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/workflows-sdk"
import { IProductModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

type GetVariantPricesInput = {
  productId: string
  variantId: string
}

type GetVariantPricesOutput = {
  variantId: string
  prices: Array<{
    currency_code: string
    amount: number
    formatted_amount: string
  }>
  success: boolean
  error?: string
}

// Step 1: Obtener precios usando el enfoque de admin
const getVariantPricesAdminStep = createStep(
  "get-variant-prices-admin",
  async (input: GetVariantPricesInput, { container }) => {
    try {
      console.log(`🔍 Obteniendo precios para variant: ${input.variantId}`)
      
      const pricingModuleService: IPricingModuleService = container.resolve(
        ModuleRegistrationName.PRICING
      )

      // Obtener todos los precios
      const allPrices = await pricingModuleService.listPrices()
      console.log(`💰 Total de precios en el sistema: ${allPrices.length}`)

      // Buscar precios que pertenezcan a este variant
      // En MedusaJS 2.0, los precios se asocian a través de price_set_id
      const variantPrices = allPrices.filter(price => {
        const priceObj = price as any
        // El price_set_id debería coincidir con el variant_id
        return priceObj.price_set_id === input.variantId
      })

      console.log(`🔍 Precios encontrados para variant ${input.variantId}: ${variantPrices.length}`)

      if (variantPrices.length === 0) {
        // Si no encontramos precios por price_set_id, intentemos otra estrategia
        console.log("⚠️ No se encontraron precios por price_set_id, intentando estrategia alternativa...")
        
        // Buscar por currency_code y ver si podemos mapear de otra manera
        const clpPrices = allPrices.filter(p => p.currency_code === 'clp')
        const usdPrices = allPrices.filter(p => p.currency_code === 'usd')
        const eurPrices = allPrices.filter(p => p.currency_code === 'eur')
        
        console.log(`🔍 Precios CLP disponibles: ${clpPrices.length}`)
        console.log(`🔍 Precios USD disponibles: ${usdPrices.length}`)
        console.log(`🔍 Precios EUR disponibles: ${eurPrices.length}`)
        
        // Mostrar algunos ejemplos de precios para entender la estructura
        if (clpPrices.length > 0) {
          console.log("🔍 Ejemplo de precio CLP:", {
            id: clpPrices[0].id,
            amount: clpPrices[0].amount,
            currency_code: clpPrices[0].currency_code,
            price_set_id: (clpPrices[0] as any).price_set_id,
            price_set: (clpPrices[0] as any).price_set
          })
        }
      }

      // Convertir precios al formato esperado
      const formattedPrices = variantPrices.map(price => {
        const amount = Number(price.amount) || 0
        const formattedAmount = formatPrice(amount, price.currency_code)
        
        return {
          currency_code: price.currency_code,
          amount: amount,
          formatted_amount: formattedAmount
        }
      })

      console.log(`✅ Precios formateados para variant ${input.variantId}:`, formattedPrices)

      return new StepResponse({
        variantId: input.variantId,
        prices: formattedPrices,
        success: true
      })
    } catch (error) {
      console.error(`❌ Error obteniendo precios para variant ${input.variantId}:`, error)
      return new StepResponse({
        variantId: input.variantId,
        prices: [],
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      })
    }
  }
)

// Función auxiliar para formatear precios
function formatPrice(amount: number, currencyCode: string): string {
  const value = amount / 100 // Convertir de centavos
  
  switch (currencyCode.toUpperCase()) {
    case 'CLP':
      return `$${value.toLocaleString('es-CL')}`
    case 'USD':
      return `$${value.toFixed(2)}`
    case 'EUR':
      return `€${value.toFixed(2).replace('.', ',')}`
    default:
      return `${currencyCode} ${value.toFixed(2)}`
  }
}

// Crear el workflow principal
const getVariantPricesAdminWorkflow = createWorkflow(
  "get-variant-prices-admin",
  function (input: GetVariantPricesInput) {
    const result = getVariantPricesAdminStep(input)

    return new WorkflowResponse({
      variantId: result.variantId,
      prices: result.prices,
      success: result.success,
      error: result.error
    })
  }
)

export default getVariantPricesAdminWorkflow
