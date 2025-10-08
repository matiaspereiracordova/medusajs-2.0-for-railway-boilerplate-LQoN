import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { OdooClient } from "../../../services/odoo-client"

/**
 * Endpoint de diagnóstico para verificar el estado del sistema
 * GET /admin/diagnostic
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    console.log("🔍 Iniciando diagnóstico del sistema...")
    
    const diagnostic = {
      timestamp: new Date().toISOString(),
      status: "running",
      services: {
        medusa: {
          status: "ok",
          version: "2.0",
        },
        odoo: {
          status: "unknown",
          connection: null,
          error: null
        }
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        odooUrl: process.env.ODOO_URL ? "configured" : "missing",
        odooDatabase: process.env.ODOO_DATABASE ? "configured" : "missing",
        odooUsername: process.env.ODOO_USERNAME ? "configured" : "missing",
        odooPassword: process.env.ODOO_PASSWORD ? "configured" : "missing",
      }
    }

    // Probar conexión con Odoo
    try {
      console.log("🔌 Probando conexión con Odoo...")
      const odooClient = new OdooClient()
      
      const uid = await odooClient.authenticate()
      console.log(`✅ Odoo conectado. UID: ${uid}`)
      
      // Probar operación básica
      const products = await odooClient.searchRead(
        'product.template',
        [['sale_ok', '=', true]],
        ['id', 'name'],
        3
      )
      
      diagnostic.services.odoo = {
        status: "ok",
        connection: {
          uid,
          productsFound: products.length,
          lastCheck: new Date().toISOString()
        },
        error: null
      }
      
      console.log(`✅ Odoo operativo. Productos encontrados: ${products.length}`)
      
    } catch (odooError: any) {
      console.error("❌ Error conectando con Odoo:", odooError.message)
      
      diagnostic.services.odoo = {
        status: "error",
        connection: null,
        error: {
          message: odooError.message,
          type: odooError.constructor.name,
          timestamp: new Date().toISOString()
        }
      }
    }

    // Determinar estado general
    const hasOdooError = diagnostic.services.odoo.status === "error"
    diagnostic.status = hasOdooError ? "degraded" : "healthy"

    console.log(`📊 Diagnóstico completado. Estado: ${diagnostic.status}`)

    res.json({
      success: true,
      message: "Diagnóstico completado",
      data: diagnostic
    })
    
  } catch (error: any) {
    console.error("❌ Error en diagnóstico:", error)
    
    res.status(500).json({
      success: false,
      message: "Error en diagnóstico del sistema",
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}

