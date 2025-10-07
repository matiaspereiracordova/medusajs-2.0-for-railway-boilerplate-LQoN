#!/usr/bin/env node

/**
 * Script para debuggear los precios en MedusaJS
 * Ver exactamente qué estructura tienen los precios
 */

const { execSync } = require('child_process');

console.log('🔍 Debuggeando estructura de precios en MedusaJS...\n');

const script = `
import { MedusaContainer } from "@medusajs/framework/types"
import { IProductModuleService, IPricingModuleService } from "@medusajs/framework/types"
import { ModuleRegistrationName } from "@medusajs/framework/utils"

export default async function debugPrices(container: MedusaContainer) {
  const productModuleService: IProductModuleService = container.resolve(
    ModuleRegistrationName.PRODUCT
  )
  const pricingModuleService: IPricingModuleService = container.resolve(
    ModuleRegistrationName.PRICING
  )

  // Obtener un producto con sus variantes
  const products = await productModuleService.listProducts(
    {},
    {
      relations: ["variants"],
      take: 1,
    }
  )

  if (products.length === 0) {
    console.log("❌ No hay productos")
    return
  }

  const product = products[0]
  console.log("📦 Producto:", product.title)
  console.log("   ID:", product.id)
  console.log("   Variantes:", product.variants?.length || 0)

  // Obtener todos los precios
  const allPrices = await pricingModuleService.listPrices()
  console.log("\\n💰 Total precios en sistema:", allPrices.length)

  // Buscar precios de este producto
  for (const variant of product.variants || []) {
    console.log(\`\\n🔍 Variante: \${variant.title} (SKU: \${variant.sku})\`)
    console.log(\`   ID: \${variant.id}\`)
    
    const variantPrices = allPrices.filter((price: any) => {
      return price.variant_id === variant.id || 
             (Array.isArray(price.variant_id) && price.variant_id.includes(variant.id)) ||
             price.price_set_id === variant.id ||
             (price.price_set && price.price_set.variant_id === variant.id)
    })

    console.log(\`   Precios encontrados: \${variantPrices.length}\`)
    
    variantPrices.forEach((price: any) => {
      console.log(\`   - \${price.currency_code?.toUpperCase()}: $\${Number(price.amount) / 100}\`)
      console.log(\`     Estructura completa:\`, JSON.stringify(price, null, 6))
    })
  }
}
`;

// Guardar el script temporalmente
const fs = require('fs');
const path = require('path');
const scriptPath = path.join(__dirname, 'src', 'scripts', 'debug-prices-temp.ts');

fs.writeFileSync(scriptPath, script);

try {
  console.log('⚙️ Ejecutando script en el servidor MedusaJS...\n');
  execSync(`npx medusa exec ./src/scripts/debug-prices-temp.ts`, {
    stdio: 'inherit',
    cwd: __dirname
  });
} catch (error) {
  console.error('❌ Error ejecutando script:', error.message);
} finally {
  // Limpiar el archivo temporal
  if (fs.existsSync(scriptPath)) {
    fs.unlinkSync(scriptPath);
  }
}

