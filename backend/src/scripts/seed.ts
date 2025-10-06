import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { CHILEAN_CONFIG } from "../lib/constants";

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  // Chilean configuration
  const countries = [CHILEAN_CONFIG.COUNTRY_CODE.toLowerCase()];

  logger.info("Seeding Chilean pet store data...");
  const [store] = await storeModuleService.listStores();
  
  // Verificar si ya existen productos
  const existingProducts = await query.graph({
    entity: "product",
    fields: ["id", "title"],
  });
  
  if (existingProducts.data && existingProducts.data.length > 0) {
    logger.info(`Found ${existingProducts.data.length} existing products, skipping product creation`);
    return;
  }
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          {
            currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
            is_default: true,
          },
          {
            currency_code: "usd",
          },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  
  logger.info("Seeding Chilean region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Chile",
          currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding Chilean regions.");

  logger.info("Seeding Chilean tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system"
    })),
  });
  logger.info("Finished seeding Chilean tax regions.");

  logger.info("Seeding Chilean stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Chilean Pet Warehouse",
          address: {
            city: "Santiago",
            country_code: CHILEAN_CONFIG.COUNTRY_CODE,
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding Chilean fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default"
  })
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
    await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Default Shipping Profile",
            type: "default",
          },
        ],
      },
    });
    shippingProfile = shippingProfileResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Chilean Pet Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Chile",
        geo_zones: [
          {
            country_code: CHILEAN_CONFIG.COUNTRY_CODE.toLowerCase(),
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Envío Estándar",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Estándar",
          description: "Entrega en 3-5 días hábiles.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
            amount: 10000, // ~$10 USD in CLP
          },
          {
            region_id: region.id,
            amount: 10000,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Envío Express",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Entrega en 24-48 horas.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 20,
          },
          {
            currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
            amount: 20000, // ~$20 USD in CLP
          },
          {
            region_id: region.id,
            amount: 20000,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding Chilean fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding Chilean stock location data.");

  logger.info("Seeding publishable API key data...");
  const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
    container
  ).run({
    input: {
      api_keys: [
        {
          title: "Webshop",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });
  const publishableApiKey = publishableApiKeyResult[0];

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding Chilean pet product categories...");

  // Crear categorías principales primero
  const { result: mainCategories } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Perro",
          is_active: true,
        },
        {
          name: "Gato",
          is_active: true,
        },
      ],
    },
  });

  // Crear subcategorías para Perros
  const { result: perroSubCategories } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        // Perro - Comida
        {
          name: "Comida Seca",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Comida Húmeda",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Comida Medicada",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Dietas Especiales",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        // Perro - Snacks y Premios
        {
          name: "Huesos, Bully Sticks / Naturales",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Carne / Naturales",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Congelados en Seco / Naturales",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Blandos y Masticables",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Galletas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Larga Duración",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Higiene Dental",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        // Perro - Juguetes
        {
          name: "Morder y Tirar",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Peluches",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Juguetes para Recuperar",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Dispensadores de Premios",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Rompecabezas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        // Perro - Accesorios
        {
          name: "Camas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Platos, Bowls",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Correas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Collares y Arneses",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Adiestramiento",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Recintos, Jaulas, Transporte",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        // Perro - Higiene y Baño
        {
          name: "Toallitas limpieza",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Pads de entrenamiento",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Bolsas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Pañales",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        // Perro - Peluquería
        {
          name: "Cepillos",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Shampoos y Acondicionadores",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Corta Uñas y Herramientas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Skin Care",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        // Perro - Farmacia
        {
          name: "Pulgas y Garrapatas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Vitaminas y Suplementos",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Alergias y Picazón",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Control de Temperatura",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
        {
          name: "Medicamentos",
          parent_category_id: mainCategories.find((cat) => cat.name === "Perro")!.id,
          is_active: true,
        },
      ],
    },
  });

  // Crear subcategorías para Gatos
  const { result: gatoSubCategories } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        // Gato - Comida
        {
          name: "Comida Seca",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Comida Húmeda",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Comida Medicada",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Dietas Especiales",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        // Gato - Higiene y Baño
        {
          name: "Arena",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Toallitas limpieza",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        // Gato - Snacks y Premios
        {
          name: "Blandos y Masticables",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Crujientes",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Hierba Gatera",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        // Gato - Árboles, Casas y Rascadores
        {
          name: "Árboles y Casas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Rascadores",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        // Gato - Juguetes
        {
          name: "Interactivos",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Catnip",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Varitas y Pelotas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Peluches",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        // Gato - Accesorios
        {
          name: "Cajas Arena",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Camas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Collares y Arneses",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Recintos, Jaulas, Transporte",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Platos, Bowls",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        // Gato - Peluquería
        {
          name: "Cepillos",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Shampoos y Acondicionadores",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Corta Uñas y Herramientas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Skin Care",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        // Gato - Farmacia
        {
          name: "Pulgas y Garrapatas",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Vitaminas y Suplementos",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Alergias y Picazón",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Control de Temperatura",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
        {
          name: "Medicamentos",
          parent_category_id: mainCategories.find((cat) => cat.name === "Gato")!.id,
          is_active: true,
        },
      ],
    },
  });

  // Combinar todas las categorías
  const categoryResult = [...mainCategories, ...perroSubCategories, ...gatoSubCategories];

  logger.info("Seeding Chilean pet products...");

  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        // Producto ejemplo: Comida Seca para Perros
        {
          title: "Royal Canin Adulto Mediano",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Comida Seca")!.id,
          ],
          description:
            "Alimento completo para perros adultos de razas medianas. Formulado con proteínas de alta calidad y nutrientes esenciales para mantener la salud óptima de tu mascota.",
          handle: "royal-canin-adulto-mediano",
          weight: 15000, // 15kg
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://via.placeholder.com/400x400/4CAF50/FFFFFF?text=Royal+Canin+Adulto",
            },
          ],
          options: [
            {
              title: "Peso",
              values: ["3kg", "7.5kg", "15kg", "30kg"],
            },
          ],
          variants: [
            {
              title: "3kg",
              sku: "ROYAL-CANIN-ADULTO-3KG",
              options: {
                Peso: "3kg",
              },
              prices: [
                {
                  amount: 25000, // $25,000 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 25,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "7.5kg",
              sku: "ROYAL-CANIN-ADULTO-7.5KG",
              options: {
                Peso: "7.5kg",
              },
              prices: [
                {
                  amount: 55000, // $55,000 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 55,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "15kg",
              sku: "ROYAL-CANIN-ADULTO-15KG",
              options: {
                Peso: "15kg",
              },
              prices: [
                {
                  amount: 95000, // $95,000 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 95,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        // Producto ejemplo: Comida Húmeda para Perros
        {
          title: "Pedigree Carne en Salsa",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Comida Húmeda")!.id,
          ],
          description:
            "Comida húmeda para perros adultos con carne en salsa. Rica en proteínas y vitaminas esenciales para una alimentación completa y balanceada.",
          handle: "pedigree-carne-salsa",
          weight: 400, // 400g
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://via.placeholder.com/400x400/FF9800/FFFFFF?text=Pedigree+Carne",
            },
          ],
          options: [
            {
              title: "Sabor",
              values: ["Carne", "Pollo", "Pavo", "Cordero"],
            },
          ],
          variants: [
            {
              title: "Carne",
              sku: "PEDIGREE-CARNE-400G",
              options: {
                Sabor: "Carne",
              },
              prices: [
                {
                  amount: 3500, // $3,500 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 3.5,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Pollo",
              sku: "PEDIGREE-POLLO-400G",
              options: {
                Sabor: "Pollo",
              },
              prices: [
                {
                  amount: 3500,
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 3.5,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        // Producto ejemplo: Comida Seca para Gatos
        {
          title: "Whiskas Adulto",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Comida Seca" && cat.parent_category_id === mainCategories.find((cat) => cat.name === "Gato")!.id)!.id,
          ],
          description:
            "Alimento completo para gatos adultos. Formulado con proteínas de alta calidad y nutrientes esenciales para mantener la salud y vitalidad de tu gato.",
          handle: "whiskas-adulto",
          weight: 3200, // 3.2kg
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://via.placeholder.com/400x400/9C27B0/FFFFFF?text=Whiskas+Adulto",
            },
          ],
          options: [
            {
              title: "Peso",
              values: ["1kg", "3.2kg", "10kg"],
            },
          ],
          variants: [
            {
              title: "1kg",
              sku: "WHISKAS-ADULTO-1KG",
              options: {
                Peso: "1kg",
              },
              prices: [
                {
                  amount: 8500, // $8,500 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 8.5,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "3.2kg",
              sku: "WHISKAS-ADULTO-3.2KG",
              options: {
                Peso: "3.2kg",
              },
              prices: [
                {
                  amount: 22000, // $22,000 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 22,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        // Producto ejemplo: Arena para Gatos
        {
          title: "Arena Sanitaria Premium",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Arena")!.id,
          ],
          description:
            "Arena sanitaria premium con control de olores. Absorbente y fácil de limpiar. Ideal para mantener la higiene de tu gato.",
          handle: "arena-sanitaria-premium",
          weight: 10000, // 10kg
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://via.placeholder.com/400x400/607D8B/FFFFFF?text=Arena+Premium",
            },
          ],
          options: [
            {
              title: "Peso",
              values: ["4kg", "10kg", "20kg"],
            },
          ],
          variants: [
            {
              title: "4kg",
              sku: "ARENA-PREMIUM-4KG",
              options: {
                Peso: "4kg",
              },
              prices: [
                {
                  amount: 12000, // $12,000 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 12,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "10kg",
              sku: "ARENA-PREMIUM-10KG",
              options: {
                Peso: "10kg",
              },
              prices: [
                {
                  amount: 25000, // $25,000 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 25,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        // Producto ejemplo: Juguete para Perros
        {
          title: "Pelota de Caucho Natural",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Morder y Tirar")!.id,
          ],
          description:
            "Pelota de caucho natural resistente para perros. Ideal para jugar, morder y hacer ejercicio. Fácil de limpiar y duradera.",
          handle: "pelota-caucho-natural",
          weight: 200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://via.placeholder.com/400x400/E91E63/FFFFFF?text=Pelota+Caucho",
            },
          ],
          options: [
            {
              title: "Tamaño",
              values: ["Pequeña", "Mediana", "Grande"],
            },
          ],
          variants: [
            {
              title: "Pequeña",
              sku: "PELOTA-CAUCHO-PEQ",
              options: {
                Tamaño: "Pequeña",
              },
              prices: [
                {
                  amount: 8500, // $8,500 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 8.5,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Mediana",
              sku: "PELOTA-CAUCHO-MED",
              options: {
                Tamaño: "Mediana",
              },
              prices: [
                {
                  amount: 12000,
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 12,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        // Producto ejemplo: Cama para Perros
        {
          title: "Cama Ortopédica Premium",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Camas")!.id,
          ],
          description:
            "Cama ortopédica premium para perros de todas las edades. Con memoria viscoelástica y funda desmontable. Ideal para perros con problemas articulares.",
          handle: "cama-ortopedica-premium",
          weight: 2000,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://via.placeholder.com/400x400/795548/FFFFFF?text=Cama+Ortopedica",
            },
          ],
          options: [
            {
              title: "Tamaño",
              values: ["S", "M", "L", "XL"],
            },
          ],
          variants: [
            {
              title: "S (40x30cm)",
              sku: "CAMA-ORTO-S",
              options: {
                Tamaño: "S",
              },
              prices: [
                {
                  amount: 45000, // $45,000 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 45,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M (60x40cm)",
              sku: "CAMA-ORTO-M",
              options: {
                Tamaño: "M",
              },
              prices: [
                {
                  amount: 65000,
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 65,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L (80x50cm)",
              sku: "CAMA-ORTO-L",
              options: {
                Tamaño: "L",
              },
              prices: [
                {
                  amount: 85000,
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 85,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        // Producto ejemplo: Rascador para Gatos
        {
          title: "Rascador Torre Premium",
          category_ids: [
            categoryResult.find((cat) => cat.name === "Rascadores")!.id,
          ],
          description:
            "Rascador torre premium para gatos con múltiples niveles. Incluye plataformas, cuevas y juguetes colgantes. Ideal para gatos activos.",
          handle: "rascador-torre-premium",
          weight: 15000,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [
            {
              url: "https://via.placeholder.com/400x400/8D6E63/FFFFFF?text=Rascador+Torre",
            },
          ],
          options: [
            {
              title: "Altura",
              values: ["120cm", "150cm", "180cm"],
            },
          ],
          variants: [
            {
              title: "120cm",
              sku: "RASCADOR-TORRE-120",
              options: {
                Altura: "120cm",
              },
              prices: [
                {
                  amount: 120000, // $120,000 CLP
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 120,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "150cm",
              sku: "RASCADOR-TORRE-150",
              options: {
                Altura: "150cm",
              },
              prices: [
                {
                  amount: 150000,
                  currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase(),
                },
                {
                  amount: 150,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });
  logger.info("Finished seeding Chilean pet products.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    const inventoryLevel = {
      location_id: stockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    };
    inventoryLevels.push(inventoryLevel);
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info(`✅ Successfully created ${productResult.length} products for Chile`);
  logger.info("🎉 Chilean pet store setup completed!");

  logger.info("Finished seeding inventory levels data.");
  logger.info("🇨🇱 Chilean pet store configuration completed successfully!");
}
