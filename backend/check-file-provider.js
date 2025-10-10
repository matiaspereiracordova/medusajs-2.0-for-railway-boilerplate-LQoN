#!/usr/bin/env node

/**
 * Script para verificar qué proveedor de archivos está siendo usado
 * y proporcionar instrucciones para configurar S3/MinIO
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de proveedor de archivos...\n');

// Verificar variables de entorno
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
  
  // Railway Bucket (si existe)
  BUCKET_ENDPOINT: process.env.BUCKET_ENDPOINT,
  BUCKET_ACCESS_KEY: process.env.BUCKET_ACCESS_KEY,
  BUCKET_SECRET_KEY: process.env.BUCKET_SECRET_KEY,
  BUCKET_NAME: process.env.BUCKET_NAME,
};

console.log('📋 Variables de entorno detectadas:');
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

// Verificar Railway Bucket
const bucketConfigured = envVars.BUCKET_ENDPOINT && envVars.BUCKET_ACCESS_KEY && 
                        envVars.BUCKET_SECRET_KEY && envVars.BUCKET_NAME;

console.log('\n🟢 Railway Bucket:');
console.log(`  BUCKET_ENDPOINT: ${envVars.BUCKET_ENDPOINT ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`  BUCKET_ACCESS_KEY: ${envVars.BUCKET_ACCESS_KEY ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`  BUCKET_SECRET_KEY: ${envVars.BUCKET_SECRET_KEY ? '✅ Configurado' : '❌ No configurado'}`);
console.log(`  BUCKET_NAME: ${envVars.BUCKET_NAME ? '✅ Configurado' : '❌ No configurado'}`);

// Determinar proveedor actual
console.log('\n🎯 Proveedor de archivos actual:');
console.log('=====================================');

if (s3Configured) {
  console.log('✅ AWS S3 (Configurado correctamente)');
  console.log('   Soporte para presigned URLs: ✅ SÍ');
} else if (minioConfigured) {
  console.log('✅ MinIO (Configurado correctamente)');
  console.log('   Soporte para presigned URLs: ✅ SÍ');
} else if (bucketConfigured) {
  console.log('✅ Railway Bucket (Configurado correctamente)');
  console.log('   Soporte para presigned URLs: ✅ SÍ');
} else {
  console.log('❌ Local File Provider (NO soporta presigned URLs)');
  console.log('   Soporte para presigned URLs: ❌ NO');
  console.log('\n🚨 PROBLEMA DETECTADO:');
  console.log('   El proveedor local no soporta URLs firmadas para subidas.');
  console.log('   Esto causa el error "Provider does not support presigned upload URLs"');
}

// Proporcionar soluciones
console.log('\n🛠️  SOLUCIONES RECOMENDADAS:');
console.log('=====================================');

if (bucketConfigured && !s3Configured) {
  console.log('\n🎯 OPCIÓN 1: Usar Railway Bucket (MÁS FÁCIL)');
  console.log('Ya tienes un Railway Bucket configurado. Solo necesitas mapear las variables:');
  console.log('\nEn tu servicio Backend de Railway, agrega estas variables:');
  console.log(`AWS_S3_BUCKET=${envVars.BUCKET_NAME}`);
  console.log('AWS_S3_REGION=auto');
  console.log(`AWS_S3_ACCESS_KEY_ID=${envVars.BUCKET_ACCESS_KEY}`);
  console.log(`AWS_S3_SECRET_ACCESS_KEY=${envVars.BUCKET_SECRET_KEY}`);
  console.log(`AWS_S3_ENDPOINT=${envVars.BUCKET_ENDPOINT}`);
}

if (!bucketConfigured && !s3Configured && !minioConfigured) {
  console.log('\n🎯 OPCIÓN 1: Agregar Railway Bucket (RECOMENDADO)');
  console.log('1. Ve a tu proyecto en Railway');
  console.log('2. Haz clic en "+ New" → "Database" → "Bucket"');
  console.log('3. Una vez creado, Railway te proporcionará automáticamente las variables');
  console.log('4. Configura las variables en tu servicio Backend (ver guía en S3-SETUP-GUIDE.md)');
  
  console.log('\n🎯 OPCIÓN 2: Configurar AWS S3');
  console.log('1. Crea un bucket en AWS S3');
  console.log('2. Crea un usuario IAM con permisos S3');
  console.log('3. Configura las variables de entorno en Railway');
  console.log('4. Ver guía completa en S3-SETUP-GUIDE.md');
  
  console.log('\n🎯 OPCIÓN 3: Configurar MinIO');
  console.log('1. Configura un servidor MinIO');
  console.log('2. Configura las variables MINIO_* en Railway');
  console.log('3. Ver guía completa en S3-SETUP-GUIDE.md');
}

console.log('\n📚 Para más detalles, consulta: backend/S3-SETUP-GUIDE.md');
console.log('\n🔄 Después de configurar, reinicia tu servicio Backend en Railway.');
