import { MedusaContainer } from "@medusajs/framework/types"

export default async function postDeployDogProducts(container: MedusaContainer) {
  console.log("🐕 Ejecutando creación de productos para perros post-deploy...")

  try {
    // Importar y ejecutar el script de creación de productos
    const { default: createDogProducts } = await import('./create-dog-products.js')
    
    await createDogProducts({ container })
    
    console.log("✅ Post-deploy de productos para perros completado!")
    
  } catch (error) {
    console.error("❌ Error en post-deploy de productos para perros:", error)
  }
}
