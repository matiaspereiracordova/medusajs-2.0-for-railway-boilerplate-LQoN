# 💰 Sincronización de Precios - Resumen Ejecutivo

## ✅ ¡Implementación Completa!

He implementado un sistema completo de sincronización de precios entre MedusaJS y Odoo, basado en la documentación oficial y mejores prácticas.

---

## 🎯 ¿Qué Se Implementó?

### 1. **Sincronización Automática** ⚡
Cuando actualizas un producto en el panel de admin de MedusaJS:
- ✅ Se sincroniza automáticamente la estructura (variantes, atributos)
- ✅ Se sincronizan los precios de todas las variantes
- ✅ Se actualiza Odoo sin intervención manual

### 2. **Job Programado** ⏰
- ✅ Se ejecuta cada 6 horas automáticamente
- ✅ Sincroniza hasta 50 productos por ejecución
- ✅ Mantiene los precios actualizados continuamente

### 3. **API Manual** 🔧
- ✅ Endpoint para sincronización bajo demanda
- ✅ Puedes sincronizar todos los productos o específicos
- ✅ Útil para sincronización inicial o correcciones

---

## 🏗️ ¿Cómo Funciona?

### Flujo de Precios

```
MedusaJS (Admin Panel)          →          Odoo (ERP)
━━━━━━━━━━━━━━━━━━━━━━                    ━━━━━━━━━━━━

Producto: Pantalón Cargo                product.template
├── Precio base: $29.990                 ├── list_price: $29.990
└── Variantes:                           └── Variantes:
    ├── S: $29.990                           ├── S: $29.990 (extra: $0)
    ├── M: $31.990                           ├── M: $31.990 (extra: $2.000)
    └── L: $33.990                           └── L: $33.990 (extra: $4.000)
```

### Estrategia de Precios

1. **Precio Base:** Se toma el precio más bajo de todas las variantes
2. **Precio de Variante:** Se guarda el precio específico de cada variante
3. **Price Extra:** Se calcula automáticamente como la diferencia

---

## 📂 Archivos Creados

### Código
```
✨ backend/src/jobs/sync-prices-to-odoo-scheduled.ts    # Job cada 6 horas
🔧 backend/src/subscribers/product-updated.ts           # Actualizado con sync de precios
🔧 backend/src/workflows/sync-prices-to-odoo-simple.ts  # Mejorado con mejor lógica
🔧 backend/railway-post-deploy.js                       # Configurado para Railway
```

### Documentación
```
📖 PRICE-SYNC-GUIDE.md                      # Guía completa
📖 PRICE-SYNC-README.md                     # Referencia rápida
📖 PRICE-SYNC-IMPLEMENTATION-SUMMARY.md     # Resumen técnico
📖 RAILWAY-DEPLOY-INSTRUCTIONS.md           # Instrucciones de deploy
📖 RESUMEN-SINCRONIZACION-PRECIOS.md        # Este archivo
```

---

## 🚀 Para Hacer Deploy en Railway

### Paso 1: Configurar Variables de Entorno

En Railway, agrega estas variables:

```bash
ODOO_URL=https://tu-instancia-odoo.com
ODOO_DB=nombre_de_tu_base_de_datos
ODOO_USERNAME=tu_usuario
ODOO_API_KEY=tu_api_key
BACKEND_URL=https://tu-backend.railway.app
```

### Paso 2: Push y Deploy

```bash
git add .
git commit -m "feat: sincronización de precios con Odoo"
git push origin main
```

Railway automáticamente:
- ✅ Hace build del proyecto
- ✅ Ejecuta el deploy
- ✅ Corre el post-deploy script
- ✅ Activa el job programado

### Paso 3: Sincronización Inicial

Después del deploy, ejecuta:

```bash
# 1. Sincronizar estructura de productos
curl -X POST https://tu-backend.railway.app/admin/sync-to-odoo \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'

# 2. Sincronizar precios
curl -X POST https://tu-backend.railway.app/admin/sync-prices-to-odoo \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

### Paso 4: Verificar en Odoo

1. Ir a Odoo → Ventas → Productos
2. Buscar tus productos
3. Verificar que tengan:
   - ✅ Precio de venta
   - ✅ Variantes creadas
   - ✅ Precios por variante

---

## 🔄 Métodos de Sincronización

### Método 1: Automático (Recomendado)
```
Edita producto en MedusaJS → Guardar → ✅ Se sincroniza automáticamente
```

### Método 2: Programado
```
Cada 6 horas → ✅ Sistema sincroniza automáticamente
```

### Método 3: Manual
```bash
# Sincronizar todos los productos
POST /admin/sync-prices-to-odoo

# Sincronizar productos específicos
POST /admin/sync-prices-to-odoo
Body: {"productIds": ["prod_123", "prod_456"]}
```

---

## 📊 Monitoreo

### Ver Logs en Railway

```bash
railway logs --follow
```

### Logs de Sincronización Exitosa

```
[timestamp] ⚡ SUBSCRIBER: Producto actualizado detectado
[timestamp] 🔄 SUBSCRIBER: Iniciando sincronización con Odoo
[timestamp] ✅ SUBSCRIBER: Sincronización de producto completada
[timestamp] 💰 SUBSCRIBER: Iniciando sincronización de precios
[timestamp] ✅ PRICE-SYNC: Precio base actualizado: $29990 CLP
[timestamp] ✅ PRICE-SYNC: Variant S: Precio: $29990, Extra: $0
[timestamp] ✅ PRICE-SYNC: Variant M: Precio: $31990, Extra: $2000
[timestamp] 🎉 SUBSCRIBER: Producto y precios sincronizados exitosamente
```

### Logs del Job Programado

```
[timestamp] ⏰ SCHEDULED-JOB: Iniciando sincronización programada
[timestamp] ✅ SCHEDULED-JOB: Productos procesados: 50
[timestamp] ✅ SCHEDULED-JOB: Variantes sincronizadas: 150
[timestamp] ✅ SCHEDULED-JOB: Total precios sincronizados: 150
[timestamp] 🎉 SCHEDULED-JOB: Sincronización completada exitosamente
```

---

## ✅ Checklist Post-Deploy

Después de hacer deploy, verifica:

- [ ] Servidor corriendo en Railway
- [ ] Variables de entorno configuradas (ODOO_URL, etc.)
- [ ] Sincronización inicial ejecutada
- [ ] Productos visibles en Odoo con precios
- [ ] Job programado activo (ver logs cada 6 horas)
- [ ] Subscriber funcionando (test: editar producto)

---

## 🔍 Testing Rápido

### Test 1: Actualización Automática
```
1. Ir al admin panel de MedusaJS
2. Editar cualquier producto publicado
3. Cambiar el precio de una variante
4. Guardar
5. Ver logs: debería sincronizar automáticamente
6. Verificar en Odoo: precio actualizado
```

### Test 2: API Manual
```bash
curl -X POST https://tu-backend.railway.app/admin/sync-prices-to-odoo \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Respuesta esperada:
{
  "success": true,
  "data": {
    "syncedProducts": 10,
    "syncedVariants": 30,
    "syncedPrices": 30,
    "errorCount": 0
  }
}
```

---

## ⚠️ Troubleshooting Rápido

### Problema: Precios no se sincronizan
**Solución:**
```bash
# 1. Verificar que exista región CLP en MedusaJS
# 2. Sincronizar estructura primero:
POST /admin/sync-to-odoo

# 3. Luego sincronizar precios:
POST /admin/sync-prices-to-odoo
```

### Problema: Variante no encontrada en Odoo
**Solución:**
```bash
# Sincronizar estructura primero (crea las variantes):
POST /admin/sync-to-odoo
```

### Problema: Job no se ejecuta
**Solución:**
```bash
# Verificar logs:
railway logs | grep "SCHEDULED-JOB"

# Reiniciar servicio:
railway restart
```

---

## 📚 Documentación Completa

Para más detalles, consulta:

1. **[PRICE-SYNC-README.md](./PRICE-SYNC-README.md)** - Referencia rápida
2. **[PRICE-SYNC-GUIDE.md](./PRICE-SYNC-GUIDE.md)** - Guía completa con ejemplos
3. **[RAILWAY-DEPLOY-INSTRUCTIONS.md](./RAILWAY-DEPLOY-INSTRUCTIONS.md)** - Deploy paso a paso
4. **[PRICE-SYNC-IMPLEMENTATION-SUMMARY.md](./PRICE-SYNC-IMPLEMENTATION-SUMMARY.md)** - Detalles técnicos

---

## 🎉 Resultado Final

Con esta implementación, tu sistema:

✅ **Sincroniza automáticamente** cuando editas productos
✅ **Mantiene actualizado** con job cada 6 horas
✅ **Permite control manual** con endpoint API
✅ **Maneja errores** sin detener el proceso
✅ **Registra todo** con logs detallados
✅ **Está listo para producción** en Railway

---

## 💡 Basado en Documentación Oficial

Esta implementación sigue:
- ✅ [Documentación oficial de MedusaJS - Odoo Integration](https://docs.medusajs.com/resources/recipes/erp/odoo)
- ✅ [Documentación oficial de Odoo - Product Prices](https://www.odoo.com/documentation/18.0/es/applications/sales/sales/products_prices/products/variants.html)
- ✅ Mejores prácticas de sincronización ERP
- ✅ Patrones de diseño para e-commerce

---

## 🚀 ¡Listo para Deploy!

El sistema está completamente implementado y documentado.
Puedes hacer deploy en Railway con confianza siguiendo las instrucciones en `RAILWAY-DEPLOY-INSTRUCTIONS.md`.

---

**Fecha:** 7 de Octubre, 2025
**Status:** ✅ Completado y Listo para Producción
**Desarrollado con:** MedusaJS 2.0 + Odoo + Railway

