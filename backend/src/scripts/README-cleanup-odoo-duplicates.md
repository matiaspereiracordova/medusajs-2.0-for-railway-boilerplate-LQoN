# Limpieza de Duplicados de Odoo

Este conjunto de scripts y APIs permite identificar y eliminar productos duplicados en Odoo que se crearon durante la sincronización bidireccional con MedusaJS.

## Problema

Durante la sincronización bidireccional entre MedusaJS y Odoo, pueden crearse productos duplicados en Odoo debido a:

1. **Problemas en la búsqueda por `x_medusa_id`**: Si el campo `x_medusa_id` no se actualiza correctamente o hay problemas de conectividad
2. **Múltiples ejecuciones de sincronización**: Si se ejecuta la sincronización varias veces sin verificar duplicados
3. **Errores en la lógica de actualización**: Si un producto existe pero no se actualiza correctamente

## Solución

Los scripts identifican duplicados usando múltiples criterios:

1. **Por `x_medusa_id`** (más crítico): Productos que tienen el mismo ID de MedusaJS
2. **Por nombre** (menos crítico): Productos con el mismo nombre (solo si no tienen `x_medusa_id`)
3. **Por código** (menos crítico): Productos con el mismo `default_code` (solo si no tienen `x_medusa_id`)

## Archivos

- `cleanup-odoo-duplicates.ts`: Script principal para identificar y eliminar duplicados
- `test-odoo-cleanup.ts`: Script de prueba para verificar la funcionalidad
- `cleanup-odoo-duplicates-scheduled.ts`: Job programado para limpieza automática
- `api/admin/cleanup-odoo-duplicates/route.ts`: Endpoint de API

## Uso

### 1. Identificar Duplicados (Sin Eliminar)

```bash
# Usando script
npm run identify-odoo-duplicates

# Usando API
GET /admin/cleanup-odoo-duplicates?action=identify
```

### 2. Limpiar Duplicados

```bash
# Usando script
npm run cleanup-odoo-duplicates

# Usando API
POST /admin/cleanup-odoo-duplicates
```

### 3. Prueba de Funcionalidad

```bash
npm run test-odoo-cleanup
```

## Criterios de Eliminación

Para cada grupo de duplicados, se mantiene el producto que:

1. **Está activo** (en lugar de inactivo)
2. **Fue modificado más recientemente** (fecha de `write_date` más reciente)

Los productos duplicados se **desactivan** en lugar de eliminarse para mantener la integridad de los datos.

## Endpoints de API

### GET /admin/cleanup-odoo-duplicates

Obtiene información sobre la API y sus endpoints.

**Respuesta:**
```json
{
  "success": true,
  "message": "API de limpieza de duplicados de Odoo",
  "usage": {
    "identify": "GET /admin/cleanup-odoo-duplicates?action=identify",
    "cleanup": "POST /admin/cleanup-odoo-duplicates"
  }
}
```

### GET /admin/cleanup-odoo-duplicates?action=identify

Identifica duplicados sin eliminarlos.

**Respuesta:**
```json
{
  "success": true,
  "message": "Identificación de duplicados completada",
  "data": {
    "total_products": 150,
    "duplicates_found": 5,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### POST /admin/cleanup-odoo-duplicates

Identifica y elimina duplicados.

**Respuesta:**
```json
{
  "success": true,
  "message": "Limpieza de duplicados de Odoo completada",
  "data": {
    "total_products": 150,
    "duplicate_groups": 3,
    "products_deleted": 6,
    "errors": 0,
    "error_details": [],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Job Programado

El job `cleanup-odoo-duplicates-scheduled` se ejecuta automáticamente todos los días a las 2:00 AM para mantener limpia la base de datos de Odoo.

## Variables de Entorno Requeridas

Asegúrate de que estas variables estén configuradas:

```env
ODOO_URL=https://tu-odoo.com
ODOO_DATABASE=tu_base_de_datos
ODOO_USERNAME=tu_usuario
ODOO_PASSWORD=tu_contraseña
```

## Logs

Los scripts generan logs detallados que incluyen:

- ✅ Operaciones exitosas
- ⚠️ Advertencias
- ❌ Errores
- 📊 Estadísticas de resumen

## Seguridad

- Los productos se **desactivan** en lugar de eliminarse
- Se mantiene un registro de todos los productos procesados
- Los errores se registran para revisión posterior

## Monitoreo

Revisa los logs regularmente para:

1. Verificar que no hay errores de conectividad con Odoo
2. Monitorear la cantidad de duplicados encontrados
3. Asegurar que la limpieza se ejecuta correctamente

## Solución de Problemas

### Error de Autenticación
```
❌ Error de autenticación en Odoo: Variables de entorno no configuradas
```
**Solución**: Verifica que las variables de entorno de Odoo estén configuradas correctamente.

### Error de Conectividad
```
❌ No se pudo conectar con Odoo en https://tu-odoo.com
```
**Solución**: Verifica que la URL de Odoo sea correcta y que el servidor esté ejecutándose.

### Productos No Encontrados
```
⚠️ No se encontraron productos en Odoo para procesar
```
**Solución**: Verifica que hay productos en Odoo y que las credenciales tienen permisos de lectura.
