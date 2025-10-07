# 🔄 Guía de Sincronización de Precios MedusaJS ↔ Odoo

## 📋 Índice
1. [Descripción General](#descripción-general)
2. [Arquitectura de Precios](#arquitectura-de-precios)
3. [Flujos de Sincronización](#flujos-de-sincronización)
4. [Métodos Disponibles](#métodos-disponibles)
5. [Uso en Railway](#uso-en-railway)
6. [Troubleshooting](#troubleshooting)

---

## 📖 Descripción General

Este sistema mantiene sincronizados los precios de productos y variantes entre MedusaJS (panel admin) y Odoo (ERP). La sincronización es **unidireccional**: MedusaJS → Odoo.

### Características Principales
- ✅ Sincronización automática al actualizar productos
- ✅ Job programado cada 6 horas
- ✅ API manual para sincronización bajo demanda
- ✅ Soporte para múltiples monedas (prioridad: CLP > USD > EUR)
- ✅ Manejo de precios base y precios por variante
- ✅ Cálculo automático de price_extra en Odoo

---

## 🏗️ Arquitectura de Precios

### En MedusaJS 2.0
```javascript
Product
├── variants[]
│   ├── id (identificador único)
│   ├── sku (código de referencia)
│   ├── title (nombre de la variante)
│   └── prices[]
│       ├── amount (en centavos)
│       ├── currency_code ('clp', 'usd', 'eur')
│       └── region_id
```

### En Odoo
```javascript
product.template (Producto Principal)
├── id (ID en Odoo)
├── x_medusa_id (referencia al ID de MedusaJS)
├── list_price (precio base del producto)
└── product.product[] (Variantes)
    ├── id (ID de variante en Odoo)
    ├── default_code (SKU)
    ├── list_price (precio específico de la variante)
    └── price_extra (cargo adicional sobre el precio base)
```

### Fórmula de Precios en Odoo
```
Precio Final Variante = list_price (template) + price_extra (variant)
```

**Nuestra Implementación:**
- `product.template.list_price` = Precio más bajo de todas las variantes
- `product.product.list_price` = Precio específico de la variante
- `product.product.price_extra` = MAX(0, precio_variante - precio_base)

---

## 🔄 Flujos de Sincronización

### 1. Sincronización Automática (Subscriber)

**Trigger:** Cuando se actualiza un producto en MedusaJS
**Archivo:** `backend/src/subscribers/product-updated.ts`

```javascript
// Flujo:
1. Detecta actualización de producto (event: 'product.updated')
2. Verifica que el producto esté publicado
3. Sincroniza estructura del producto (variantes, atributos)
4. Espera 2 segundos para que Odoo procese
5. Sincroniza precios de todas las variantes
```

**Ejemplo de uso:**
```bash
# Desde el Admin Panel de MedusaJS:
1. Editar producto
2. Cambiar precio de variante
3. Guardar
# ✅ La sincronización ocurre automáticamente
```

---

### 2. Job Programado (Scheduled Job)

**Frecuencia:** Cada 6 horas
**Archivo:** `backend/src/jobs/sync-prices-to-odoo-scheduled.ts`

```javascript
// Configuración del schedule:
schedule: "0 */6 * * *"  // Cron: cada 6 horas
// Para testing: "*/30 * * * *" (cada 30 minutos)
```

**¿Qué hace?**
- Sincroniza hasta 50 productos por ejecución
- Actualiza precios base y de variantes
- Registra errores sin detener el proceso
- Se ejecuta automáticamente en Railway

**Logs:**
```
[timestamp] ⏰ SCHEDULED-JOB: Iniciando sincronización programada...
[timestamp] ✅ SCHEDULED-JOB: Productos procesados: 50
[timestamp] ✅ SCHEDULED-JOB: Variantes sincronizadas: 150
[timestamp] ✅ SCHEDULED-JOB: Total precios sincronizados: 150
```

---

### 3. API Manual (REST Endpoint)

**Endpoint:** `POST /admin/sync-prices-to-odoo`
**Archivo:** `backend/src/api/admin/sync-prices-to-odoo/route.ts`

#### Request:
```bash
curl -X POST http://localhost:9000/admin/sync-prices-to-odoo \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 50,
    "offset": 0,
    "productIds": ["prod_12345"] // Opcional
  }'
```

#### Response:
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

#### Parámetros:
- `limit` (number, opcional): Cantidad de productos a sincronizar (default: 10)
- `offset` (number, opcional): Offset para paginación (default: 0)
- `productIds` (string[], opcional): IDs específicos de productos a sincronizar

---

## 🛠️ Métodos Disponibles

### En `OdooModuleService` (`backend/src/modules/odoo/service.ts`)

#### 1. `updateProductTemplatePrice()`
```typescript
await odooModuleService.updateProductTemplatePrice(
  productTemplateId: number,
  price: number,
  currencyCode: string = 'CLP'
)
```
**Descripción:** Actualiza el precio base del producto template en Odoo.

---

#### 2. `updateVariantPrice()`
```typescript
await odooModuleService.updateVariantPrice(
  productVariantId: number,
  price: number,
  currencyCode: string = 'CLP'
)
```
**Descripción:** Actualiza el precio de una variante específica en Odoo.

---

#### 3. `findVariantBySku()`
```typescript
const variants = await odooModuleService.findVariantBySku(sku: string)
```
**Descripción:** Busca una variante en Odoo por su SKU.
**Retorna:** Array de variantes encontradas.

---

#### 4. `syncVariantPrices()`
```typescript
await odooModuleService.syncVariantPrices(
  productTemplateId: number,
  variants: Array<{
    id: string
    title: string
    sku: string
    prices: any[]
  }>
)
```
**Descripción:** Sincroniza precios de múltiples variantes, calculando automáticamente price_extra.

---

## 🚀 Uso en Railway

### Configuración Automática

Al hacer deploy en Railway, el sistema:

1. **Ejecuta el seed** (si es primera vez)
2. **Muestra información** sobre sincronización de precios
3. **Activa el job programado** automáticamente

### Variables de Entorno Necesarias

```bash
# En Railway, configurar:
ODOO_URL=https://tu-odoo-instance.com
ODOO_DB=tu_base_de_datos
ODOO_USERNAME=tu_usuario
ODOO_API_KEY=tu_api_key
BACKEND_URL=https://tu-backend.railway.app
```

### Post-Deploy

El archivo `backend/railway-post-deploy.js` se ejecuta automáticamente:

```javascript
// Tareas post-deploy:
1. ✅ Ejecuta seed (solo primera vez)
2. ℹ️ Muestra información sobre sync de precios
3. ✅ Job programado se activa automáticamente
```

### Sincronización Manual en Railway

```bash
# Desde Railway o cualquier cliente HTTP:
curl -X POST https://tu-backend.railway.app/admin/sync-prices-to-odoo \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

---

## 🔍 Troubleshooting

### Problema 1: Precios no se sincronizan

**Síntomas:**
- Precios en MedusaJS no aparecen en Odoo
- Logs muestran "⚠️ Variant sin precios"

**Solución:**
```bash
# 1. Verificar que el producto tenga precios en MedusaJS
# 2. Verificar que la región CLP esté configurada
# 3. Ejecutar sincronización manual:
curl -X POST http://localhost:9000/admin/sync-prices-to-odoo \
  -H "Content-Type: application/json" \
  -d '{"productIds": ["prod_xxx"]}'
```

---

### Problema 2: Variante no encontrada en Odoo

**Síntomas:**
```
⚠️ PRICE-SYNC: Variant XYZ no encontrado en Odoo
```

**Causa:** La variante no existe en Odoo o el SKU no coincide.

**Solución:**
```bash
# 1. Primero sincronizar la estructura del producto:
POST /admin/sync-to-odoo

# 2. Luego sincronizar los precios:
POST /admin/sync-prices-to-odoo
```

---

### Problema 3: Job programado no se ejecuta

**Síntomas:**
- No hay logs del job cada 6 horas

**Verificación:**
```bash
# Revisar logs de Railway:
railway logs --follow

# Buscar:
[timestamp] ⏰ SCHEDULED-JOB: Iniciando sincronización...
```

**Solución:**
```bash
# Verificar que el archivo existe:
backend/src/jobs/sync-prices-to-odoo-scheduled.ts

# Verificar la configuración del schedule:
export const config: ScheduledJobConfig = {
  name: "sync-prices-to-odoo-scheduled",
  schedule: "0 */6 * * *",
}
```

---

### Problema 4: Error de conexión con Odoo

**Síntomas:**
```
❌ Error sincronizando precios: Connection refused
```

**Solución:**
```bash
# Verificar variables de entorno:
echo $ODOO_URL
echo $ODOO_DB
echo $ODOO_USERNAME

# Verificar conectividad:
node backend/test-odoo-connection.js
```

---

## 📊 Monitoreo y Logs

### Logs Importantes

```bash
# Sincronización exitosa:
✅ PRICE-SYNC: Precio base actualizado: $29990 CLP
✅ PRICE-SYNC: Variant S: Precio: $29990, Extra: $0
✅ PRICE-SYNC: Variant M: Precio: $31990, Extra: $2000

# Advertencias:
⚠️ PRICE-SYNC: Variant L sin precios
⚠️ PRICE-SYNC: No se encontró región CLP

# Errores:
❌ PRICE-SYNC: Error sincronizando variante XL: timeout
```

### Métricas de Éxito

- **syncedProducts:** Cantidad de productos procesados
- **syncedVariants:** Cantidad de variantes actualizadas
- **syncedPrices:** Total de precios sincronizados
- **errorCount:** Cantidad de errores encontrados

---

## 🎯 Mejores Prácticas

1. **Siempre sincronizar estructura antes que precios:**
   ```bash
   POST /admin/sync-to-odoo        # Primero
   POST /admin/sync-prices-to-odoo # Después
   ```

2. **Usar límites razonables:**
   ```json
   { "limit": 50 }  // ✅ Recomendado
   { "limit": 1000 } // ❌ Puede causar timeout
   ```

3. **Monitorear logs regularmente:**
   ```bash
   railway logs --follow | grep "PRICE-SYNC"
   ```

4. **Verificar precios después de sincronizar:**
   - Revisar en Odoo: Ventas → Productos
   - Verificar precio base y price_extra de variantes

---

## 📚 Recursos Adicionales

- [Documentación Odoo - Product Prices](https://www.odoo.com/documentation/18.0/es/applications/sales/sales/products_prices/products/variants.html)
- [MedusaJS - ERP Integration](https://docs.medusajs.com/resources/recipes/erp/odoo)
- [PRICE-SYNC-ANALYSIS.md](./PRICE-SYNC-ANALYSIS.md) - Análisis técnico detallado

---

## ✅ Checklist de Verificación

Después de hacer deploy en Railway:

- [ ] Variables de entorno configuradas (ODOO_URL, ODOO_DB, etc.)
- [ ] Productos sincronizados a Odoo
- [ ] Precios base visibles en Odoo
- [ ] Precios de variantes correctos
- [ ] Job programado ejecutándose cada 6 horas
- [ ] Subscriber de productos funcionando (actualizar producto → sync automático)
- [ ] Logs sin errores críticos

---

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs en Railway
2. Ejecuta sincronización manual para ver detalles
3. Verifica las variables de entorno
4. Consulta la sección de Troubleshooting arriba

---

**Última actualización:** 2025-10-07
**Versión:** 1.0.0

