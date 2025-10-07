/**
 * Railway Post-Deploy Script for Storefront
 * 
 * Este script se ejecuta después del deploy del storefront para:
 * 1. Obtener la publishable key del backend
 * 2. Obtener la search key de Meilisearch
 * 3. Configurar las variables de entorno necesarias
 */

const https = require('https');

const BACKEND_URL = process.env.BACKEND_URL || 'https://backend-production-6f9f.up.railway.app';
const MEILISEARCH_URL = process.env.MEILISEARCH_URL || 'https://meilisearch-production-b01c.up.railway.app';

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function getPublishableKey() {
  try {
    console.log('🔑 Obteniendo publishable key del backend...');
    
    const response = await fetchWithTimeout(`${BACKEND_URL}/admin/publishable-api-keys`);
    
    if (response.publishable_api_keys && response.publishable_api_keys.length > 0) {
      const key = response.publishable_api_keys[0].id;
      console.log(`✅ Publishable key obtenida: ${key.substring(0, 10)}...`);
      return key;
    } else {
      console.log('⚠️ No se encontró publishable key, creando una nueva...');
      return await createPublishableKey();
    }
  } catch (error) {
    console.error('❌ Error obteniendo publishable key:', error.message);
    return null;
  }
}

async function createPublishableKey() {
  try {
    console.log('🔑 Creando nueva publishable key...');
    
    const response = await fetchWithTimeout(`${BACKEND_URL}/admin/publishable-api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, {
      title: 'Storefront Key',
      type: 'publishable'
    });
    
    if (response.publishable_api_key) {
      const key = response.publishable_api_key.id;
      console.log(`✅ Nueva publishable key creada: ${key.substring(0, 10)}...`);
      return key;
    }
  } catch (error) {
    console.error('❌ Error creando publishable key:', error.message);
  }
  return null;
}

async function getSearchKey() {
  try {
    console.log('🔍 Obteniendo search key de Meilisearch...');
    
    const response = await fetchWithTimeout(`${MEILISEARCH_URL}/keys`);
    
    if (response.results && response.results.length > 0) {
      const searchKey = response.results.find(key => 
        key.name === 'Default Search API Key'
      );
      
      if (searchKey) {
        console.log(`✅ Search key obtenida: ${searchKey.key.substring(0, 10)}...`);
        return searchKey.key;
      }
    }
  } catch (error) {
    console.error('❌ Error obteniendo search key:', error.message);
  }
  return null;
}

async function main() {
  console.log('🚀 Iniciando configuración post-deploy del storefront...');
  
  // Obtener publishable key
  const publishableKey = await getPublishableKey();
  if (publishableKey) {
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = publishableKey;
    console.log('✅ NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY configurada');
  }
  
  // Obtener search key
  const searchKey = await getSearchKey();
  if (searchKey) {
    process.env.NEXT_PUBLIC_SEARCH_API_KEY = searchKey;
    console.log('✅ NEXT_PUBLIC_SEARCH_API_KEY configurada');
  }
  
  // Configurar URL del backend
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = BACKEND_URL;
  console.log(`✅ NEXT_PUBLIC_MEDUSA_BACKEND_URL configurada: ${BACKEND_URL}`);
  
  // Configurar base URL
  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'http://localhost:3000';
  process.env.NEXT_PUBLIC_BASE_URL = baseUrl;
  console.log(`✅ NEXT_PUBLIC_BASE_URL configurada: ${baseUrl}`);
  
  console.log('🎉 Configuración post-deploy completada');
}

main().catch(console.error);
