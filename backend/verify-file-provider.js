#!/usr/bin/env node

/**
 * Script para verificar el estado actual del proveedor de archivos
 * y diagnosticar problemas con presigned URLs
 */

console.log('🔍 Verificando configuración actual del proveedor de archivos...\n');

// Verificar variables de entorno actuales
const envVars = {
  // AWS S3
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  AWS_S3_REGION: process.env.AWS_S3_REGION,
  AWS_S3_ACCESS_KEY_ID: process.env.AWS_S3_ACCESS_KEY_ID,
  AWS_S3_SECRET_ACCESS_KEY: process.env.AWS_S3_SECRET_ACCESS_KEY,
  AWS_S3_ENDPOINT: process.env.AWS_S3_ENDPOINT,
  
  // MinIO
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
  MINIO_BUCKET: process.env.MINIO_BUCKET,
};

console.log('📋 Estado actual de las variables:');
console.log('=====================================');

// Verificar AWS S3
const s3Configured = envVars.AWS_S3_BUCKET && envVars.AWS_S3_REGION && 
                     envVars.AWS_S3_ACCESS_KEY_ID && envVars.AWS_S3_SECRET_ACCESS_KEY;

console.log('\n🔵 AWS S3:');
console.log(`  AWS_S3_BUCKET: ${envVars.AWS_S3_BUCKET ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`  AWS_S3_REGION: ${envVars.AWS_S3_REGION ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`  AWS_S3_ACCESS_KEY_ID: ${envVars.AWS_S3_ACCESS_KEY_ID ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`  AWS_S3_SECRET_ACCESS_KEY: ${envVars.AWS_S3_SECRET_ACCESS_KEY ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`  AWS_S3_ENDPOINT: ${envVars.AWS_S3_ENDPOINT ? '✅ Configurado' : '❌ No configurado'}`);

// Verificar MinIO
const minioConfigured = envVars.MINIO_ENDPOINT && envVars.MINIO_ACCESS_KEY && envVars.MINIO_SECRET_KEY;

console.log('\n🟡 MinIO:');
console.log(`  MINIO_ENDPOINT: ${envVars.MINIO_ENDPOINT ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`  MINIO_ACCESS_KEY: ${envVars.MINIO_ACCESS_KEY ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`  MINIO_SECRET_KEY: ${envVars.MINIO_SECRET_KEY ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`  MINIO_BUCKET: ${envVars.MINIO_BUCKET ? '✅ Configurado' : '❌ No configurado'}`);

// Determinar proveedor actual
console.log('\n🎯 Proveedor que debería estar activo:');
console.log('=====================================');

if (s3Configured) {
  console.log('✅ AWS S3 (Prioridad alta)');
  console.log('   Soporte para presigned URLs: ✅ SÍ');
  console.log(`   Bucket: ${envVars.AWS_S3_BUCKET}`);
  console.log(`   Región: ${envVars.AWS_S3_REGION}`);
  console.log(`   Endpoint: ${envVars.AWS_S3_ENDPOINT || 'AWS S3 estándar'}`);
} else if (minioConfigured) {
  console.log('✅ MinIO (Segunda prioridad)');
  console.log('   Soporte para presigned URLs: ✅ SÍ');
  console.log(`   Endpoint: ${envVars.MINIO_ENDPOINT}`);
  console.log(`   Bucket: ${envVars.MINIO_BUCKET || 'medusa-media (default)'}`);
} else {
  console.log('❌ Local File Provider (Fallback)');
  console.log('   Soporte para presigned URLs: ❌ NO');
  console.log('   🚨 ESTE ES EL PROBLEMA - El proveedor local no soporta URLs firmadas');
}

// Recomendaciones
console.log('\n🛠️  RECOMENDACIONES:');
console.log('=====================================');

if (!s3Configured && !minioConfigured) {
  console.log('\n🚨 PROBLEMA DETECTADO:');
  console.log('   Ningún proveedor compatible con presigned URLs está configurado.');
  console.log('   El sistema está usando el proveedor local que NO soporta URLs firmadas.');
  
  console.log('\n✅ SOLUCIÓN:');
  console.log('   1. Configura las variables de S3 O MinIO correctamente');
  console.log('   2. Reinicia el servicio Backend');
  console.log('   3. Verifica que las variables tengan los valores correctos del bucket');
} else if (s3Configured || minioConfigured) {
  console.log('\n✅ CONFIGURACIÓN CORRECTA:');
  console.log('   Las variables están configuradas correctamente.');
  console.log('   Si el error persiste, puede ser que:');
  console.log('   1. El servicio no se reinició después de cambiar las variables');
  console.log('   2. Las variables tienen valores incorrectos');
  console.log('   3. Hay un problema de conectividad con el bucket');
  
  console.log('\n🔧 PASOS DE TROUBLESHOOTING:');
  console.log('   1. Verifica que el deploy se completó correctamente');
  console.log('   2. Revisa los logs del servicio Backend en Railway');
  console.log('   3. Verifica que las variables tengan los valores exactos del bucket');
}

console.log('\n📚 Para más detalles: backend/S3-SETUP-GUIDE.md');
