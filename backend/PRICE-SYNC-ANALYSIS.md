# Análisis de Sincronización de Precios MedusaJS ↔ Odoo

## 📚 Documentación Consultada

### Fuentes Oficiales
- [Odoo Documentation - Product Variants](https://www.odoo.com/documentation/16.0/es_419/applications/sales/sales/products_prices/products/variants.html)
- [MedusaJS Documentation - ERP Integration](https://docs.medusajs.com/resources/recipes/erp/odoo)
- [Odoo Documentation - Product Prices](https://www.odoo.com/documentation/18.0/es/applications/sales/sales/products_prices/products/variants.html)

## 🏗️ Arquitectura de Precios

### En Odoo
```
product.template (Producto Principal)
├── list_price (Precio base)
└── product.product (Variantes)
    ├── list_price (Precio específico de variante)
    └── price_extra (Cargo adicional por atributos)

Precio Final = list_price + price_extra
```

### En MedusaJS 2.0
```
Product
├── variants[]
│   ├── prices[] (Múltiples precios por moneda)
│   └── calculated_price (Precio calculado dinámicamente)
└── pricing_module (Manejo de listas de precios)
```

## 🎯 Estrategia de Sincronización

### 1. **Precio Base del Producto** (`product.template.list_price`)
- Usar el precio de la primera variante como precio base
- Priorizar CLP > USD > EUR

### 2. **Precios de Variantes** (`product.product.list_price`)
- Sincronizar precio específico de cada variante
- Mapear por SKU para identificación única

### 3. **Precios Adicionales** (`product.product.price_extra`)
- Calcular diferencia entre precio de variante y precio base
- Aplicar como cargo adicional por atributos

## 🔄 Flujo de Sincronización Propuesto

```
MedusaJS → Odoo
├── 1. Obtener precios de variantes desde MedusaJS
├── 2. Calcular precio base (primera variante)
├── 3. Actualizar product.template.list_price
├── 4. Para cada variante:
│   ├── Buscar variante en Odoo por SKU
│   ├── Actualizar product.product.list_price
│   └── Calcular y actualizar price_extra
└── 5. Verificar sincronización
```

## 📊 Mapeo de Campos

| MedusaJS | Odoo | Descripción |
|----------|------|-------------|
| `variant.prices[].amount` | `product.product.list_price` | Precio específico de variante |
| `variant.prices[0].amount` | `product.template.list_price` | Precio base del producto |
| `variant.prices[].amount - base_price` | `product.product.price_extra` | Cargo adicional por atributos |
| `variant.sku` | `product.product.default_code` | Identificador único |

## 🚀 Implementación

### Métodos Requeridos
1. `syncProductBasePrice()` - Sincronizar precio base
2. `syncVariantSpecificPrices()` - Sincronizar precios de variantes
3. `calculatePriceExtra()` - Calcular cargos adicionales
4. `validatePriceSync()` - Validar sincronización

### Consideraciones
- **Monedas**: Priorizar CLP, fallback a USD/EUR
- **Conversión**: MedusaJS usa centavos, Odoo usa unidades
- **Validación**: Verificar que precios sean consistentes
- **Logs**: Registrar todos los cambios de precios

## ✅ Resultado Esperado

Después de la implementación:
- ✅ Precio base del producto en Odoo
- ✅ Precios específicos de cada variante
- ✅ Cargos adicionales por atributos
- ✅ Sincronización bidireccional
- ✅ Validación de consistencia


