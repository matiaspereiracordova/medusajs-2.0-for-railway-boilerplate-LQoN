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
}

export const odooClient = new OdooClient();