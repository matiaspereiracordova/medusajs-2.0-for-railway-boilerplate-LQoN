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
  
  // Verificar si ya existen productos (pero permitir forzar seed con variable de entorno)
  const forceSeed = process.env.FORCE_SEED === 'true';
  const existingProducts = await query.graph({
    entity: "product",
    fields: ["id", "title"],
  });
  
  if (existingProducts.data && existingProducts.data.length > 0 && !forceSeed) {
    logger.info(`Found ${existingProducts.data.length} existing products, skipping product creation`);
    logger.info(`To force seed execution, set FORCE_SEED=true environment variable`);
    return;
  }
  
  if (forceSeed && existingProducts.data && existingProducts.data.length > 0) {
    logger.warn(`⚠️ FORCE_SEED is true, but ${existingProducts.data.length} products already exist!`);
    logger.warn(`⚠️ This will create duplicate products. Consider deleting existing products first.`);
    logger.warn(`⚠️ Proceeding in 5 seconds... Press Ctrl+C to cancel.`);
    await new Promise(resolve => setTimeout(resolve, 5000));
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

  // Función helper para generar precio aleatorio en CLP
  const randomPrice = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
  };

  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        // PERRO - Comida
        {
          title: "Champion Dog Adulto",
          category_ids: [categoryResult.find((cat) => cat.name === "Comida Seca" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Alimento balanceado para perros adultos con proteínas de alta calidad.",
          handle: "champion-dog-adulto",
          weight: 3000,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/4CAF50/FFFFFF?text=Champion+Dog"}],
          variants: [{
            title: "3kg",
            sku: "DOG-COMIDA-SECA-001",
            prices: [{amount: randomPrice(15000, 35000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 25, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Pedigree Pouch Carne",
          category_ids: [categoryResult.find((cat) => cat.name === "Comida Húmeda" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Comida húmeda en sobre con trozos de carne en salsa.",
          handle: "pedigree-pouch-carne",
          weight: 100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/FF9800/FFFFFF?text=Pedigree+Pouch"}],
          variants: [{
            title: "100g",
            sku: "DOG-COMIDA-HUMEDA-001",
            prices: [{amount: randomPrice(1500, 3500), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 3, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Hills Prescription Diet i/d",
          category_ids: [categoryResult.find((cat) => cat.name === "Comida Medicada" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Alimento veterinario para problemas digestivos en perros.",
          handle: "hills-prescription-id",
          weight: 8000,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/2196F3/FFFFFF?text=Hills+i/d"}],
          variants: [{
            title: "8kg",
            sku: "DOG-COMIDA-MED-001",
            prices: [{amount: randomPrice(45000, 75000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 68, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Royal Canin Hypoallergenic",
          category_ids: [categoryResult.find((cat) => cat.name === "Dietas Especiales" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Dieta hipoalergénica para perros con sensibilidades alimentarias.",
          handle: "royal-canin-hypoallergenic",
          weight: 7500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/9C27B0/FFFFFF?text=RC+Hypo"}],
          variants: [{
            title: "7.5kg",
            sku: "DOG-DIETA-ESP-001",
            prices: [{amount: randomPrice(55000, 85000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 78, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },

        // PERRO - Snacks y Premios
        {
          title: "Bully Stick Natural 12\"",
          category_ids: [categoryResult.find((cat) => cat.name === "Huesos, Bully Sticks / Naturales")!.id],
          description: "Bully stick 100% natural, ideal para limpieza dental.",
          handle: "bully-stick-12",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/795548/FFFFFF?text=Bully+Stick"}],
          variants: [{
            title: "12 pulgadas",
            sku: "DOG-SNACK-BULLY-001",
            prices: [{amount: randomPrice(3500, 7500), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 6, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Tiras de Pollo Deshidratado",
          category_ids: [categoryResult.find((cat) => cat.name === "Carne / Naturales")!.id],
          description: "Tiras de pechuga de pollo 100% natural deshidratado.",
          handle: "tiras-pollo-deshidratado",
          weight: 200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/FF5722/FFFFFF?text=Pollo+Seco"}],
          variants: [{
            title: "200g",
            sku: "DOG-SNACK-CARNE-001",
            prices: [{amount: randomPrice(4500, 9500), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 8, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Freeze Dried Beef Treats",
          category_ids: [categoryResult.find((cat) => cat.name === "Congelados en Seco / Naturales")!.id],
          description: "Premios de carne liofilizada, conservan todos los nutrientes.",
          handle: "freeze-dried-beef",
          weight: 100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/E91E63/FFFFFF?text=Freeze+Dried"}],
          variants: [{
            title: "100g",
            sku: "DOG-SNACK-FREEZE-001",
            prices: [{amount: randomPrice(8500, 15000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 13, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Premios Blandos Sabor Bacon",
          category_ids: [categoryResult.find((cat) => cat.name === "Blandos y Masticables")!.id],
          description: "Premios suaves ideales para entrenamiento, sabor bacon.",
          handle: "premios-blandos-bacon",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/FFC107/FFFFFF?text=Bacon+Treats"}],
          variants: [{
            title: "300g",
            sku: "DOG-SNACK-BLANDO-001",
            prices: [{amount: randomPrice(5500, 12000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 10, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Galletas Croquetas Mix",
          category_ids: [categoryResult.find((cat) => cat.name === "Galletas")!.id],
          description: "Mix de galletas crujientes con diferentes sabores.",
          handle: "galletas-croquetas-mix",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/CDDC39/FFFFFF?text=Galletas"}],
          variants: [{
            title: "500g",
            sku: "DOG-SNACK-GALLETA-001",
            prices: [{amount: randomPrice(4000, 8500), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 7, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Hueso de Nylon Larga Duración",
          category_ids: [categoryResult.find((cat) => cat.name === "Larga Duración")!.id],
          description: "Hueso sintético ultra resistente para perros masticadores intensos.",
          handle: "hueso-nylon-larga-duracion",
          weight: 250,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/607D8B/FFFFFF?text=Nylon+Bone"}],
          variants: [{
            title: "Grande",
            sku: "DOG-SNACK-LARGA-001",
            prices: [{amount: randomPrice(8000, 16000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 14, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Dental Sticks Menta",
          category_ids: [categoryResult.find((cat) => cat.name === "Higiene Dental")!.id],
          description: "Sticks dentales con sabor menta para limpieza y frescura.",
          handle: "dental-sticks-menta",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/00BCD4/FFFFFF?text=Dental+Sticks"}],
          variants: [{
            title: "Pack 28 unidades",
            sku: "DOG-SNACK-DENTAL-001",
            prices: [{amount: randomPrice(10000, 18000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 16, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },

        // PERRO - Juguetes
        {
          title: "Cuerda Algodón Multicolor",
          category_ids: [categoryResult.find((cat) => cat.name === "Morder y Tirar")!.id],
          description: "Cuerda resistente de algodón para juegos de tira y afloja.",
          handle: "cuerda-algodon-multicolor",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/FF6F00/FFFFFF?text=Rope+Toy"}],
          variants: [{
            title: "Mediano",
            sku: "DOG-JUG-MORDER-001",
            prices: [{amount: randomPrice(5500, 12000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 10, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Peluche Pato con Sonido",
          category_ids: [categoryResult.find((cat) => cat.name === "Peluches")!.id],
          description: "Peluche suave de pato con squeaker interno.",
          handle: "peluche-pato-sonido",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/FDD835/FFFFFF?text=Duck+Plush"}],
          variants: [{
            title: "Mediano",
            sku: "DOG-JUG-PELUCHE-001",
            prices: [{amount: randomPrice(6500, 14000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 12, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Pelota Tenis con Rebote",
          category_ids: [categoryResult.find((cat) => cat.name === "Juguetes para Recuperar")!.id],
          description: "Pelota de tenis de alta calidad para juegos de fetch.",
          handle: "pelota-tenis-rebote",
          weight: 60,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/8BC34A/FFFFFF?text=Tennis+Ball"}],
          variants: [{
            title: "Pack 3 unidades",
            sku: "DOG-JUG-RECUPERAR-001",
            prices: [{amount: randomPrice(4500, 9500), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 8, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Kong Classic Rojo",
          category_ids: [categoryResult.find((cat) => cat.name === "Dispensadores de Premios")!.id],
          description: "Kong clásico rellenable para mantener entretenido a tu perro.",
          handle: "kong-classic-rojo",
          weight: 200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/F44336/FFFFFF?text=Kong"}],
          variants: [{
            title: "Mediano",
            sku: "DOG-JUG-KONG-001",
            prices: [{amount: randomPrice(12000, 22000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 20, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Puzzle Interactivo Nivel 2",
          category_ids: [categoryResult.find((cat) => cat.name === "Rompecabezas")!.id],
          description: "Juego mental para estimular la inteligencia canina.",
          handle: "puzzle-interactivo-nivel-2",
          weight: 800,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/3F51B5/FFFFFF?text=Puzzle"}],
          variants: [{
            title: "Nivel 2",
            sku: "DOG-JUG-PUZZLE-001",
            prices: [{amount: randomPrice(15000, 28000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 25, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },

        // PERRO - Accesorios
        {
          title: "Cama Espuma Viscoelástica",
          category_ids: [categoryResult.find((cat) => cat.name === "Camas" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Cama ortopédica con espuma de memoria para máximo confort.",
          handle: "cama-espuma-viscoelastica",
          weight: 2500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/795548/FFFFFF?text=Dog+Bed"}],
          variants: [{
            title: "Grande",
            sku: "DOG-ACC-CAMA-001",
            prices: [{amount: randomPrice(35000, 65000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 58, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Bowl Acero Inoxidable Antideslizante",
          category_ids: [categoryResult.find((cat) => cat.name === "Platos, Bowls" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Plato de acero inoxidable con base de goma antideslizante.",
          handle: "bowl-acero-antideslizante",
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/9E9E9E/FFFFFF?text=Steel+Bowl"}],
          variants: [{
            title: "1.5L",
            sku: "DOG-ACC-BOWL-001",
            prices: [{amount: randomPrice(8500, 16000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 14, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Correa Retráctil 5 metros",
          category_ids: [categoryResult.find((cat) => cat.name === "Correas")!.id],
          description: "Correa extensible hasta 5 metros con sistema de frenado.",
          handle: "correa-retractil-5m",
          weight: 350,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/424242/FFFFFF?text=Leash"}],
          variants: [{
            title: "Hasta 25kg",
            sku: "DOG-ACC-CORREA-001",
            prices: [{amount: randomPrice(12000, 22000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 20, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Arnés Acolchado Reflectante",
          category_ids: [categoryResult.find((cat) => cat.name === "Collares y Arneses")!.id],
          description: "Arnés ergonómico con detalles reflectantes para seguridad nocturna.",
          handle: "arnes-acolchado-reflectante",
          weight: 250,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/FF9800/FFFFFF?text=Harness"}],
          variants: [{
            title: "Mediano",
            sku: "DOG-ACC-ARNES-001",
            prices: [{amount: randomPrice(15000, 28000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 25, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Clicker de Entrenamiento",
          category_ids: [categoryResult.find((cat) => cat.name === "Adiestramiento")!.id],
          description: "Clicker profesional para refuerzo positivo en entrenamiento.",
          handle: "clicker-entrenamiento",
          weight: 30,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/4CAF50/FFFFFF?text=Clicker"}],
          variants: [{
            title: "Unidad",
            sku: "DOG-ACC-CLICKER-001",
            prices: [{amount: randomPrice(3500, 7500), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 6, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Jaula Plegable 2 Puertas",
          category_ids: [categoryResult.find((cat) => cat.name === "Recintos, Jaulas, Transporte" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Jaula metálica plegable con bandeja extraíble.",
          handle: "jaula-plegable-2-puertas",
          weight: 8000,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/546E7A/FFFFFF?text=Crate"}],
          variants: [{
            title: "Mediana (76cm)",
            sku: "DOG-ACC-JAULA-001",
            prices: [{amount: randomPrice(45000, 75000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 68, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },

        // PERRO - Higiene y Baño
        {
          title: "Toallitas Húmedas Biodegradables",
          category_ids: [categoryResult.find((cat) => cat.name === "Toallitas limpieza" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Toallitas hipoalergénicas para limpieza rápida de patas y pelaje.",
          handle: "toallitas-biodegradables",
          weight: 200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/00BCD4/FFFFFF?text=Wipes"}],
          variants: [{
            title: "Pack 100 unidades",
            sku: "DOG-HIG-TOALLITA-001",
            prices: [{amount: randomPrice(6500, 12000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 10, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Pads de Entrenamiento Super Absorbentes",
          category_ids: [categoryResult.find((cat) => cat.name === "Pads de entrenamiento")!.id],
          description: "Pañales de entrenamiento con 5 capas ultra absorbentes.",
          handle: "pads-super-absorbentes",
          weight: 1500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/B39DDB/FFFFFF?text=Training+Pads"}],
          variants: [{
            title: "Pack 50 unidades",
            sku: "DOG-HIG-PAD-001",
            prices: [{amount: randomPrice(18000, 32000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 28, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Bolsas Biodegradables con Dispensador",
          category_ids: [categoryResult.find((cat) => cat.name === "Bolsas")!.id],
          description: "Bolsas ecológicas para desechos con dispensador de clip.",
          handle: "bolsas-biodegradables-dispensador",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/66BB6A/FFFFFF?text=Poop+Bags"}],
          variants: [{
            title: "240 bolsas",
            sku: "DOG-HIG-BOLSA-001",
            prices: [{amount: randomPrice(8500, 15000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 13, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Pañales Desechables Talla M",
          category_ids: [categoryResult.find((cat) => cat.name === "Pañales")!.id],
          description: "Pañales desechables para incontinencia o hembras en celo.",
          handle: "panales-desechables-m",
          weight: 800,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/AB47BC/FFFFFF?text=Diapers"}],
          variants: [{
            title: "Pack 12 unidades",
            sku: "DOG-HIG-PANAL-001",
            prices: [{amount: randomPrice(9500, 17000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 15, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },

        // PERRO - Peluquería
        {
          title: "Cepillo Slicker Profesional",
          category_ids: [categoryResult.find((cat) => cat.name === "Cepillos" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Cepillo de cerdas finas para desenredar y eliminar pelo muerto.",
          handle: "cepillo-slicker-profesional",
          weight: 150,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/26A69A/FFFFFF?text=Slicker"}],
          variants: [{
            title: "Mediano",
            sku: "DOG-PEL-CEPILLO-001",
            prices: [{amount: randomPrice(8500, 16000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 14, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Shampoo Hipoalergénico Avena",
          category_ids: [categoryResult.find((cat) => cat.name === "Shampoos y Acondicionadores" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Shampoo suave con extracto de avena para pieles sensibles.",
          handle: "shampoo-hipoalergenico-avena",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/42A5F5/FFFFFF?text=Shampoo"}],
          variants: [{
            title: "500ml",
            sku: "DOG-PEL-SHAMPOO-001",
            prices: [{amount: randomPrice(12000, 22000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 20, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Cortaúñas Guillotina",
          category_ids: [categoryResult.find((cat) => cat.name === "Corta Uñas y Herramientas" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Cortaúñas tipo guillotina con mango ergonómico.",
          handle: "cortaunas-guillotina",
          weight: 100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/78909C/FFFFFF?text=Nail+Clipper"}],
          variants: [{
            title: "Mediano-Grande",
            sku: "DOG-PEL-CORTA-001",
            prices: [{amount: randomPrice(8500, 15000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 13, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Crema Almohadillas Reparadora",
          category_ids: [categoryResult.find((cat) => cat.name === "Skin Care" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Crema hidratante y reparadora para almohadillas agrietadas.",
          handle: "crema-almohadillas-reparadora",
          weight: 75,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/EC407A/FFFFFF?text=Paw+Balm"}],
          variants: [{
            title: "75ml",
            sku: "DOG-PEL-SKIN-001",
            prices: [{amount: randomPrice(9500, 17000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 15, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },

        // PERRO - Farmacia
        {
          title: "Pipeta Antipulgas Frontline",
          category_ids: [categoryResult.find((cat) => cat.name === "Pulgas y Garrapatas" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Pipeta antiparasitaria de acción rápida y prolongada.",
          handle: "pipeta-frontline",
          weight: 50,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/D32F2F/FFFFFF?text=Frontline"}],
          variants: [{
            title: "10-20kg",
            sku: "DOG-FARM-PULGAS-001",
            prices: [{amount: randomPrice(15000, 25000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 22, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Multivitamínico Canino Completo",
          category_ids: [categoryResult.find((cat) => cat.name === "Vitaminas y Suplementos" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Suplemento vitamínico completo para todas las edades.",
          handle: "multivitaminico-canino",
          weight: 200,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/43A047/FFFFFF?text=Vitamins"}],
          variants: [{
            title: "60 tabletas",
            sku: "DOG-FARM-VIT-001",
            prices: [{amount: randomPrice(18000, 32000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 28, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Spray Anti-Picazón Aloe Vera",
          category_ids: [categoryResult.find((cat) => cat.name === "Alergias y Picazón" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Spray calmante con aloe vera para alivio inmediato de picazón.",
          handle: "spray-anti-picazon",
          weight: 250,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/7CB342/FFFFFF?text=Anti-Itch"}],
          variants: [{
            title: "250ml",
            sku: "DOG-FARM-ALERGIA-001",
            prices: [{amount: randomPrice(12000, 20000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 18, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Chaleco Refrescante Talla M",
          category_ids: [categoryResult.find((cat) => cat.name === "Control de Temperatura" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Chaleco con tecnología de enfriamiento para días calurosos.",
          handle: "chaleco-refrescante-m",
          weight: 300,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/29B6F6/FFFFFF?text=Cooling+Vest"}],
          variants: [{
            title: "Mediano",
            sku: "DOG-FARM-TEMP-001",
            prices: [{amount: randomPrice(18000, 32000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 28, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
        },
        {
          title: "Antiinflamatorio Meloxicam 2mg",
          category_ids: [categoryResult.find((cat) => cat.name === "Medicamentos" && cat.parent_category_id === mainCategories.find((c) => c.name === "Perro")!.id)!.id],
          description: "Antiinflamatorio veterinario para dolor articular (requiere receta).",
          handle: "meloxicam-2mg",
          weight: 100,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          images: [{url: "https://via.placeholder.com/400x400/EF5350/FFFFFF?text=Meloxicam"}],
          variants: [{
            title: "20 comprimidos",
            sku: "DOG-FARM-MED-001",
            prices: [{amount: randomPrice(22000, 38000), currency_code: CHILEAN_CONFIG.CURRENCY.toLowerCase()}, {amount: 33, currency_code: "usd"}],
          }],
          sales_channels: [{id: defaultSalesChannel[0].id}],
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
      stocked_quantity: 100,
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
