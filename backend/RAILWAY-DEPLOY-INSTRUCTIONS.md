# 🚂 Instrucciones de Deploy en Railway - Sincronización de Precios

## 📋 Pre-requisitos

Antes de hacer deploy, asegúrate de tener:

- ✅ Cuenta en Railway
- ✅ Instancia de Odoo configurada y accesible
- ✅ Base de datos PostgreSQL configurada en Railway
- ✅ Variables de entorno de Odoo

---

## 🔧 Variables de Entorno en Railway

### 1. Configurar Variables de Odoo

En Railway, ve a tu proyecto → Variables y agrega:

```bash
# Configuración de Odoo (REQUERIDO)
ODOO_URL=https://tu-instancia-odoo.com
ODOO_DB=nombre_de_tu_base_de_datos
ODOO_USERNAME=tu_usuario_odoo
ODOO_API_KEY=tu_api_key_odoo

# URL del backend (REQUERIDO)
BACKEND_URL=https://tu-backend.railway.app

# Configuración de MedusaJS (ya deberían estar)
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=tu_jwt_secret_aqui
COOKIE_SECRET=tu_cookie_secret_aqui

# Admin (opcional pero recomendado)
ADMIN_EMAIL=admin@tuempresa.com
ADMIN_PASSWORD=tu_password_seguro
```

### 2. Verificar Variables Obligatorias

```bash
# Estas DEBEN estar configuradas:
✅ ODOO_URL
✅ ODOO_DB
✅ ODOO_USERNAME
✅ ODOO_API_KEY
✅ BACKEND_URL
✅ DATABASE_URL
✅ JWT_SECRET
✅ COOKIE_SECRET
```

---

## 📦 Estructura del Deploy

### Archivos Configurados para Railway

```
backend/
├── railway.json                    # Configuración de Railway
│   └── postDeployCommand: "npm run ib"
├── railway-post-deploy.js         # Script post-deploy
│   ├── Ejecuta seed (primera vez)
│   └── Activa sincronización de precios
└── package.json
    └── "ib": "init-backend"
```

### ¿Qué Pasa Durante el Deploy?

```
1. Build
   └── npm run build
       └── Compila TypeScript
       └── Ejecuta postBuild.js

2. Deploy
   └── Start command: "pnpm run start"
       └── init-backend
       └── cd .medusa/server
       └── medusa start --verbose

3. Post-Deploy (Automático)
   └── railway-post-deploy.js
       ├── Ejecuta seed (si es primera vez)
       ├── Muestra info de price sync
       └── Job programado se activa
```

---

## 🚀 Pasos de Deploy

### Paso 1: Push a Git

```bash
# Asegúrate de que todos los cambios estén commiteados
git add .
git commit -m "feat: implementar sincronización de precios con Odoo"
git push origin main
```

### Paso 2: Railway Auto-Deploy

Railway automáticamente:
1. Detecta el push
2. Inicia el build
3. Ejecuta el deploy
4. Corre el post-deploy script

### Paso 3: Monitorear el Deploy

```bash
# Ver logs en tiempo real
railway logs --follow

# Buscar logs importantes:
```

**Logs a buscar:**

```bash
# Build exitoso
✅ Build completed

# Server iniciado
🚀 Medusa server started

# Post-deploy
🚀 Railway Post-Deploy Script Starting...
✅ Post-deploy seed completed successfully!
💰 Running price synchronization to Odoo...
ℹ️ Scheduled job runs every 6 hours automatically

# Job programado activo
⏰ SCHEDULED-JOB: Iniciando sincronización programada...
```

---

## ✅ Verificación Post-Deploy

### 1. Verificar que el servidor esté corriendo

```bash
# Hacer request al health check
curl https://tu-backend.railway.app/health

# Respuesta esperada:
{"status": "ok"}
```

### 2. Verificar productos en MedusaJS

```bash
# Listar productos
curl https://tu-backend.railway.app/admin/list-products

# Deberías ver tus productos con variantes y precios
```

### 3. Ejecutar Sincronización Inicial

```bash
# Sincronizar estructura de productos
curl -X POST https://tu-backend.railway.app/admin/sync-to-odoo \
  -H "Content-Type: application/json" \
  -d '{"limit": 50, "offset": 0}'

# Esperar unos segundos...

# Sincronizar precios
curl -X POST https://tu-backend.railway.app/admin/sync-prices-to-odoo \
  -H "Content-Type: application/json" \
  -d '{"limit": 50, "offset": 0}'
```

### 4. Verificar en Odoo

1. Login a Odoo
2. Ir a **Ventas → Productos**
3. Buscar productos sincronizados
4. Verificar:
   - ✅ Producto existe
   - ✅ Tiene precio de venta
   - ✅ Variantes creadas
   - ✅ Cada variante tiene precio correcto
   - ✅ Price Extra calculado

### 5. Monitorear Job Programado

```bash
# Ver logs cada 6 horas
railway logs --follow | grep "SCHEDULED-JOB"

# Logs esperados cada 6 horas:
[timestamp] ⏰ SCHEDULED-JOB: Iniciando sincronización programada...
[timestamp] ✅ SCHEDULED-JOB: Productos procesados: 50
[timestamp] ✅ SCHEDULED-JOB: Variantes sincronizadas: 150
```

---

## 🔥 Troubleshooting en Railway

### Problema 1: Deploy Falla en Build

**Síntomas:**
```
❌ Build failed
npm ERR! code ELIFECYCLE
```

**Solución:**
```bash
# Local: Verificar que compile sin errores
npm run build

# Si funciona local, limpiar cache en Railway:
railway down
railway up
```

---

### Problema 2: Variables de Entorno No Configuradas

**Síntomas:**
```
❌ ODOO_URL is not defined
❌ Cannot connect to Odoo
```

**Solución:**
1. Ir a Railway → Tu Proyecto → Variables
2. Agregar todas las variables de Odoo
3. Hacer redeploy:
   ```bash
   railway redeploy
   ```

---

### Problema 3: Sincronización No Funciona

**Síntomas:**
```
⚠️ Warning: Price synchronization failed
⚠️ Variant XYZ no encontrado en Odoo
```

**Solución:**
```bash
# 1. Verificar conexión con Odoo
curl https://tu-backend.railway.app/admin/diagnostic

# 2. Sincronizar estructura primero
curl -X POST https://tu-backend.railway.app/admin/sync-to-odoo

# 3. Luego sincronizar precios
curl -X POST https://tu-backend.railway.app/admin/sync-prices-to-odoo
```

---

### Problema 4: Job Programado No Se Ejecuta

**Síntomas:**
- No hay logs del job cada 6 horas

**Solución:**
```bash
# Verificar que el servidor esté corriendo
railway logs --tail 100

# Verificar que el archivo del job exista:
ls -la src/jobs/sync-prices-to-odoo-scheduled.ts

# Reiniciar el servicio:
railway restart
```

---

### Problema 5: Timeout en Railway

**Síntomas:**
```
❌ Request timeout
❌ Job killed after 5 minutes
```

**Solución:**
```bash
# Reducir el límite de productos por sync
curl -X POST https://tu-backend.railway.app/admin/sync-prices-to-odoo \
  -d '{"limit": 20}'  # Reducir de 50 a 20

# Sincronizar en batches:
# Batch 1: offset=0, limit=20
# Batch 2: offset=20, limit=20
# Batch 3: offset=40, limit=20
```

---

## 📊 Monitoreo en Producción

### Logs Importantes a Monitorear

```bash
# Ver todos los logs de sincronización
railway logs | grep "PRICE-SYNC"

# Ver logs de jobs programados
railway logs | grep "SCHEDULED-JOB"

# Ver logs de subscriber (actualizaciones automáticas)
railway logs | grep "SUBSCRIBER"

# Ver errores
railway logs | grep "ERROR"
railway logs | grep "❌"
```

### Métricas a Observar

1. **Tasa de éxito:**
   ```
   ✅ Productos procesados / Total productos
   ```

2. **Errores:**
   ```
   ❌ Error count: 0 (ideal)
   ```

3. **Tiempo de respuesta:**
   ```
   ⏱️ Sincronización < 5 segundos por producto
   ```

4. **Frecuencia de job:**
   ```
   ⏰ Logs cada 6 horas confirmando ejecución
   ```

---

## 🎯 Checklist Final

Después del deploy, verifica:

- [ ] ✅ Servidor corriendo en Railway
- [ ] ✅ Variables de entorno configuradas
- [ ] ✅ Database conectada
- [ ] ✅ Seed ejecutado (productos iniciales)
- [ ] ✅ Productos visibles en MedusaJS admin
- [ ] ✅ Productos sincronizados a Odoo
- [ ] ✅ Precios visibles en Odoo
- [ ] ✅ Variantes con price_extra correcto
- [ ] ✅ Job programado ejecutándose cada 6 horas
- [ ] ✅ Subscriber funcionando (test: editar producto)
- [ ] ✅ Sin errores críticos en logs

---

## 📱 Testing de la Sincronización

### Test 1: Actualización Manual
```bash
1. Ir al admin panel de MedusaJS
2. Editar un producto
3. Cambiar precio de una variante
4. Guardar
5. Verificar logs: debería ver sincronización automática
6. Verificar en Odoo: precio actualizado
```

### Test 2: Sincronización Manual
```bash
# Sincronizar todos los productos
curl -X POST https://tu-backend.railway.app/admin/sync-prices-to-odoo \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'

# Verificar response:
{
  "success": true,
  "data": {
    "syncedProducts": 50,
    "syncedVariants": 150,
    "errorCount": 0
  }
}
```

### Test 3: Job Programado
```bash
# Esperar 6 horas o cambiar el cron temporalmente a:
# schedule: "*/5 * * * *"  // Cada 5 minutos para testing

# Monitorear logs:
railway logs --follow | grep "SCHEDULED-JOB"

# Deberías ver ejecución automática
```

---

## 🔒 Seguridad

### Variables Sensibles
```bash
# NUNCA commitear en git:
❌ ODOO_API_KEY
❌ JWT_SECRET
❌ COOKIE_SECRET
❌ DATABASE_URL

# Siempre configurar en Railway UI
```

### API Endpoints
```bash
# Asegurarse de que endpoints admin estén protegidos
# (MedusaJS maneja esto automáticamente con auth)
```

---

## 📚 Recursos Adicionales

- **Railway Docs:** https://docs.railway.app
- **MedusaJS Docs:** https://docs.medusajs.com
- **Odoo API Docs:** https://www.odoo.com/documentation/

---

## 🆘 Soporte

Si tienes problemas:

1. **Revisar logs:**
   ```bash
   railway logs --tail 200
   ```

2. **Verificar configuración:**
   ```bash
   railway variables
   ```

3. **Consultar documentación:**
   - `PRICE-SYNC-GUIDE.md`
   - `PRICE-SYNC-README.md`

4. **Debug manual:**
   ```bash
   # Test endpoint de diagnóstico
   curl https://tu-backend.railway.app/admin/diagnostic
   ```

---

## ✅ Deploy Exitoso!

Si completaste todos los pasos, tu aplicación debería estar:
- ✅ Corriendo en Railway
- ✅ Sincronizando productos automáticamente
- ✅ Sincronizando precios cada 6 horas
- ✅ Lista para producción

---

**Fecha:** Octubre 7, 2025
**Plataforma:** Railway
**Stack:** MedusaJS 2.0 + PostgreSQL + Odoo

