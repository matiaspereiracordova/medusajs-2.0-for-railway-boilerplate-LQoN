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
  code?: string
  list_price: number
  currency_id: [number, string]
  type: string
  product_template_variant_value_ids: Array<{
    attribute_id: [number, string]
    name: string
  }>
  product_variant_ids: Array<{
    id: number
    name: string
    code?: string
    list_price: number
    currency_id: [number, string]
    product_template_variant_value_ids: Array<{
      attribute_id: [number, string]
      name: string
    }>
  }>
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

    this.client = new JSONRPCClient((jsonRPCRequest) => {
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
            "code",
            "list_price",
            "currency_id",
            "type",
            "product_template_variant_value_ids",
            "product_variant_ids",
          ],
          offset,
          limit,
        },
      ],
    })
  }

  async createProduct(productData: any): Promise<number> {
    await this.login()

    return await this.client.request("call", {
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
  }

  async updateProduct(productId: number, productData: any): Promise<boolean> {
    await this.login()

    return await this.client.request("call", {
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
            "code",
            "list_price",
            "currency_id",
            "type",
            "product_template_variant_value_ids",
            "product_variant_ids",
          ],
        },
      ],
    })
  }
}
