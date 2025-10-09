import { JSONRPCClient } from "json-rpc-2.0";
import { ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD } from "../lib/constants";

export class OdooClient {
  private client: JSONRPCClient;
  private url: string;
  private db: string;
  private username: string;
  private password: string;
  private uid: number | null = null;

  constructor() {
    this.url = ODOO_URL || "";
    this.db = ODOO_DATABASE || "";
    this.username = ODOO_USERNAME || "";
    this.password = ODOO_PASSWORD || "";

    // Validar que las variables de entorno estén configuradas
    if (!this.url || !this.db || !this.username || !this.password) {
      console.warn("⚠️ Variables de entorno de Odoo no configuradas completamente");
      console.warn("Variables requeridas: ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD");
    }

    this.client = new JSONRPCClient(async (jsonRPCRequest) => {
      const response = await fetch(`${this.url}/jsonrpc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jsonRPCRequest),
      });

      if (response.status === 200) {
        const jsonRPCResponse = await response.json();
        return this.client.receive(jsonRPCResponse);
      } else {
        throw new Error(`Odoo API error: ${response.status}`);
      }
    });
  }

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;

    // Verificar que las variables de entorno estén configuradas
    if (!this.url || !this.db || !this.username || !this.password) {
      throw new Error("Variables de entorno de Odoo no configuradas. Verifique ODOO_URL, ODOO_DATABASE, ODOO_USERNAME, ODOO_PASSWORD");
    }

    try {
      console.log(`🔐 Intentando autenticar en Odoo: ${this.url}/jsonrpc`);
      console.log(`📊 Base de datos: ${this.db}, Usuario: ${this.username}`);
      
      const result = await this.client.request("call", {
        service: "common",
        method: "authenticate",
        args: [this.db, this.username, this.password, {}],
      });

      if (typeof result !== 'number' || result === 0) {
        throw new Error("Autenticación fallida: credenciales inválidas o usuario no autorizado");
      }

      this.uid = result as number;
      console.log("✅ Autenticado en Odoo con UID:", this.uid);
      return this.uid;
    } catch (error: any) {
      console.error("❌ Error de autenticación en Odoo:", error);
      
      if (error.message?.includes('fetch')) {
        throw new Error(`No se pudo conectar con Odoo en ${this.url}. Verifique la URL y que el servidor esté ejecutándose.`);
      }
      
      throw new Error(`Error de autenticación: ${error.message || 'Credenciales inválidas'}`);
    }
  }

  async searchRead(
    model: string,
    domain: any[] = [],
    fields: string[] = [],
    limit: number = 10
  ): Promise<any[]> {
    await this.authenticate();

    return await this.client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        this.db,
        this.uid,
        this.password,
        model,
        "search_read",
        [domain],
        { fields, limit },
      ],
    }) as any[];
  }

  async create(model: string, values: any): Promise<number> {
    await this.authenticate();

    return await this.client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        this.db,
        this.uid,
        this.password,
        model,
        "create",
        [values],
      ],
    }) as number;
  }

  async update(model: string, id: number, values: any): Promise<boolean> {
    await this.authenticate();

    return await this.client.request("call", {
      service: "object",
      method: "execute_kw",
      args: [
        this.db,
        this.uid,
        this.password,
        model,
        "write",
        [[id], values],
      ],
    }) as boolean;
  }

  async getProductPrice(productId: number, quantity: number = 1, partnerId?: number): Promise<number> {
    await this.authenticate();

    try {
      // Método alternativo: obtener precio directamente del producto
      const product = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.db,
          this.uid,
          this.password,
          "product.template",
          "read",
          [[productId]],
          { fields: ["list_price", "currency_id"] }
        ],
      }) as any[];

      if (product.length === 0) {
        console.warn(`⚠️ Producto ${productId} no encontrado`);
        return 0;
      }

      const productData = product[0];
      const price = productData.list_price || 0;

      console.log(`💰 Precio obtenido para producto ${productId}: $${price}`);
      return price;
    } catch (error: any) {
      console.error(`❌ Error obteniendo precio para producto ${productId}:`, error);
      return 0;
    }
  }

  async getProductsPrice(productIds: number[], quantity: number = 1, partnerId?: number): Promise<Record<number, number>> {
    await this.authenticate();

    try {
      // Método alternativo: obtener precios directamente de los productos
      const products = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.db,
          this.uid,
          this.password,
          "product.template",
          "read",
          [productIds],
          { fields: ["id", "list_price", "currency_id"] }
        ],
      }) as any[];

      const prices: Record<number, number> = {};
      
      products.forEach(product => {
        prices[product.id] = product.list_price || 0;
      });

      console.log(`💰 Precios obtenidos para ${products.length} productos`);
      return prices;
    } catch (error: any) {
      console.error(`❌ Error obteniendo precios para productos:`, error);
      return {};
    }
  }

  /**
   * Obtener niveles de stock de un producto en Odoo
   * @param productId ID del producto en Odoo (product.product, no product.template)
   * @returns Objeto con información de stock
   */
  async getProductStock(productId: number): Promise<{
    qty_available: number;
    virtual_available: number;
    incoming_qty: number;
    outgoing_qty: number;
  }> {
    await this.authenticate();

    try {
      const products = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.db,
          this.uid,
          this.password,
          "product.product",
          "read",
          [[productId]],
          { fields: ["qty_available", "virtual_available", "incoming_qty", "outgoing_qty"] }
        ],
      }) as any[];

      if (products.length === 0) {
        console.warn(`⚠️ Producto ${productId} no encontrado en Odoo`);
        return {
          qty_available: 0,
          virtual_available: 0,
          incoming_qty: 0,
          outgoing_qty: 0
        };
      }

      const stock = products[0];
      console.log(`📦 Stock obtenido para producto ${productId}:`, {
        disponible: stock.qty_available,
        virtual: stock.virtual_available,
        entrante: stock.incoming_qty,
        saliente: stock.outgoing_qty
      });

      return {
        qty_available: stock.qty_available || 0,
        virtual_available: stock.virtual_available || 0,
        incoming_qty: stock.incoming_qty || 0,
        outgoing_qty: stock.outgoing_qty || 0
      };
    } catch (error: any) {
      console.error(`❌ Error obteniendo stock para producto ${productId}:`, error);
      return {
        qty_available: 0,
        virtual_available: 0,
        incoming_qty: 0,
        outgoing_qty: 0
      };
    }
  }

  /**
   * Obtener stock de múltiples productos por SKU
   * @param skus Array de SKUs
   * @returns Map de SKU a información de stock
   */
  async getProductsStockBySku(skus: string[]): Promise<Map<string, {
    qty_available: number;
    virtual_available: number;
    product_id: number;
  }>> {
    await this.authenticate();

    try {
      // Buscar productos por SKU (default_code en Odoo)
      const products = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.db,
          this.uid,
          this.password,
          "product.product",
          "search_read",
          [[["default_code", "in", skus]]],
          { fields: ["id", "default_code", "qty_available", "virtual_available"] }
        ],
      }) as any[];

      const stockMap = new Map<string, { qty_available: number; virtual_available: number; product_id: number }>();
      
      products.forEach(product => {
        if (product.default_code) {
          stockMap.set(product.default_code, {
            qty_available: product.qty_available || 0,
            virtual_available: product.virtual_available || 0,
            product_id: product.id
          });
        }
      });

      console.log(`📦 Stock obtenido para ${stockMap.size} productos de ${skus.length} solicitados`);
      return stockMap;
    } catch (error: any) {
      console.error(`❌ Error obteniendo stock de productos por SKU:`, error);
      return new Map();
    }
  }

  /**
   * Crear movimiento de stock en Odoo (para registrar ventas desde Medusa)
   * @param productId ID del producto en Odoo
   * @param quantity Cantidad vendida (positivo)
   * @param reference Referencia del pedido
   */
  async createStockMove(productId: number, quantity: number, reference: string): Promise<boolean> {
    await this.authenticate();

    try {
      // Obtener ubicaciones predeterminadas
      const stockLocationId = await this.getWarehouseLocation();
      const customerLocationId = await this.getCustomerLocation();

      if (!stockLocationId || !customerLocationId) {
        console.error("❌ No se pudieron obtener ubicaciones de stock");
        return false;
      }

      // Crear movimiento de stock
      const moveId = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.db,
          this.uid,
          this.password,
          "stock.move",
          "create",
          [{
            name: `Venta Medusa: ${reference}`,
            product_id: productId,
            product_uom_qty: quantity,
            product_uom: 1, // Unidad de medida (1 = Units)
            location_id: stockLocationId,
            location_dest_id: customerLocationId,
            state: "done",
            reference: reference
          }]
        ],
      }) as number;

      console.log(`✅ Movimiento de stock creado en Odoo: ${moveId} para ${quantity} unidades del producto ${productId}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error creando movimiento de stock:`, error);
      return false;
    }
  }

  /**
   * Obtener ID de ubicación de almacén
   */
  private async getWarehouseLocation(): Promise<number | null> {
    try {
      const locations = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.db,
          this.uid,
          this.password,
          "stock.location",
          "search",
          [[["usage", "=", "internal"]]],
          { limit: 1 }
        ],
      }) as number[];

      return locations[0] || null;
    } catch (error: any) {
      console.error(`❌ Error obteniendo ubicación de almacén:`, error);
      return null;
    }
  }

  /**
   * Obtener ID de ubicación de clientes
   */
  private async getCustomerLocation(): Promise<number | null> {
    try {
      const locations = await this.client.request("call", {
        service: "object",
        method: "execute_kw",
        args: [
          this.db,
          this.uid,
          this.password,
          "stock.location",
          "search",
          [[["usage", "=", "customer"]]],
          { limit: 1 }
        ],
      }) as number[];

      return locations[0] || null;
    } catch (error: any) {
      console.error(`❌ Error obteniendo ubicación de clientes:`, error);
      return null;
    }
  }
}

export const odooClient = new OdooClient();