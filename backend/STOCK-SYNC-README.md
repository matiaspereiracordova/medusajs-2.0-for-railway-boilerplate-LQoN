# 📦 Sincronización de Stock MedusaJS ↔ Odoo - Quick Start

## ✅ ¿Qué se implementó?

### 1. 🔄 Sincronización Automática Bidireccional

#### **Odoo → MedusaJS** (cada 15 minutos)
- Job automático que sincroniza stock desde Odoo
- Archivo: `backend/src/jobs/sync-stock-from-odoo.ts`
- Actualiza `inventory_levels` en MedusaJS

#### **MedusaJS → Odoo** (al colocar orden)
- Subscriber que se activa cuando se realiza un pedido
- Archivo: `backend/src/subscribers/order-placed.ts`
- Crea `stock.move` en Odoo automáticamente

### 2. 🔍 Verificación de Stock en Tiempo Real

#### **Endpoint Store API**
```bash
# Verificar un producto
GET /store/check-stock?sku=SKU123&quantity=2

# Verificar múltiples productos
POST /store/check-stock
Body: { "items": [{"sku": "SKU123", "quantity": 2}] }
```

### 3. ⚡ Sincronización Manual (Admin)

```bash
# Sincronizar todo
GET /admin/sync-stock-now

# Sincronizar SKUs específicos
GET /admin/sync-stock-now?skus=SKU123,SKU456
```

---

## 🚀 Cómo Usar

### 1. **Verificar Stock Antes de Comprar**

En tu storefront, añade esta verificación:

```typescript
const checkStock = async (sku: string, quantity: number) => {
  const res = await fetch(`/store/check-stock?sku=${sku}&quantity=${quantity}`)
  const data = await res.json()
  return data.inStock
}

// Usar en componente
const inStock = await checkStock("DOG-FOOD-001", 5)
if (!inStock) {
  alert("Producto sin stock suficiente")
}
```

### 2. **Sincronizar Stock Manualmente (Admin)**

```bash
curl "http://localhost:9000/admin/sync-stock-now" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. **Monitorear Sincronización**

```bash
# Ver logs del job (cada 15 min)
grep "sync-stock-from-odoo" logs/medusa.log

# Ver sincronización de órdenes
grep "Sincronizando stock con Odoo" logs/medusa.log
```

---

## 📋 Requisitos

### 1. Variables de Entorno

```bash
ODOO_URL=https://your-odoo.com
ODOO_DATABASE=your_db
ODOO_USERNAME=admin
ODOO_PASSWORD=your_password
```

### 2. Configuración en MedusaJS

Los productos deben tener:
- ✅ `manage_inventory = true`
- ✅ SKU definido
- ✅ Inventory items creados

### 3. Configuración en Odoo

Los productos deben tener:
- ✅ `default_code` (SKU) que coincida con MedusaJS
- ✅ `type = 'product'` (no servicios)
- ✅ Stock location configurado

---

## 🔄 Flujo de Sincronización

```
┌─────────────────────────────────────────────────────────┐
│                    ODOO (Fuente de Verdad)              │
│                                                         │
│  Stock actualizado manualmente: 100 → 75                │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ ⏰ Cada 15 minutos
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Job: sync-stock-from-odoo                  │
│                                                         │
│  1. Consulta stock en Odoo por SKUs                     │
│  2. Actualiza inventory_levels en MedusaJS              │
│  3. Log: "Stock actualizado para SKU XXX: 100 → 75"     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              MEDUSAJS (Actualizado)                     │
│                                                         │
│  Stock en inventory_levels: 75 unidades                 │
│  Cliente puede ver stock disponible en tiempo real      │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ 🛒 Cliente realiza pedido
                 ▼
┌─────────────────────────────────────────────────────────┐
│           Subscriber: order-placed                      │
│                                                         │
│  1. Evento order.placed disparado                       │
│  2. Busca productos en Odoo por SKU                     │
│  3. Crea stock.move en Odoo (qty vendida)              │
│  4. Odoo reduce stock automáticamente: 75 → 70          │
└─────────────────────────────────────────────────────────┘
```

---

## 🧪 Pruebas Rápidas

### 1. Probar Sincronización Odoo → Medusa

```bash
# 1. Actualiza stock en Odoo manualmente
#    Ve a Inventario > Productos > Editar stock

# 2. Sincroniza manualmente (o espera 15 min)
curl "http://localhost:9000/admin/sync-stock-now?limit=5"

# 3. Verifica en MedusaJS que el stock se actualizó
```

### 2. Probar Sincronización Medusa → Odoo

```bash
# 1. Crea una orden en el storefront

# 2. Verifica los logs
grep "Sincronizando stock con Odoo" logs/medusa.log

# 3. Verifica en Odoo:
#    Inventario > Operaciones > Movimientos de Stock
#    Busca: "Venta Medusa: Order #XXXX"
```

### 3. Probar Verificación en Tiempo Real

```bash
# Verificar un producto
curl "http://localhost:9000/store/check-stock?sku=DOG-FOOD-001&quantity=5"

# Respuesta esperada:
{
  "success": true,
  "inStock": true,
  "available": 100,
  "requested": 5,
  "sku": "DOG-FOOD-001"
}
```

---

## 🐛 Troubleshooting Rápido

### Stock no se sincroniza

```bash
# 1. Verifica variables de entorno
echo $ODOO_URL

# 2. Verifica que productos tienen SKU
# 3. Sincroniza manualmente para ver errores
curl "http://localhost:9000/admin/sync-stock-now?limit=5"
```

### Movimientos no aparecen en Odoo

```bash
# 1. Verifica que el SKU existe en Odoo
# 2. Revisa logs del subscriber
grep "Producto encontrado en Odoo" logs/medusa.log

# 3. Si no encuentra el producto, sincroniza productos primero
curl "http://localhost:9000/admin/sync-products-now"
```

---

## 📚 Documentación Completa

Para información detallada, arquitectura, y casos de uso avanzados:

📖 **[STOCK-SYNC-GUIDE.md](./STOCK-SYNC-GUIDE.md)**

---

## 📁 Archivos Creados

### Nuevos:
- ✅ `backend/src/jobs/sync-stock-from-odoo.ts`
- ✅ `backend/src/api/store/check-stock/route.ts`
- ✅ `backend/src/api/admin/sync-stock-now/route.ts`

### Modificados:
- ✅ `backend/src/services/odoo-client.ts` (añadidos métodos de stock)
- ✅ `backend/src/subscribers/order-placed.ts` (añadida sincronización)

---

## ✨ Características Principales

| Característica | Estado | Frecuencia |
|---------------|--------|------------|
| Sync Odoo → Medusa | ✅ Automático | Cada 15 min |
| Sync Medusa → Odoo | ✅ Automático | Al colocar orden |
| Verificación tiempo real | ✅ Disponible | Bajo demanda |
| Sincronización manual | ✅ Disponible | Bajo demanda |
| Soporte multi-producto | ✅ Sí | - |
| Logs detallados | ✅ Sí | - |

---

**¡La sincronización de stock está completa y lista para usar! 🎉**

Para empezar:
1. Configura las variables de entorno de Odoo
2. Verifica que tus productos tienen SKUs
3. Ejecuta una sincronización manual para probar
4. Monitorea los logs para verificar que todo funciona

¿Preguntas? Revisa la [documentación completa](./STOCK-SYNC-GUIDE.md)

