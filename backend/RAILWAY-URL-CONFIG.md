# 🌐 Configuración de URLs - Railway

## 📍 URLs de tu Deployment

### Backend API
```
https://backend-production-6f9f.up.railway.app
```

### Admin Dashboard
```
https://backend-production-6f9f.up.railway.app/app
```

### Endpoints Importantes

#### Seed Manual
```bash
# POST - Ejecutar seed
curl -X POST https://backend-production-6f9f.up.railway.app/admin/seed

# GET - Verificar disponibilidad
curl https://backend-production-6f9f.up.railway.app/admin/seed
```

#### Health Check
```bash
curl https://backend-production-6f9f.up.railway.app/health
```

#### Store API
```bash
# Listar productos
curl https://backend-production-6f9f.up.railway.app/store/products

# Obtener regiones
curl https://backend-production-6f9f.up.railway.app/store/regions
```

---

## 🛠️ Scripts Específicos para tu Railway

### 1. Verificar Productos
```bash
npm run railway:check
```
Muestra cuántos productos hay en tu BD de Railway.

### 2. Probar Endpoint de Seed
```bash
npm run railway:test-seed
```
Verifica que el endpoint `/admin/seed` está disponible.

### 3. Ejecutar Seed Manualmente
```bash
npm run railway:seed
```
⚠️ Ejecuta el seed vía API (cuidado con duplicados).

---

## 🔍 Verificación Post-Deployment

### Paso 1: Verificar que el servicio está corriendo
```bash
curl https://backend-production-6f9f.up.railway.app/health
```

Respuesta esperada:
```json
{
  "status": "ok"
}
```

### Paso 2: Verificar productos
```bash
npm run railway:check
```

O manualmente:
```bash
curl https://backend-production-6f9f.up.railway.app/store/products?limit=10
```

### Paso 3: Acceder al Admin
1. Ve a: `https://backend-production-6f9f.up.railway.app/app`
2. Si es la primera vez, crea tu usuario admin
3. Navega a **Products** para ver los 50 productos del seed

---

## 🚀 Workflow Completo

### Después de Push a Railway:

```bash
# 1. Espera que termine el deployment en Railway
# 2. Verifica que esté corriendo
curl https://backend-production-6f9f.up.railway.app/health

# 3. Verifica productos
npm run railway:check

# 4. Si no hay productos, revisa logs en Railway
# Busca: "✅ Successfully created 50 products for Chile"

# 5. Si el seed no se ejecutó automáticamente:
npm run railway:seed
```

---

## 📊 Monitoreo

### Ver Logs en Railway:
1. Railway Dashboard
2. Tu proyecto
3. Selecciona el servicio "backend"
4. Click en **Deployments**
5. Click en el último deployment
6. **View Logs**

### Buscar en los logs:
- `🚀 Railway Post-Deploy Script Starting...` - Inicio del script
- `🌱 Running database seed...` - Seed iniciando
- `✅ Successfully created 50 products` - Seed exitoso
- `✅ Seed already completed, skipping...` - Ya se ejecutó antes

---

## 🔄 Re-ejecutar Seed

### Método 1: Variable de Entorno (Recomendado)
1. Railway Dashboard → Variables
2. Add Variable: `FORCE_SEED` = `true`
3. Re-deploy
4. **Elimina la variable después**

### Método 2: API (Rápido)
```bash
npm run railway:seed
```
O:
```bash
curl -X POST https://backend-production-6f9f.up.railway.app/admin/seed
```

### Método 3: Railway Terminal
1. Railway Dashboard → tu servicio
2. Settings → Terminal
3. Ejecuta:
```bash
npx medusa exec ./src/scripts/seed.ts
```

---

## 🔗 Links Útiles

- **Admin Dashboard**: https://backend-production-6f9f.up.railway.app/app
- **Store API Docs**: https://backend-production-6f9f.up.railway.app/docs
- **Health Check**: https://backend-production-6f9f.up.railway.app/health
- **Railway Dashboard**: https://railway.app/dashboard

---

## 💡 Tips

### Para desarrollo local con Railway DB:
```bash
# 1. Obtén la DATABASE_URL de Railway
# 2. Agrégala a tu .env local
# 3. Ejecuta:
npm run dev
```

### Para conectar storefront:
En tu storefront, configura:
```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://backend-production-6f9f.up.railway.app
```

---

## 🆘 Troubleshooting

### Error: "Cannot connect to Railway"
- ✅ Verifica que el deployment terminó
- ✅ Verifica la URL: debe terminar en `.railway.app`
- ✅ Revisa que el servicio esté "Active" en Railway

### Error: "No products found"
- ✅ Revisa los logs del deployment
- ✅ Verifica que el seed se ejecutó (busca en logs)
- ✅ Ejecuta manualmente: `npm run railway:seed`

### Error: "Products duplicated"
- ✅ El seed se ejecutó múltiples veces
- ✅ Limpia la BD o elimina duplicados desde el Admin
- ✅ Asegúrate de quitar `FORCE_SEED=true` de Railway

---

**¡Todo listo para producción! 🎉**


