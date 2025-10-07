# 🧪 Prueba rápida de sincronización de variantes

## Pasos para probar con "Pantalones cortos"

### 1. Inicia el backend de Medusa

```bash
cd backend
npm run dev
```

Espera a que el servidor inicie completamente (verás algo como `Server is ready on port 9000`)

### 2. En otra terminal, ejecuta el script de debug

```bash
cd backend
node debug-sync-pantalones.js
```

Este script automáticamente:
- ✅ Inspeccionará la estructura del producto "Pantalones cortos"
- ✅ Mostrará sus variantes (L, M, S, XL)
- ✅ Sincronizará el producto a Odoo con sus variantes

### 3. Verifica en Odoo

1. Abre Odoo → Inventario → Productos
2. Busca "Pantalones cortos"
3. Abre el producto
4. Ve a la pestaña **"Atributos y variantes"**
5. Deberías ver:
   - **Atributo**: Size (o Talla)
   - **Valores**: L, M, S, XL
6. Ve a la pestaña **"Variantes"**
   - Verás 4 variantes generadas automáticamente

## ⚡ Método alternativo (usando cURL)

Si prefieres usar cURL directamente:

### Paso 1: Obtén el ID del producto

```bash
curl http://localhost:9000/admin/debug-product-variants?title=Pantalones%20cortos
```

Busca el `"id"` en la respuesta

### Paso 2: Sincroniza el producto

```bash
curl -X POST http://localhost:9000/admin/sync-to-odoo \
  -H "Content-Type: application/json" \
  -d "{\"productIds\": [\"TU_PRODUCTO_ID_AQUI\"]}"
```

## 🐛 Si algo no funciona

### El backend no inicia
- Verifica que estás en el directorio `backend`
- Asegúrate de tener las dependencias instaladas: `npm install`

### "Backend is not running"
- El backend debe estar corriendo en `http://localhost:9000`
- Usa dos terminales: una para el backend, otra para el script

### No se crean los atributos en Odoo
- Verifica las variables de entorno de Odoo:
  - `ODOO_URL`
  - `ODOO_DATABASE`
  - `ODOO_USERNAME`
  - `ODOO_PASSWORD` o `ODOO_API_KEY`
- Revisa los logs del backend para ver errores específicos

## 📊 Logs esperados

Durante la sincronización verás logs como:

```
🔄 Sincronizando 4 variantes para producto 123...
🔍 Procesando opciones como objeto para L: { Size: 'L' }
🔍 Procesando opciones como objeto para M: { Size: 'M' }
🔍 Procesando opciones como objeto para S: { Size: 'S' }
🔍 Procesando opciones como objeto para XL: { Size: 'XL' }
📊 Atributos detectados: { Size: [ 'L', 'M', 'S', 'XL' ] }
✅ Atributo encontrado: Size (ID: 1)
✅ Variantes sincronizadas exitosamente
```

## ✅ Resultado esperado en Odoo

**Antes**: Pestaña "Atributos y variantes" vacía ❌

**Después**:
```
Atributo         | Valores
-----------------|------------------
Size (Talla)    | L, M, S, XL
```

Y en la pestaña "Variantes" verás 4 productos variantes generados automáticamente.

## 🎯 Próximos pasos

Una vez que funcione con "Pantalones cortos":
1. Prueba con otros productos que tengan variantes
2. Crea nuevos productos con variantes desde el admin panel
3. Las variantes se sincronizarán automáticamente al crear/editar productos

---

**¿Problemas?** Revisa `SYNC-VARIANTS-GUIDE.md` para información más detallada.

