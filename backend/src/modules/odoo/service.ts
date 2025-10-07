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

  // ==================== MÉTODOS PARA VARIANTES Y ATRIBUTOS ====================

  /**
   * Busca o crea un atributo en Odoo (ej: "Size", "Color")
   */
  async getOrCreateAttribute(attributeName: string): Promise<number> {
    await this.login()

    try {
      console.log(`🔍 Buscando atributo: ${attributeName}`)
      
      // Buscar si el atributo ya existe
      const existingAttributes = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.attribute",
          "search_read",
          [[["name", "=", attributeName]]],
          { fields: ["id", "name"], limit: 1 }
        ],
      }) as any[]

      if (existingAttributes.length > 0) {
        console.log(`✅ Atributo encontrado: ${attributeName} (ID: ${existingAttributes[0].id})`)
        return existingAttributes[0].id
      }

      // Crear nuevo atributo si no existe
      console.log(`➕ Creando atributo: ${attributeName}`)
      const attributeId = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.attribute",
          "create",
          [{
            name: attributeName,
            display_type: 'radio', // Mostrar como radio buttons en Odoo
            create_variant: 'always' // Siempre crear variantes
          }],
        ],
      }) as number

      console.log(`✅ Atributo creado: ${attributeName} (ID: ${attributeId})`)
      return attributeId
    } catch (error: any) {
      console.error(`❌ Error obteniendo/creando atributo ${attributeName}:`, error)
      throw error
    }
  }

  /**
   * Busca o crea un valor de atributo en Odoo (ej: "L", "M", "S" para el atributo "Size")
   */
  async getOrCreateAttributeValue(attributeId: number, valueName: string): Promise<number> {
    await this.login()

    try {
      console.log(`🔍 Buscando valor de atributo: ${valueName} para atributo ID ${attributeId}`)
      
      // Buscar si el valor ya existe para este atributo
      const existingValues = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.attribute.value",
          "search_read",
          [[
            ["name", "=", valueName],
            ["attribute_id", "=", attributeId]
          ]],
          { fields: ["id", "name"], limit: 1 }
        ],
      }) as any[]

      if (existingValues.length > 0) {
        console.log(`✅ Valor de atributo encontrado: ${valueName} (ID: ${existingValues[0].id})`)
        return existingValues[0].id
      }

      // Crear nuevo valor si no existe
      console.log(`➕ Creando valor de atributo: ${valueName}`)
      const valueId = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.attribute.value",
          "create",
          [{
            name: valueName,
            attribute_id: attributeId
          }],
        ],
      }) as number

      console.log(`✅ Valor de atributo creado: ${valueName} (ID: ${valueId})`)
      return valueId
    } catch (error: any) {
      console.error(`❌ Error obteniendo/creando valor de atributo ${valueName}:`, error)
      throw error
    }
  }

  /**
   * Agrega una línea de atributo a un producto template en Odoo
   */
  async addAttributeLineToProduct(productTemplateId: number, attributeId: number, valueIds: number[]): Promise<void> {
    await this.login()

    try {
      console.log(`➕ Agregando línea de atributo al producto ${productTemplateId}`)
      console.log(`   Atributo ID: ${attributeId}, Valores: ${valueIds.join(', ')}`)

      // Odoo usa un formato especial para relaciones many2many: [(6, 0, [ids])]
      // (6, 0, [ids]) significa "reemplazar todos los valores con estos IDs"
      await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.template",
          "write",
          [
            [productTemplateId],
            {
              attribute_line_ids: [[0, 0, {
                attribute_id: attributeId,
                value_ids: [[6, 0, valueIds]]
              }]]
            }
          ],
        ],
      })

      console.log(`✅ Línea de atributo agregada al producto ${productTemplateId}`)
    } catch (error: any) {
      console.error(`❌ Error agregando línea de atributo al producto ${productTemplateId}:`, error)
      throw error
    }
  }

  /**
   * Actualiza el precio de una variante específica en Odoo
   */
  async updateVariantPrice(productVariantId: number, price: number, currencyCode: string = 'CLP'): Promise<void> {
    await this.login()

    try {
      console.log(`💰 Actualizando precio de variante ${productVariantId}: ${price} ${currencyCode}`)
      
      // En Odoo, el precio de una variante se actualiza en el modelo product.product
      await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.product",
          "write",
          [
            [productVariantId],
            {
              list_price: price,
              // También actualizar el precio de la plantilla si es necesario
              price_extra: price
            }
          ],
        ],
      })

      console.log(`✅ Precio actualizado para variante ${productVariantId}`)
    } catch (error: any) {
      console.error(`❌ Error actualizando precio de variante ${productVariantId}:`, error)
      throw error
    }
  }

  /**
   * Busca una variante específica en Odoo por SKU
   */
  async findVariantBySku(sku: string): Promise<any[]> {
    await this.login()

    try {
      console.log(`🔍 Buscando variante por SKU: ${sku}`)
      
      const variants = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.product",
          "search_read",
          [[["default_code", "=", sku]]],
          { fields: ["id", "name", "default_code", "list_price", "product_tmpl_id"] }
        ],
      }) as any[]

      console.log(`✅ Variantes encontradas por SKU ${sku}: ${variants.length}`)
      return variants
    } catch (error: any) {
      console.error(`❌ Error buscando variante por SKU ${sku}:`, error)
      return []
    }
  }

  /**
   * Sincroniza precios de variantes desde Medusa a Odoo
   */
  async syncVariantPrices(variants: Array<{ 
    id: string; 
    title: string; 
    sku: string; 
    prices: any[] 
  }>): Promise<void> {
    await this.login()

    try {
      console.log(`💰 Sincronizando precios de ${variants.length} variantes...`)

      for (const variant of variants) {
        if (!variant.prices || variant.prices.length === 0) {
          console.log(`⚠️ No hay precios para la variante ${variant.sku}`)
          continue
        }

        // Buscar la variante en Odoo por SKU
        const odooVariants = await this.findVariantBySku(variant.sku)
        
        if (odooVariants.length === 0) {
          console.log(`⚠️ No se encontró la variante ${variant.sku} en Odoo`)
          continue
        }

        const odooVariant = odooVariants[0]
        
        // Obtener el precio en CLP (prioridad) o la primera moneda disponible
        const clpPrice = variant.prices.find((p: any) => p.currency_code === 'clp')
        const usdPrice = variant.prices.find((p: any) => p.currency_code === 'usd')
        const eurPrice = variant.prices.find((p: any) => p.currency_code === 'eur')
        
        const selectedPrice = clpPrice || usdPrice || eurPrice || variant.prices[0]
        const priceAmount = selectedPrice.amount / 100 // Convertir de centavos a unidades

        console.log(`💰 Precio para ${variant.sku}: ${priceAmount} ${selectedPrice.currency_code}`)

        // Actualizar el precio en Odoo
        await this.updateVariantPrice(odooVariant.id, priceAmount, selectedPrice.currency_code)
      }

      console.log(`✅ Precios de variantes sincronizados exitosamente`)
    } catch (error: any) {
      console.error(`❌ Error sincronizando precios de variantes:`, error)
      throw error
    }
  }

  /**
   * Sincroniza variantes de Medusa como atributos y valores en Odoo
   */
  async syncProductVariants(productTemplateId: number, variants: Array<{ title: string; sku: string; options?: any[]; prices?: any[] }>): Promise<void> {
    await this.login()

    try {
      console.log(`🔄 Sincronizando ${variants.length} variante(s) para producto ${productTemplateId}`)

      // Si solo hay una variante, crear un atributo simple
      if (variants.length === 1) {
        console.log(`ℹ️ Producto con una sola variante, creando atributo simple`)
        const variant = variants[0]
        
        // Crear un atributo genérico para la variante única
        const attributeId = await this.getOrCreateAttribute('Variant')
        const valueId = await this.getOrCreateAttributeValue(attributeId, variant.title || variant.sku || 'Default')
        
        // Agregar la línea de atributo al producto
        await this.addAttributeLineToProduct(productTemplateId, attributeId, [valueId])
        
        console.log(`✅ Variante única sincronizada: ${variant.title || variant.sku}`)
        return
      }

      // Para múltiples variantes, usar la lógica existente
      console.log(`🔄 Procesando ${variants.length} variantes múltiples`)

      // Primero, limpiar las líneas de atributo existentes
      console.log(`🧹 Limpiando atributos existentes del producto`)
      await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.options.dbName,
          this.uid,
          this.options.apiKey,
          "product.template",
          "write",
          [
            [productTemplateId],
            {
              attribute_line_ids: [[5, 0, 0]] // (5, 0, 0) elimina todas las líneas
            }
          ],
        ],
      })

      // Agrupar variantes por opciones (atributos)
      // En Medusa 2.0, las opciones pueden venir en dos formatos:
      // 1. Array: [{ title: "Size", value: "L" }]
      // 2. Objeto: { Size: "L", Color: "Red" }
      const attributeMap = new Map<string, Set<string>>()

      variants.forEach(variant => {
        let hasProcessedOptions = false
        
        // Caso 1: Options es un objeto (formato Medusa 2.0)
        if (variant.options && typeof variant.options === 'object' && !Array.isArray(variant.options)) {
          console.log(`🔍 Procesando opciones como objeto para ${variant.title || variant.sku}:`, variant.options)
          
          for (const [attrName, attrValue] of Object.entries(variant.options)) {
            if (attrValue && typeof attrValue === 'string') {
              if (!attributeMap.has(attrName)) {
                attributeMap.set(attrName, new Set())
              }
              attributeMap.get(attrName)!.add(attrValue)
              hasProcessedOptions = true
            }
          }
        }
        // Caso 2: Options es un array (formato anterior)
        else if (variant.options && Array.isArray(variant.options) && variant.options.length > 0) {
          console.log(`🔍 Procesando opciones como array para ${variant.title || variant.sku}:`, variant.options)
          
          variant.options.forEach((option: any) => {
            const attrName = option.title || option.name || 'Size'
            const attrValue = option.value
            
            if (attrValue) {
              if (!attributeMap.has(attrName)) {
                attributeMap.set(attrName, new Set())
              }
              attributeMap.get(attrName)!.add(attrValue)
              hasProcessedOptions = true
            }
          })
        }
        
        // Si no hay opciones o no se pudieron procesar, intentar extraer del título/SKU
        if (!hasProcessedOptions) {
          console.log(`⚠️ No se encontraron opciones para ${variant.title || variant.sku}, intentando extraer del título/SKU`)
          
          // Extraer el valor de talla del título (ej: "S" de "SHORTS-S" o simplemente "S")
          const match = variant.title?.match(/^(.+?)[-\s]*([SMLX]+|[0-9]+)$/i) ||
                       variant.sku?.match(/^(.+?)[-\s]*([SMLX]+|[0-9]+)$/i) ||
                       variant.title?.match(/^([SMLX]+|[0-9]+)$/i)
          
          if (match && match[match.length - 1]) {
            const attrValue = match[match.length - 1].toUpperCase()
            if (!attributeMap.has('Size')) {
              attributeMap.set('Size', new Set())
            }
            attributeMap.get('Size')!.add(attrValue)
            console.log(`✅ Extraído valor de Size: ${attrValue}`)
          } else {
            // Si no se puede extraer, usar el título completo
            console.log(`⚠️ No se pudo extraer valor del título/SKU, usando título completo`)
            if (!attributeMap.has('Variant')) {
              attributeMap.set('Variant', new Set())
            }
            attributeMap.get('Variant')!.add(variant.title || variant.sku || 'Default')
          }
        }
      })

      console.log(`📊 Atributos detectados:`, Object.fromEntries(
        Array.from(attributeMap.entries()).map(([key, values]) => [key, Array.from(values)])
      ))

      // Crear/obtener atributos y valores, y agregar líneas al producto
      for (const [attributeName, values] of attributeMap.entries()) {
        const attributeId = await this.getOrCreateAttribute(attributeName)
        const valueIds: number[] = []

        for (const valueName of values) {
          const valueId = await this.getOrCreateAttributeValue(attributeId, valueName)
          valueIds.push(valueId)
        }

        // Agregar la línea de atributo al producto
        await this.addAttributeLineToProduct(productTemplateId, attributeId, valueIds)
      }

      console.log(`✅ Variantes sincronizadas exitosamente para producto ${productTemplateId}`)
    } catch (error: any) {
      console.error(`❌ Error sincronizando variantes para producto ${productTemplateId}:`, error)
      throw error
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
