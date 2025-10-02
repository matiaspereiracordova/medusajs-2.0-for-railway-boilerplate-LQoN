# Sincronización de Productos con ODOO

Este documento explica cómo funciona la sincronización de productos entre MedusaJS y ODOO.

## Configuración

### Variables de Entorno Requeridas

Asegúrate de tener las siguientes variables de entorno configuradas:

```env
ODOO_URL=https://tu-instancia-odoo.com
ODOO_DATABASE=tu_base_de_datos
ODOO_USERNAME=tu_usuario
ODOO_PASSWORD=tu_contraseña
```

### Configuración en ODOO

Para que la sincronización funcione correctamente, necesitas:

1. **Campo personalizado**: Crear un campo personalizado `x_medusa_id` en el modelo `product.template` en ODOO para almacenar el ID de Medusa.

2. **Permisos**: Asegurar que el usuario tenga permisos para crear y actualizar productos.

## Uso

### Sincronización Automática

El sistema ejecuta automáticamente la sincronización cada 6 horas mediante un job programado:

```typescript
// Configurado en: src/jobs/sync-products-to-odoo.ts
export const config = {
  name: "sync-products-to-odoo",
  schedule: "0 */6 * * *", // Cada 6 horas
}
```

### Sincronización Manual via API

#### Endpoint POST `/admin/sync-to-odoo`

Sincroniza productos manualmente.

**Parámetros del cuerpo de la petición:**
```json
{
  "limit": 50,           // Número máximo de productos a sincronizar (opcional, default: 50)
  "offset": 0,           // Offset para paginación (opcional, default: 0)
  "productIds": ["id1", "id2"]  // IDs específicos de productos (opcional)
}
```

**Ejemplo de respuesta exitosa:**
```json
{
  "success": true,
  "message": "Sincronización completada exitosamente",
  "data": {
    "syncedProducts": 5,
    "createdProducts": 3,
    "updatedProducts": 2,
    "errorCount": 0,
    "errors": [],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Endpoint GET `/admin/sync-to-odoo`

Obtiene información sobre la API de sincronización.

**Parámetros de consulta:**
- `action=test-connection`: Prueba la conexión con la API

### Sincronización Manual via Script

Ejecuta el script de prueba para sincronizar solo 2 productos:

```bash
cd backend
npx medusa exec ./src/scripts/test-sync-odoo.ts
```

## Flujo de Sincronización

1. **Obtener productos de Medusa**: El sistema obtiene los productos desde MedusaJS con sus variantes, categorías y precios.

2. **Transformar datos**: Los productos se transforman al formato requerido por ODOO:
   - `name`: Título del producto
   - `code`: Handle del producto o ID generado
   - `list_price`: Precio del primer variant
   - `x_medusa_id`: ID del producto en Medusa
   - `description`: Descripción del producto
   - `active`: Estado basado en el status de publicación

3. **Verificar existencia**: Se verifica si el producto ya existe en ODOO usando el campo `x_medusa_id`.

4. **Crear o actualizar**: 
   - Si existe: Se actualiza el producto
   - Si no existe: Se crea un nuevo producto

## Mapeo de Datos

| MedusaJS | ODOO | Descripción |
|----------|------|-------------|
| `product.title` | `name` | Nombre del producto |
| `product.handle` | `code` | Código del producto |
| `product.variants[0].prices[0].amount` | `list_price` | Precio (convertido de centavos) |
| `product.id` | `x_medusa_id` | ID de referencia a Medusa |
| `product.description` | `description` | Descripción del producto |
| `product.status` | `active` | Estado activo/inactivo |

## Monitoreo y Logs

El sistema genera logs detallados durante la sincronización:

```
🔄 Iniciando sincronización de productos hacia ODOO...
📦 Producto transformado: Medusa T-Shirt
📤 Procesando: Medusa T-Shirt
➕ Creando nuevo producto en ODOO: Medusa T-Shirt
✅ Producto creado en ODOO: Medusa T-Shirt (ID: 123)
📊 Resumen de sincronización:
   ✅ Productos creados: 3
   🔄 Productos actualizados: 2
   ❌ Errores: 0
```

## Solución de Problemas

### Error de Autenticación
- Verifica que las credenciales de ODOO sean correctas
- Asegúrate de que el usuario tenga permisos necesarios

### Error de Conexión
- Verifica que la URL de ODOO sea accesible
- Comprueba que el servidor ODOO esté ejecutándose

### Productos no se sincronizan
- Verifica que existan productos en MedusaJS
- Revisa los logs para errores específicos
- Comprueba que el campo `x_medusa_id` esté creado en ODOO

### Precios incorrectos
- Los precios se convierten de centavos a unidades
- Verifica que los productos tengan variantes con precios

## Personalización

### Modificar campos sincronizados

Edita el archivo `src/workflows/sync-to-odoo.ts` en la función `transformProductsStep`:

```typescript
const odooProductData = {
  name: product.title,
  code: product.handle || `MEDUSA_${product.id}`,
  list_price: productPrice,
  // Agregar más campos aquí
  custom_field: product.customValue,
}
```

### Cambiar frecuencia de sincronización

Modifica el cron en `src/jobs/sync-products-to-odoo.ts`:

```typescript
export const config = {
  name: "sync-products-to-odoo",
  schedule: "0 */2 * * *", // Cada 2 horas
}
```

### Filtrar productos específicos

Modifica la consulta en `getMedusaProductsStep`:

```typescript
products = await productModuleService.listProducts(
  {
    // Agregar filtros aquí
    status: "published",
    categories: ["ropa"],
  },
  {
    relations: ["variants", "categories", "tags"],
    take: limit,
    skip: offset,
  }
)
```

