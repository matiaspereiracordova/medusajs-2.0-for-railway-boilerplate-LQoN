import { JSONRPCClient } from "json-rpc-2.0";

export class OdooClient {
  private client: JSONRPCClient;
  private url: string;
  private db: string;
  private username: string;
  private password: string;
  private uid: number | null = null;

  constructor() {
    this.url = process.env.ODOO_URL || "";
    this.db = process.env.ODOO_DATABASE || "";
    this.username = process.env.ODOO_USERNAME || "";
    this.password = process.env.ODOO_PASSWORD || "";

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

    try {
      const result = await this.client.request("call", {
        service: "common",
        method: "authenticate",
        args: [this.db, this.username, this.password, {}],
      });

      this.uid = result as number;
      console.log("✅ Autenticado en Odoo con UID:", this.uid);
      return this.uid;
    } catch (error) {
      console.error("❌ Error de autenticación en Odoo:", error);
      throw error;
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