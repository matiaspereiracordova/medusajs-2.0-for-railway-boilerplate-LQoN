import { JSONRPCClient } from "json-rpc-2.0"

type Options = {
  url: string
  dbName: string
  username: string
  apiKey: string
}

export type OdooProduct = {
  id: number
  name: string
  default_code?: string
  list_price: number
  currency_id: [number, string]
  type: string
  active: boolean
  description?: string
  image_1920?: string
  image_128?: string
  image_256?: string
}

export type Pagination = {
  offset?: number
  limit?: number
}

export default class OdooModuleService {
  private options: Options
  private client: JSONRPCClient
  private uid?: number

  constructor({}, options: Options) {
    this.options = options
    
    console.log("🔧 Configuración del módulo ODOO:", {
      url: options.url,
      dbName: options.dbName,
      username: options.username,
      hasApiKey: !!options.apiKey
    })

    this.client = new JSONRPCClient((jsonRPCRequest) => {
      console.log("🌐 Intentando conectar a ODOO:", `${options.url}/jsonrpc`)
      return fetch(`${options.url}/jsonrpc`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(jsonRPCRequest),
      }).then((response) => {
        if (response.status === 200) {
          return response
            .json()
            .then((jsonRPCResponse) => this.client.receive(jsonRPCResponse))
        } else if (jsonRPCRequest.id !== undefined) {
          return Promise.reject(new Error(response.statusText))
        }
      })
    })
  }

  async login() {
    if (this.uid) return this.uid

    this.uid = await this.client.request("call", {
      service: "common",
      method: "authenticate",
      args: [
        this.options.dbName,
        this.options.username,
        this.options.apiKey,
        {},
      ],
    })

    return this.uid
  }

  async fetchProducts(pagination: Pagination = {}): Promise<OdooProduct[]> {
    await this.login()

    const { offset = 0, limit = 10 } = pagination

    return await this.client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        this.options.dbName,
        this.uid,
        this.options.apiKey,
        "product.template",
        "search_read",
        [
          [
            ["sale_ok", "=", true],
            ["type", "=", "product"],
          ],
        ],
        {
          fields: [
            "id",
            "name",
            "default_code",
            "list_price",
            "currency_id",
            "type",
            "active",
            "description",
            "image_1920",
            "image_128",
            "image_256",
          ],
          offset,
          limit,
        },
      ],
    })
  }

  async createProduct(productData: any): Promise<number> {
    await this.login()

    try {
      // Crear una copia del objeto sin la imagen para el logging
      const logData = { ...productData }
      if (logData.image_1920) {
        logData.image_1920 = `[Imagen base64: ${logData.image_1920.length} caracteres]`
      }
      console.log(`📤 Creando producto en Odoo:`, JSON.stringify(logData, null, 2))
      
      const result = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.template",
          "create",
          [productData],
        ],
      })

      console.log(`✅ Producto creado exitosamente con ID: ${result}`)
      return result as number
    } catch (error: any) {
      console.error(`❌ Error creando producto en Odoo:`, error)
      throw new Error(`Error creando producto: ${error.message || error}`)
    }
  }

  async getProductPrice(productId: number, quantity: number = 1, partnerId?: number): Promise<number> {
    await this.login()

    try {
      // Obtener la lista de precios por defecto
      const defaultPricelist = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.pricelist",
          "search",
          [[["active", "=", true]]],
          { limit: 1 }
        ],
      }) as number[];

      if (defaultPricelist.length === 0) {
        console.warn("⚠️ No se encontró lista de precios activa");
        return 0;
      }

      const pricelistId = defaultPricelist[0];
      const token = process.env.ODOO_API_TOKEN || "default_token";

      // Usar el método personalizado para obtener precio
      const price = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.pricelist",
          "get_single_product_price",
          [pricelistId, productId, quantity, partnerId, token],
        ],
      }) as number;

      console.log(`💰 Precio obtenido para producto ${productId}: $${price}`);
      return price;
    } catch (error: any) {
      console.error(`❌ Error obteniendo precio para producto ${productId}:`, error);
      return 0;
    }
  }

  async updateProduct(productId: number, productData: any): Promise<boolean> {
    await this.login()

    try {
      // Crear una copia del objeto sin la imagen para el logging
      const logData = { ...productData }
      if (logData.image_1920) {
        logData.image_1920 = `[Imagen base64: ${logData.image_1920.length} caracteres]`
      }
      console.log(`📤 Actualizando producto en Odoo (ID: ${productId}):`, JSON.stringify(logData, null, 2))
      
      const result = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.template",
          "write",
          [[productId], productData],
        ],
      })

      console.log(`✅ Producto actualizado exitosamente`)
      return result as boolean
    } catch (error: any) {
      console.error(`❌ Error actualizando producto en Odoo:`, error)
      throw new Error(`Error actualizando producto: ${error.message || error}`)
    }
  }

  async searchProductByExternalId(externalId: string): Promise<OdooProduct[]> {
    await this.login()

    return await this.client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        this.options.dbName,
        this.uid,
        this.options.apiKey,
        "product.template",
        "search_read",
        [
          [["x_medusa_id", "=", externalId]],
        ],
        {
          fields: [
            "id",
            "name",
            "default_code",
            "list_price",
            "currency_id",
            "type",
            "active",
            "description",
            "image_1920",
            "image_128",
            "image_256",
          ],
        },
      ],
    })
  }
}
