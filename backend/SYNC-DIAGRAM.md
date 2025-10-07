# 🔄 Diagrama de Sincronización de Precios MedusaJS → Odoo

## 📊 Flujo Visual Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MEDUSAJS ADMIN PANEL                             │
│                                                                           │
│  Admin edita producto:                                                   │
│  ┌────────────────────────────────────────┐                             │
│  │ Producto: Pantalón Cargo               │                             │
│  │ ├── Variante S: $29.990 CLP            │                             │
│  │ ├── Variante M: $31.990 CLP            │                             │
│  │ └── Variante L: $33.990 CLP            │                             │
│  └────────────────────────────────────────┘                             │
│                        ↓ GUARDAR                                         │
└─────────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    SUBSCRIBER (Automático)                               │
│                 product-updated.ts                                       │
│                                                                           │
│  1. Detecta cambio → event: 'product.updated'                           │
│  2. Verifica status: 'published' ✅                                      │
│  3. Ejecuta sincronización de estructura                                │
│  4. Espera 2 segundos                                                    │
│  5. Ejecuta sincronización de precios                                   │
└─────────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW: sync-prices-to-odoo                         │
│                 sync-prices-to-odoo-simple.ts                            │
│                                                                           │
│  Paso 1: Obtener productos con variantes y precios                      │
│  ┌────────────────────────────────────────┐                             │
│  │ Product {                              │                             │
│  │   id: "prod_123"                       │                             │
│  │   variants: [                          │                             │
│  │     { sku: "PANT-S", prices: [...] }   │                             │
│  │     { sku: "PANT-M", prices: [...] }   │                             │
│  │     { sku: "PANT-L", prices: [...] }   │                             │
│  │   ]                                    │                             │
│  │ }                                      │                             │
│  └────────────────────────────────────────┘                             │
│                           ↓                                              │
│  Paso 2: Buscar producto en Odoo por x_medusa_id                        │
│  ┌────────────────────────────────────────┐                             │
│  │ Odoo Product Template                  │                             │
│  │ id: 45                                 │                             │
│  │ x_medusa_id: "prod_123"                │                             │
│  └────────────────────────────────────────┘                             │
│                           ↓                                              │
│  Paso 3: Calcular precio base (más bajo)                                │
│  ┌────────────────────────────────────────┐                             │
│  │ S: $29.990                             │                             │
│  │ M: $31.990                             │                             │
│  │ L: $33.990                             │                             │
│  │                                        │                             │
│  │ → Precio base: $29.990 ✅              │                             │
│  └────────────────────────────────────────┘                             │
│                           ↓                                              │
│  Paso 4: Actualizar precio base en Odoo                                 │
│  ┌────────────────────────────────────────┐                             │
│  │ product.template.list_price = $29.990  │                             │
│  └────────────────────────────────────────┘                             │
│                           ↓                                              │
│  Paso 5: Para cada variante:                                            │
│  ┌────────────────────────────────────────┐                             │
│  │ Variante S:                            │                             │
│  │ ├── Buscar por SKU: "PANT-S"           │                             │
│  │ ├── list_price = $29.990               │                             │
│  │ └── price_extra = $0                   │                             │
│  │     ($29.990 - $29.990)                │                             │
│  ├────────────────────────────────────────┤                             │
│  │ Variante M:                            │                             │
│  │ ├── Buscar por SKU: "PANT-M"           │                             │
│  │ ├── list_price = $31.990               │                             │
│  │ └── price_extra = $2.000               │                             │
│  │     ($31.990 - $29.990)                │                             │
│  ├────────────────────────────────────────┤                             │
│  │ Variante L:                            │                             │
│  │ ├── Buscar por SKU: "PANT-L"           │                             │
│  │ ├── list_price = $33.990               │                             │
│  │ └── price_extra = $4.000               │                             │
│  │     ($33.990 - $29.990)                │                             │
│  └────────────────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                             ODOO (ERP)                                   │
│                                                                           │
│  product.template                                                        │
│  ┌────────────────────────────────────────┐                             │
│  │ id: 45                                 │                             │
│  │ name: "Pantalón Cargo"                 │                             │
│  │ list_price: $29.990                    │ ← Precio base               │
│  │ x_medusa_id: "prod_123"                │                             │
│  │                                        │                             │
│  │ Variantes (product.product):           │                             │
│  │ ┌────────────────────────────────────┐ │                             │
│  │ │ S - PANT-S                         │ │                             │
│  │ │ list_price: $29.990                │ │                             │
│  │ │ price_extra: $0                    │ │                             │
│  │ │ → Precio final: $29.990            │ │                             │
│  │ └────────────────────────────────────┘ │                             │
│  │ ┌────────────────────────────────────┐ │                             │
│  │ │ M - PANT-M                         │ │                             │
│  │ │ list_price: $31.990                │ │                             │
│  │ │ price_extra: $2.000                │ │                             │
│  │ │ → Precio final: $31.990            │ │                             │
│  │ └────────────────────────────────────┘ │                             │
│  │ ┌────────────────────────────────────┐ │                             │
│  │ │ L - PANT-L                         │ │                             │
│  │ │ list_price: $33.990                │ │                             │
│  │ │ price_extra: $4.000                │ │                             │
│  │ │ → Precio final: $33.990            │ │                             │
│  │ └────────────────────────────────────┘ │                             │
│  └────────────────────────────────────────┘                             │
│                                                                           │
│  ✅ SINCRONIZACIÓN COMPLETA                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Métodos de Sincronización

### 1. Automático (Subscriber)
```
┌────────────┐         ┌────────────┐         ┌────────────┐
│   Admin    │         │ Subscriber │         │    Odoo    │
│   Panel    │────────▶│  product-  │────────▶│    ERP     │
│            │ update  │  updated   │  sync   │            │
└────────────┘         └────────────┘         └────────────┘
     ↓                       ↓                       ↓
  Guardar              Detecta cambio           Actualiza
  producto             Auto-sincroniza          precios
                       (2s delay)
```

### 2. Job Programado
```
┌────────────┐         ┌────────────┐         ┌────────────┐
│   Cron     │         │    Job     │         │    Odoo    │
│  6 horas   │────────▶│ Scheduled  │────────▶│    ERP     │
│            │ trigger │            │  sync   │            │
└────────────┘         └────────────┘         └────────────┘
     ↓                       ↓                       ↓
  Ejecuta              Procesa 50              Actualiza
  cada 6h              productos               precios
```

### 3. API Manual
```
┌────────────┐         ┌────────────┐         ┌────────────┐
│   Admin/   │         │    API     │         │    Odoo    │
│   Script   │────────▶│  Endpoint  │────────▶│    ERP     │
│            │  POST   │            │  sync   │            │
└────────────┘         └────────────┘         └────────────┘
     ↓                       ↓                       ↓
  Ejecuta              Procesa según           Actualiza
  cuando quieras       parámetros              precios
```

---

## 📊 Arquitectura de Precios

### Estructura en MedusaJS
```
Product
└── variants[]
    ├── id: "variant_001"
    ├── sku: "PANT-S"
    ├── title: "S"
    └── prices[]
        ├── {
        │    amount: 2999000,    // En centavos
        │    currency_code: "clp",
        │    region_id: "reg_cl"
        │  }
        └── {
             amount: 30,         // En USD
             currency_code: "usd",
             region_id: "reg_us"
           }
```

### Transformación a Odoo
```
MedusaJS                          Odoo
━━━━━━━━━━━━━━━━━━━━━━           ━━━━━━━━━━━━━━━━━━━━━━
amount: 2999000 centavos    →    list_price: 29990
currency: "clp"             →    currency: CLP
sku: "PANT-S"              →    default_code: "PANT-S"
variant.prices[0]          →    price_extra: calculado
```

### Fórmulas
```
┌─────────────────────────────────────────────┐
│ Precio Base (product.template)             │
│                                             │
│ list_price = MIN(todos_los_precios)        │
│                                             │
│ Ejemplo:                                    │
│ MIN($29.990, $31.990, $33.990) = $29.990   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Precio Extra (product.product)             │
│                                             │
│ price_extra = precio_variante - precio_base│
│                                             │
│ Ejemplos:                                   │
│ S: $29.990 - $29.990 = $0                  │
│ M: $31.990 - $29.990 = $2.000              │
│ L: $33.990 - $29.990 = $4.000              │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Precio Final en Odoo                        │
│                                             │
│ precio_final = list_price + price_extra     │
│                                             │
│ Ejemplos:                                   │
│ S: $29.990 + $0     = $29.990              │
│ M: $29.990 + $2.000 = $31.990              │
│ L: $29.990 + $4.000 = $33.990              │
└─────────────────────────────────────────────┘
```

---

## 🕐 Timeline de Sincronización

### Flujo Completo (Subscriber)
```
0s    │ Admin edita producto en MedusaJS
      │ ↓
0.1s  │ Event 'product.updated' emitido
      │ ↓
0.2s  │ Subscriber detecta cambio
      │ ↓
0.5s  │ Inicia sync-to-odoo (estructura)
      │ ├── Sincroniza producto
      │ ├── Crea/actualiza variantes
      │ └── Configura atributos
      │ ↓
2.5s  │ Espera 2 segundos (delay)
      │ ↓
3s    │ Inicia sync-prices-to-odoo
      │ ├── Busca producto en Odoo
      │ ├── Calcula precio base
      │ ├── Actualiza template.list_price
      │ └── Para cada variante:
      │     ├── Busca por SKU
      │     ├── Actualiza list_price
      │     └── Calcula price_extra
      │ ↓
5s    │ ✅ Sincronización completa
      │
      │ Resultado en Odoo:
      │ ✅ Producto actualizado
      │ ✅ Precio base correcto
      │ ✅ Variantes con precios
      │ ✅ Price extra calculado
```

---

## 🎯 Casos de Uso Visualizados

### Caso 1: Nuevo Producto
```
Paso 1: Crear producto en MedusaJS
┌─────────────────────────────────┐
│ Crear "Polera Básica"           │
│ ├── Variante S: $19.990         │
│ ├── Variante M: $19.990         │
│ └── Variante L: $21.990         │
└─────────────────────────────────┘
         ↓ Guardar
         
Paso 2: Sincronizar estructura
POST /admin/sync-to-odoo
         ↓
         
Paso 3: Sincronizar precios
POST /admin/sync-prices-to-odoo
         ↓
         
Resultado en Odoo:
┌─────────────────────────────────┐
│ Polera Básica                   │
│ Precio base: $19.990            │
│ ├── S: $19.990 (extra: $0)     │
│ ├── M: $19.990 (extra: $0)     │
│ └── L: $21.990 (extra: $2.000) │
└─────────────────────────────────┘
```

### Caso 2: Actualizar Precio
```
Estado Inicial en MedusaJS:
┌─────────────────────────────────┐
│ Pantalón Cargo                  │
│ ├── Variante M: $31.990         │
└─────────────────────────────────┘

Admin cambia precio:
┌─────────────────────────────────┐
│ Pantalón Cargo                  │
│ ├── Variante M: $29.990 ✏️      │
└─────────────────────────────────┘
         ↓ Guardar
         
Subscriber automático:
         ↓
         
Resultado en Odoo:
┌─────────────────────────────────┐
│ Pantalón Cargo                  │
│ ├── M: $29.990 ✅ (actualizado) │
│ └── price_extra: recalculado    │
└─────────────────────────────────┘
```

---

## 📊 Monitoreo Visual

### Logs Exitosos
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 SUBSCRIBER: Producto detectado
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Sincronizando estructura...
✅ Producto sincronizado
✅ Variantes creadas: 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Sincronizando precios...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Precio base: $29.990 CLP
✅ Variant S: $29.990 (extra: $0)
✅ Variant M: $31.990 (extra: $2.000)
✅ Variant L: $33.990 (extra: $4.000)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Sincronización completa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Dashboard de Métricas
```
╔═══════════════════════════════════════╗
║   SINCRONIZACIÓN DE PRECIOS           ║
║   Última ejecución: Hace 2h           ║
╠═══════════════════════════════════════╣
║                                       ║
║   📊 Productos procesados:      50    ║
║   ✅ Variantes sincronizadas:   150   ║
║   💰 Precios actualizados:      150   ║
║   ❌ Errores:                   0     ║
║                                       ║
║   ⏰ Próxima ejecución: 4h           ║
║                                       ║
╚═══════════════════════════════════════╝
```

---

## 🚀 Deploy en Railway

```
┌─────────────────────────────────────────────────────────────┐
│                   RAILWAY DEPLOYMENT                         │
└─────────────────────────────────────────────────────────────┘

Step 1: Git Push
┌────────┐
│  Git   │  git push origin main
└────┬───┘
     ↓
Step 2: Railway Build
┌────────┐
│ Build  │  npm run build
└────┬───┘
     ↓
Step 3: Deploy
┌────────┐
│ Deploy │  pnpm run start
└────┬───┘
     ↓
Step 4: Post-Deploy
┌─────────────┐
│ Post-Deploy │  railway-post-deploy.js
└─────┬───────┘
      ├── ✅ Seed (primera vez)
      └── ℹ️ Info sobre price sync
      
Step 5: Server Running
┌──────────────┐
│ MedusaJS     │  🚀 Server started
│ + Job Active │  ⏰ Job scheduled
└──────────────┘
      ↓
      Cada 6 horas → Sync automático ✅
      Admin update → Sync automático ✅
      API manual   → Disponible ✅
```

---

**Este diagrama muestra el flujo completo de sincronización de precios**
**desde MedusaJS hacia Odoo, con todos los métodos disponibles.**

