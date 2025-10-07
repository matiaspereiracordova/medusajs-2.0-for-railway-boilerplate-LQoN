# 💰 Sincronización de Precios MedusaJS → Odoo

## 🚀 Quick Start

### Sincronización Manual
```bash
# Sincronizar todos los productos
curl -X POST http://localhost:9000/admin/sync-prices-to-odoo \
  -H "Content-Type: application/json" \
  -d '{"limit": 50, "offset": 0}'

# Sincronizar productos específicos
curl -X POST http://localhost:9000/admin/sync-prices-to-odoo \
  -H "Content-Type: application/json" \
  -d '{"productIds": ["prod_12345", "prod_67890"]}'
```

---

## 📋 Métodos de Sincronización

### 1. ⚡ Automática (Subscriber)
- **Trigger:** Al actualizar un producto en el admin panel
- **Qué hace:** Sincroniza estructura + precios automáticamente
- **Archivo:** `src/subscribers/product-updated.ts`

### 2. ⏰ Programada (Scheduled Job)
- **Frecuencia:** Cada 6 horas
- **Qué hace:** Sincroniza hasta 50 productos
- **Archivo:** `src/jobs/sync-prices-to-odoo-scheduled.ts`
- **Cron:** `0 */6 * * *`

### 3. 🔧 Manual (API)
- **Endpoint:** `POST /admin/sync-prices-to-odoo`
- **Uso:** Sincronización bajo demanda
- **Archivo:** `src/api/admin/sync-prices-to-odoo/route.ts`

---

## 🏗️ Arquitectura

```
MedusaJS (Admin Panel)                 Odoo (ERP)
━━━━━━━━━━━━━━━━━━━━━━                 ━━━━━━━━━━━━━━━
Product                                product.template
├── variants[]                         ├── list_price (precio base)
│   ├── sku                           └── product.product[]
│   ├── prices[]                          ├── default_code (SKU)
│   │   ├── amount (centavos)             ├── list_price (precio)
│   │   └── currency_code                 └── price_extra (cargo)
```

**Estrategia:**
- Precio base = Precio más bajo de todas las variantes
- Price extra = Diferencia entre precio de variante y precio base
- Prioridad de monedas: CLP > USD > EUR

---

## 🔄 Flujo de Sincronización

```
1. Obtener productos de MedusaJS
   └── Incluir variantes y precios

2. Buscar producto en Odoo por x_medusa_id
   └── Si no existe, omitir precios

3. Calcular precio base (más bajo)
   └── Actualizar product.template.list_price

4. Para cada variante:
   ├── Buscar en Odoo por SKU
   ├── Actualizar list_price
   └── Calcular y actualizar price_extra
```

---

## 📦 Deploy en Railway

### Variables de Entorno
```bash
ODOO_URL=https://tu-odoo.com
ODOO_DB=tu_database
ODOO_USERNAME=tu_usuario
ODOO_API_KEY=tu_api_key
BACKEND_URL=https://tu-backend.railway.app
```

### Post-Deploy Automático
El script `railway-post-deploy.js` automáticamente:
- ✅ Ejecuta seed (primera vez)
- ✅ Activa job programado
- ℹ️ Muestra instrucciones de sync manual

---

## 🔍 Verificación Rápida

### Logs de Éxito
```
✅ PRICE-SYNC: Precio base actualizado: $29990 CLP
✅ PRICE-SYNC: Variant S: Precio: $29990, Extra: $0
✅ PRICE-SYNC: Productos procesados: 10
✅ PRICE-SYNC: Variantes sincronizadas: 30
```

### Verificar en Odoo
1. Ir a: **Ventas → Productos**
2. Seleccionar un producto
3. Ver **Precio de Venta** (precio base)
4. Ver **Variantes → Precio Extra** (diferencia)

---

## ⚠️ Troubleshooting Común

### Precios no se sincronizan
```bash
# Verificar región CLP existe
# Verificar producto tiene precios en MedusaJS
# Sincronizar manualmente:
POST /admin/sync-prices-to-odoo
```

### Variante no encontrada
```bash
# Primero sincronizar estructura:
POST /admin/sync-to-odoo

# Luego precios:
POST /admin/sync-prices-to-odoo
```

### Job no se ejecuta
```bash
# Verificar logs en Railway:
railway logs | grep "SCHEDULED-JOB"

# Verificar archivo existe:
src/jobs/sync-prices-to-odoo-scheduled.ts
```

---

## 📊 API Response

```json
{
  "success": true,
  "message": "Sincronización de precios completada exitosamente",
  "data": {
    "syncedProducts": 10,
    "syncedVariants": 30,
    "syncedPrices": 30,
    "errorCount": 0,
    "errors": [],
    "timestamp": "2025-10-07T10:30:00.000Z"
  }
}
```

---

## 🎯 Checklist Post-Deploy

- [ ] Variables de entorno configuradas
- [ ] Productos sincronizados a Odoo
- [ ] Precios visibles en Odoo
- [ ] Job programado activo
- [ ] Subscriber funcionando
- [ ] Sin errores en logs

---

## 📚 Documentación Completa

- [PRICE-SYNC-GUIDE.md](./PRICE-SYNC-GUIDE.md) - Guía detallada
- [PRICE-SYNC-ANALYSIS.md](./PRICE-SYNC-ANALYSIS.md) - Análisis técnico
- [SYNC-VARIANTS-GUIDE.md](./SYNC-VARIANTS-GUIDE.md) - Sincronización de variantes

---

**¿Necesitas ayuda?** Consulta la guía completa en `PRICE-SYNC-GUIDE.md`

