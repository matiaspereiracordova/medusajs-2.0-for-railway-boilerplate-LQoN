# 🇨🇱 Seed de Productos para Chile - Medusa.js

## 📝 Descripción

Este archivo seed está configurado específicamente para crear productos de mascotas (perros) para el mercado chileno, basándose en las categorías de la imagen proporcionada. Los productos se crean automáticamente durante el despliegue en Railway con precios en pesos chilenos (CLP).

## 🎯 Características

- **Región**: Chile (CLP)
- **Productos**: 45+ productos de perros organizados en 7 categorías principales
- **SKUs**: Generados automáticamente desde el nombre del producto
- **Precios**: En pesos chilenos (CLP) con precios realistas del mercado
- **Deploy**: Automático en Railway

## 📦 Categorías de Productos

### 1. **Comida** (8 productos)
- Comida Seca Premium/Adultos/Cachorros
- Comida Húmeda en Lata/Sobres
- Comida Medicada
- Dietas Especiales (Renal/Digestiva)

### 2. **Snacks y Premios** (8 productos)
- Huesos Naturales y Bully Sticks
- Snacks de Carne Natural
- Congelados en Seco
- Snacks Blandos, Galletas
- Snacks de Larga Duración
- Snacks para Higiene Dental

### 3. **Juguetes** (5 productos)
- Juguetes para Morder y Tirar
- Peluches Suaves
- Juguetes para Recuperar
- Dispensadores de Premios
- Juguetes Rompecabezas

### 4. **Accesorios** (10 productos)
- Camas Ortopédicas/Regulares
- Platos y Bowls Antideslizantes
- Correas Retráctiles/Fijas
- Collares y Arneses
- Accesorios de Adiestramiento
- Jaulas y Transportadores

### 5. **Higiene y Baño** (4 productos)
- Toallitas Húmedas
- Pads Absorbentes
- Bolsas Biodegradables
- Pañales Desechables

### 6. **Peluquería** (5 productos)
- Cepillos de Cerdas
- Shampoos Hipoalergénicos
- Acondicionadores
- Corta Uñas Profesional
- Productos Skin Care

### 7. **Farmacia** (6 productos)
- Tratamiento Antipulgas y Garrapatas
- Vitaminas Multivitamínicas
- Suplementos Articulares
- Productos para Alergias
- Termómetro Digital
- Medicamentos Veterinarios

## 🔧 Configuración Técnica

### Archivos Principales

- `backend/src/scripts/seed.ts` - Archivo principal de seed
- `backend/railway-post-deploy.js` - Script de post-deploy para Railway
- `backend/railway.json` - Configuración de Railway

### Generación de SKUs

Los SKUs se generan automáticamente desde el nombre del producto:

```typescript
const generateSku = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15)
    .toUpperCase()
}
```

**Ejemplos:**
- "Comida Seca Premium para Perros" → `COMIDASECAPRE`
- "Huesos Naturales de Res" → `HUESOSNATRES`
- "Shampoos Hipoalergénicos" → `SHAMPOOSHIPO`

### Precios en CLP

Los precios están configurados en pesos chilenos con valores realistas:

- **Comida Premium**: $25,000 - $45,000 CLP
- **Snacks**: $3,200 - $12,000 CLP
- **Juguetes**: $8,900 - $18,500 CLP
- **Accesorios**: $7,500 - $45,000 CLP
- **Higiene**: $3,200 - $12,500 CLP
- **Peluquería**: $6,800 - $15,000 CLP
- **Farmacia**: $15,000 - $35,000 CLP

## 🚀 Deploy en Railway

### Automático

El seed se ejecuta automáticamente durante el primer deploy en Railway:

1. Railway detecta el proyecto
2. Ejecuta `railway-post-deploy.js`
3. Inicializa el backend
4. Ejecuta `seed.ts` con `FORCE_SEED=true`
5. Crea la región de Chile (CLP)
6. Crea todos los productos

### Manual

Si necesitas re-ejecutar el seed:

```bash
# Opción 1: Variable de entorno
FORCE_SEED=true npm run seed

# Opción 2: API endpoint
curl -X POST https://tu-url-railway.com/admin/seed

# Opción 3: Comando directo
npx medusa exec ./src/scripts/seed.ts
```

## 📊 Verificación

### Logs a Buscar

Durante el deploy, deberías ver:

```
🇨🇱 Iniciando seed de productos para Chile...
🌍 Configurando región de Chile...
✅ Región de Chile creada exitosamente
📦 Creando 45 productos para Chile...
✅ Producto creado: Comida Seca Premium para Perros (SKU: COMIDASECAPRE) - $25.000 CLP
...
🎉 Seed completado para Chile:
   ✅ Productos creados: 45
   ❌ Errores: 0
   🇨🇱 Región: Chile (CLP)
```

### Verificar Productos

1. Ve a tu Admin Dashboard de Medusa
2. Navega a Productos
3. Deberías ver 45+ productos organizados por categorías
4. Verifica que los precios estén en CLP

## 🔄 Control de Duplicados

El sistema incluye protección contra duplicados:

- **Archivo marcador**: `.seed-completed` se crea después del primer seed exitoso
- **Verificación de productos**: No crea productos si ya existen (a menos que uses `FORCE_SEED=true`)
- **Verificación de región**: Reutiliza la región de Chile si ya existe

## ⚠️ Advertencias Importantes

1. **No ejecutes múltiples veces** sin `FORCE_SEED=true` (creará duplicados)
2. **Elimina `FORCE_SEED=true`** después de usarlo
3. **Verifica los logs** en Railway después del deploy
4. **Los precios son de ejemplo** - ajusta según tu mercado

## 🛠️ Personalización

### Agregar Productos

Para agregar más productos, edita el array `chileanDogProducts` en `seed.ts`:

```typescript
{
  title: "Nuevo Producto",
  handle: "nuevo-producto",
  description: "Descripción del nuevo producto",
  sku: "NUEVOPRODUCTO",
  category: "Categoría",
  subcategory: "Subcategoría",
  price: 15000
}
```

### Modificar Precios

Ajusta los precios en el array `chileanDogProducts` según tu mercado local.

### Cambiar Categorías

Modifica las categorías y subcategorías según tus necesidades de negocio.

## 📚 Documentación Relacionada

- [RAILWAY-SEED-GUIDE.md](./RAILWAY-SEED-GUIDE.md) - Guía completa de seed en Railway
- [QUICK-SEED-README.md](./QUICK-SEED-README.md) - Referencia rápida
- [Medusa.js Documentation](https://docs.medusajs.com)
- [Railway Documentation](https://docs.railway.app)

## 🆘 Soporte

Si tienes problemas:

1. Revisa los logs completos en Railway
2. Verifica que todas las variables de entorno estén configuradas
3. Asegúrate de que la base de datos esté accesible
4. Contacta al equipo de soporte con logs específicos

---

**Creado para**: Proyecto Medusa.js en Railway
**Región**: Chile (CLP)
**Productos**: 45+ productos de mascotas
**Última actualización**: $(date)
