# 🌱 Quick Seed Reference

## ✅ Scripts Disponibles

```bash
# Ejecutar seed normal (respeta productos existentes)
npm run seed

# Forzar ejecución del seed (ignora productos existentes)
npm run seed:force

# Verificar estado del seed
npm run seed:verify

# Resetear marker para permitir re-ejecución automática
npm run seed:reset

# Ejecutar script de post-deploy (Railway)
npm run railway:post-deploy
```

## 🚀 Railway Deployment

### Primera vez:
1. Configura tu base de datos en Railway
2. Haz push:
   ```bash
   git add .
   git commit -m "Setup seed for Railway"
   git push
   ```
3. El seed se ejecutará automáticamente ✅

### Re-ejecutar seed:
1. Ve a Railway → Variables
2. Agrega: `FORCE_SEED` = `true`
3. Re-deploy
4. **Elimina la variable después**

## 🔍 Verificación Rápida

```bash
# Ver si el seed se ejecutó
npm run seed:verify

# Ver logs en Railway
# Railway Dashboard → tu servicio → Deployments → Logs
```

## ⚠️ Importante

- ❌ **NO** ejecutes el seed múltiples veces sin limpiar la BD (creará duplicados)
- ✅ **SÍ** elimina `FORCE_SEED=true` después de usarlo
- ✅ **SÍ** verifica los logs en Railway después del deployment

## 📚 Documentación Completa

Para guía detallada: `RAILWAY-SEED-GUIDE.md`


