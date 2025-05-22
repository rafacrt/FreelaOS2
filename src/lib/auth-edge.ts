
// src/lib/auth-edge.ts
// This file contains authentication logic that is safe to run in the Edge Runtime.
// It does NOT include database interactions.

import type { User } from './types';
import { SignJWT, jwtVerify } from 'jose';

console.log('[Auth-Edge] Module loaded. Attempting to read JWT_SECRET from process.env');

// Check if process and process.env are available
if (typeof process === 'undefined' || typeof process.env === 'undefined') {
  console.error('[Auth-Edge] CRITICAL: `process` or `process.env` is undefined in this environment. This is unexpected for Edge Runtime and will prevent JWT_SECRET from being read.');
} else {
  console.log('[Auth-Edge] `process.env` object keys (first 10 for brevity if many):', Object.keys(process.env).slice(0,10).join(', '));
}

let JWT_SECRET_KEY = process.env.JWT_SECRET;
let key: Uint8Array;

if (!JWT_SECRET_KEY || (typeof JWT_SECRET_KEY === 'string' && JWT_SECRET_KEY.trim() === '')) {
  JWT_SECRET_KEY = 'DEFAULT_INSECURE_JWT_SECRET_REPLACE_IN_ENV_LOCAL_IMMEDIATELY_12345'; // Fallback for local dev
  console.warn('**************************************************************************************');
  console.warn('*                                 ATENÇÃO DE SEGURANÇA                                 *');
  console.warn('*                                                                                    *');
  console.warn('* A variável de ambiente JWT_SECRET não foi definida no arquivo .env.local.          *');
  console.warn('* Para fins de desenvolvimento local, uma CHAVE PADRÃO E INSEGURA está sendo usada.  *');
  console.warn('*                                                                                    *');
  console.warn('* ==> NÃO USE ESTA CONFIGURAÇÃO EM PRODUÇÃO OU QUALQUER AMBIENTE REAL. <==           *');
  console.warn('*                                                                                    *');
  console.warn('* Crie um arquivo .env.local na raiz do projeto e adicione:                          *');
  console.warn('* JWT_SECRET=SUA_CHAVE_SECRETA_FORTE_E_ALEATORIA_AQUI                               *');
  console.warn('* E reinicie o servidor Next.js.                                                     *');
  console.warn('**************************************************************************************');
} else {
  console.log(`[Auth-Edge] JWT_SECRET LIDO COM SUCESSO do ambiente. Length: ${JWT_SECRET_KEY.length}.`);
}

try {
  if (typeof JWT_SECRET_KEY !== 'string') {
    console.error('[Auth-Edge] CRITICAL ERROR: JWT_SECRET_KEY is not a string before TextEncoder.encode. Type:', typeof JWT_SECRET_KEY);
    throw new Error('JWT_SECRET_KEY is not a string, cannot encode.');
  }
  key = new TextEncoder().encode(JWT_SECRET_KEY);
  console.log('[Auth-Edge] JWT_SECRET_KEY successfully encoded for JWT operations.');
} catch (error: any) {
  console.error('[Auth-Edge] Failed to encode JWT_SECRET_KEY. This should not happen if the key is a valid string. Error:', error.message, error);
  throw new Error('Failed to process JWT_SECRET. Ensure it is a valid string. Check server logs for details.');
}

export async function encryptPayload(payload: any) {
  if (!key) {
    console.error("[Auth-Edge encryptPayload] CRITICAL: `key` is not initialized. JWT_SECRET was likely not processed correctly.");
    throw new Error("JWT key not initialized for encryption. Check server logs for JWT_SECRET issues.");
  }
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Token expires in 7 days
    .sign(key);
}

export async function decryptPayload(token: string): Promise<any | null> {
  if (!key) {
    console.error("[Auth-Edge decryptPayload] CRITICAL: `key` is not initialized. JWT_SECRET was likely not processed correctly.");
    throw new Error("JWT key not initialized for decryption. Check server logs for JWT_SECRET issues.");
  }
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.warn('[Auth-Edge decryptPayload] Failed to verify JWT or token expired/invalid.');
    return null;
  }
}

export async function getSessionFromToken(tokenValue?: string): Promise<User | null> {
  if (!tokenValue) {
    return null;
  }

  const decryptedPayload = await decryptPayload(tokenValue);
  if (!decryptedPayload || !decryptedPayload.userId) {
    return null;
  }

  return {
    id: decryptedPayload.userId as string,
    username: decryptedPayload.username as string,
    isAdmin: decryptedPayload.isAdmin as boolean,
    isApproved: decryptedPayload.isApproved as boolean,
  };
}
