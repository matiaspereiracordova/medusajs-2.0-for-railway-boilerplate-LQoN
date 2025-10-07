# Guía de Sincronización de Variantes de Medusa a Odoo

## ¿Qué se implementó?

Se ha implementado la sincronización completa de variantes de productos desde Medusa hacia Odoo. Cuando un producto tiene múltiples variantes (ej: L, M, S, XL), estas se sincronizan como **atributos y valores** en Odoo.

### Características implementadas:

1. **Creación automática de atributos** - Si un producto tiene variantes con diferentes opciones (Size, Color, etc.), se crean automáticamente los atributos en Odoo
2. **Creación automática de valores** - Los valores específicos (L, M, S, XL) se crean como valores de atributo
3. **Vinculación con productos** - Los atributos se vinculan automáticamente al producto template en Odoo
4. **Generación de variantes** - Odoo generará automáticamente las variantes del producto basándose en los atributos

## Estructura de variantes en Odoo

En Odoo, las variantes se manejan mediante:

- **`product.attribute`** - Define el tipo de atributo (ej: "Size", "Color")
- **`product.attribute.value`** - Define valores específicos (ej: "L", "M", "S", "XL")
- **`product.template.attribute.line`** - Vincula atributos con productos

## Cómo funciona la sincronización

### 1. Detección de variantes

El sistema detecta variantes de dos formas:

- **Si el producto tiene opciones definidas**: Usa `variant.options` (ej: `{ title: "Size", value: "L" }`)
- **Si no hay opciones**: Extrae el valor del SKU o título (ej: "SHORTS-L" → Size: "L")

### 2. Proceso de sincronización

1. Se crea/actualiza el producto principal en Odoo
2. Se analizan las variantes para detectar atributos (Size, Color, etc.)
3. Se crean los atributos en Odoo (si no existen)
4. Se crean los valores de atributos en Odoo (si no existen)
5. Se vinculan los atributos con el producto
6. Odoo genera automáticamente las variantes del producto

## Cómo probar la sincronización

### Opción 1: Usando el Admin Dashboard de Medusa

1. **Inicia el backend de Medusa**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Accede al admin panel**: `http://localhost:9000/app`

3. **Abre el producto "Pantalones cortos"** (o cualquier producto con variantes)

4. **Sincroniza manualmente usando cURL o Postman**:
   ```bash
   curl -X POST http://localhost:9000/admin/sync-to-odoo \
     -H "Content-Type: application/json" \
     -d '{"productIds": ["<ID_DEL_PRODUCTO>"]}'
   ```

### Opción 2: Usando el script de Node.js

1. **Asegúrate de que el backend esté corriendo**:
   ```bash
   cd backend
   npm run dev
   ```

2. **En otra terminal, ejecuta el script de prueba**:
   ```bash
   cd backend
   node test-sync-variants.js
   ```

3. El script automáticamente:
   - Buscará el producto "Pantalones cortos"
   - Mostrará sus variantes
   - Lo sincronizará a Odoo

### Opción 3: Sincronización automática

Cuando creas o actualizas un producto en Medusa, el sistema automáticamente sincroniza el producto y sus variantes a Odoo mediante el subscriber `product-created` y `product-updated`.

## Verificación en Odoo

Después de sincronizar, verifica en Odoo:

1. **Abre el producto en Odoo** (Inventario → Productos)
2. **Ve a la pestaña "Atributos y variantes"**
3. **Deberías ver**:
   - Una línea de atributo (ej: "Size")
   - Los valores del atributo (ej: "L", "M", "S", "XL")
4. **Ve a la pestaña "Variantes"**:
   - Odoo habrá generado automáticamente las variantes del producto

## Ejemplo de producto sincronizado

### En Medusa:
- **Producto**: "Pantalones cortos"
- **Variantes**:
  - L (SKU: SHORTS-L)
  - M (SKU: SHORTS-M)
  - S (SKU: SHORTS-S)
  - XL (SKU: SHORTS-XL)

### En Odoo (después de sincronizar):
- **Producto**: "Pantalones cortos"
- **Atributo**: Size
- **Valores**: L, M, S, XL
- **Variantes generadas**: 4 variantes (una por cada talla)

## Logs de debug

Durante la sincronización, verás logs detallados en la consola:

```
🔄 Sincronizando 4 variantes para producto 123...
🔍 Buscando atributo: Size
✅ Atributo encontrado: Size (ID: 1)
🔍 Buscando valor de atributo: L para atributo ID 1
✅ Valor de atributo encontrado: L (ID: 10)
➕ Agregando línea de atributo al producto 123
✅ Variantes sincronizadas exitosamente para producto 123
```

## Solución de problemas

### No se sincronizan las variantes

**Posible causa**: El producto solo tiene una variante
**Solución**: El sistema solo crea atributos para productos con 2 o más variantes

### Error al crear atributos

**Posible causa**: Falta configuración de Odoo
**Solución**: Verifica que las variables de entorno estén configuradas:
- `ODOO_URL`
- `ODOO_DATABASE`
- `ODOO_USERNAME`
- `ODOO_PASSWORD` (o `ODOO_API_KEY`)

### Las variantes no aparecen en Odoo

**Posible causa**: Las variantes no se generaron automáticamente
**Solución**: En Odoo, ve al producto → "Atributos y variantes" → Click en "Generar variantes" si no se generaron automáticamente

## Archivos modificados

Los siguientes archivos fueron modificados para implementar esta funcionalidad:

1. **`backend/src/modules/odoo/service.ts`**
   - Nuevos métodos: `getOrCreateAttribute`, `getOrCreateAttributeValue`, `addAttributeLineToProduct`, `syncProductVariants`

2. **`backend/src/workflows/sync-to-odoo.ts`**
   - Modificado para incluir sincronización de variantes después de crear/actualizar productos
   - Se incluyen las opciones de variantes en los datos sincronizados

3. **`backend/src/subscribers/product-created.ts`** y **`product-updated.ts`**
   - Usan el workflow actualizado que ahora incluye variantes

## Próximos pasos recomendados

1. ✅ Probar la sincronización con el producto "Pantalones cortos"
2. ✅ Verificar en Odoo que los atributos y variantes se crearon correctamente
3. ✅ Probar con otros productos que tengan diferentes tipos de atributos (Color, Material, etc.)
4. 🔄 Implementar sincronización de precios por variante (próxima tarea)

