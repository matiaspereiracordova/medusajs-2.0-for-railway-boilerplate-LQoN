# 🚀 Quick Start: Sincronización de Precios

## ⚡ 3 Pasos para Empezar

### 1️⃣ Configurar Variables en Railway
```bash
ODOO_URL=https://tu-odoo.com
ODOO_DB=tu_database
ODOO_USERNAME=tu_usuario
ODOO_API_KEY=tu_api_key
BACKEND_URL=https://tu-backend.railway.app
```

### 2️⃣ Hacer Deploy
```bash
git add .
git commit -m "feat: sincronización de precios"
git push origin main
```

### 3️⃣ Sincronizar
```bash
# Estructura
curl -X POST https://tu-backend.railway.app/admin/sync-to-odoo \
  -d '{"limit": 50}'

# Precios
curl -X POST https://tu-backend.railway.app/admin/sync-prices-to-odoo \
  -d '{"limit": 50}'
```

---

## ✅ ¿Qué Obtienes?

### Sincronización Automática
- ✅ Al editar productos → Sync automático
- ✅ Cada 6 horas → Sync programado
- ✅ API manual → Sync bajo demanda

### Precios en Odoo
```
Producto: Pantalón Cargo
├── Precio base: $29.990 (más bajo)
└── Variantes:
    ├── S: $29.990 (extra: $0)
    ├── M: $31.990 (extra: $2.000)
    └── L: $33.990 (extra: $4.000)
```

---

## 🔍 Verificar Funcionamiento

### 1. Ver Logs
```bash
railway logs | grep "PRICE-SYNC"
```

### 2. Test Manual
```bash
# Editar producto en MedusaJS
# Cambiar precio
# Guardar
# → Ver logs de sincronización
```

### 3. Verificar en Odoo
```
Odoo → Ventas → Productos
✅ Ver precio de venta
✅ Ver variantes con precios
```

---

## 📚 Documentación

- **[RESUMEN-SINCRONIZACION-PRECIOS.md](./RESUMEN-SINCRONIZACION-PRECIOS.md)** - Resumen en español
- **[PRICE-SYNC-README.md](./PRICE-SYNC-README.md)** - Referencia rápida
- **[PRICE-SYNC-GUIDE.md](./PRICE-SYNC-GUIDE.md)** - Guía completa
- **[RAILWAY-DEPLOY-INSTRUCTIONS.md](./RAILWAY-DEPLOY-INSTRUCTIONS.md)** - Instrucciones de deploy
- **[SYNC-DIAGRAM.md](./SYNC-DIAGRAM.md)** - Diagramas visuales

---

## 🆘 Ayuda Rápida

### Problema: Precios no se sincronizan
```bash
# Solución:
POST /admin/sync-to-odoo        # Primero
POST /admin/sync-prices-to-odoo # Después
```

### Problema: Job no se ejecuta
```bash
railway restart
railway logs | grep "SCHEDULED-JOB"
```

---

## ✅ Checklist

- [ ] Variables configuradas
- [ ] Deploy exitoso
- [ ] Sincronización inicial ejecutada
- [ ] Precios visibles en Odoo
- [ ] Logs sin errores

---

**¡Listo para producción!** 🎉

