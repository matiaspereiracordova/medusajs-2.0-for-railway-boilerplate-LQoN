# Guía de Configuración de S3 para Railway

## Problema
El error "Provider does not support presigned upload URLs" indica que el proveedor de archivos actual no soporta URLs firmadas para subidas. Esto ocurre cuando se usa el proveedor local (`@medusajs/file-local`) en lugar de S3 o MinIO.

## Solución: Configurar AWS S3

### Opción 1: AWS S3 (Recomendado)

#### 1. Crear bucket en AWS S3
1. Ve a [AWS Console](https://console.aws.amazon.com/s3/)
2. Crea un nuevo bucket con un nombre único
3. Configura el bucket para permitir acceso público (si es necesario para imágenes de productos)

#### 2. Crear usuario IAM
1. Ve a [IAM Console](https://console.aws.amazon.com/iam/)
2. Crea un nuevo usuario para el programa
3. Asigna la política `AmazonS3FullAccess` o crea una política personalizada:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:PutObjectAcl",
                "s3:GetObjectAcl"
            ],
            "Resource": "arn:aws:s3:::TU_BUCKET_NAME/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::TU_BUCKET_NAME"
        }
    ]
}
```

#### 3. Configurar variables de entorno en Railway

En tu proyecto de Railway, ve a **Variables** y agrega:

```env
AWS_S3_BUCKET=tu-bucket-name
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY_ID=tu-access-key-id
AWS_S3_SECRET_ACCESS_KEY=tu-secret-access-key
```

### Opción 2: MinIO (Alternativa)

Si prefieres usar MinIO en lugar de AWS S3:

```env
MINIO_ENDPOINT=tu-minio-endpoint.com
MINIO_ACCESS_KEY=tu-access-key
MINIO_SECRET_KEY=tu-secret-key
MINIO_BUCKET=medusa-media
```

### Opción 3: Railway Bucket (Más fácil)

Railway ofrece un servicio de bucket S3-compatible. Para usarlo:

1. En tu proyecto de Railway, agrega un servicio **Bucket**
2. Una vez creado, Railway te proporcionará las variables de entorno automáticamente
3. Las variables se llamarán algo como:
   - `BUCKET_ENDPOINT`
   - `BUCKET_ACCESS_KEY`
   - `BUCKET_SECRET_KEY`
   - `BUCKET_NAME`

4. Configura estas variables en tu servicio Backend:

```env
AWS_S3_BUCKET=${BUCKET_NAME}
AWS_S3_REGION=auto
AWS_S3_ACCESS_KEY_ID=${BUCKET_ACCESS_KEY}
AWS_S3_SECRET_ACCESS_KEY=${BUCKET_SECRET_KEY}
AWS_S3_ENDPOINT=${BUCKET_ENDPOINT}
```

## Verificación

Después de configurar las variables:

1. **Reinicia el servicio Backend** en Railway
2. Ve a la interfaz de administración de Medusa
3. Intenta importar un archivo CSV
4. El error debería desaparecer

## Configuración de CORS (si es necesario)

Si tienes problemas con CORS, configura tu bucket S3:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"]
    }
]
```

## Troubleshooting

### Error persiste después de configurar S3
1. Verifica que las variables de entorno estén correctamente configuradas
2. Reinicia el servicio Backend
3. Verifica los logs del servicio para errores de conexión

### Error de permisos
1. Verifica que el usuario IAM tenga los permisos correctos
2. Verifica que el bucket exista y sea accesible

### Error de CORS
1. Configura CORS en tu bucket S3
2. Verifica que el dominio de tu aplicación esté permitido

## Notas importantes

- El proyecto está configurado para usar S3 como prioridad si está disponible
- Si S3 no está configurado, usará MinIO si está disponible
- Como último recurso, usará almacenamiento local (que no soporta presigned URLs)
- Las URLs firmadas son necesarias para la funcionalidad de importación de archivos CSV