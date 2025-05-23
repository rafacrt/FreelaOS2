// src/lib/auth-edge.ts
// This file contains authentication logic that is safe to run in the Edge Runtime.
// It should not contain database interactions.

import type { User } from './types';
import { SignJWT, jwtVerify } from 'jose';

console.log('[Auth-Edge] Module loaded. Attempting to read JWT_SECRET from process.env');

// Check if process and process.env are available
if (typeof process === 'undefined' || typeof process.env === 'undefined') {
  console.error('[Auth-Edge] CRITICAL: `process` or `process.env` is undefined in this environment. This is unexpected for Edge Runtime and will prevent JWT_SECRET from being read.');
} else {
  console.log('[Auth-Edge] `process.env` object keys (first 10 for brevity if many):', Object.keys(process.env).slice(0,10).join(', '));
}

const JWT_SECRET_KEY_STRING = process.env.JWT_SECRET;
let key: Uint8Array | null = null; // Initialize key as null

if (JWT_SECRET_KEY_STRING) {
  console.log('[Auth-Edge] JWT_SECRET LIDO COM SUCESSO do ambiente. Length:', JWT_SECRET_KEY_STRING.length);
  try {
    key = new TextEncoder().encode(JWT_SECRET_KEY_STRING);
    console.log('[Auth-Edge] JWT_SECRET_KEY successfully encoded for JWT operations.');
  } catch (error: any) {
    console.error('[Auth-Edge] Failed to encode JWT_SECRET_KEY. This should not happen if the key is a valid string. Error:', error.message, error);
    // key remains null
  }
} else {
  // Use a default, insecure key ONLY if DEV_LOGIN_ENABLED is also true, and log a HUGE warning.
  // This is to prevent complete breakage in dev if .env.local is missing, but it's NOT FOR PRODUCTION.
  if (process.env.DEV_LOGIN_ENABLED === "true") {
    console.warn(`
    **************************************************************************************
    ** [Auth-Edge] WARNING: JWT_SECRET environment variable is not set or is empty!     **
    ** Using a default, INSECURE key because DEV_LOGIN_ENABLED is true.                 **
    ** This is FOR DEVELOPMENT ONLY and is NOT SECURE for production.                   **
    ** Please set a strong JWT_SECRET in your .env.local file for local development,    **
    ** and in your hosting environment variables for production.                        **
    **************************************************************************************
    `);
    key = new TextEncoder().encode("DEFAULT_INSECURE_FALLBACK_SECRET_FOR_DEV_LOGIN_ONLY_MIN_32_CHARS");
  } else {
    console.error('[Auth-Edge] CRITICAL: JWT_SECRET environment variable is not set or is empty, and DEV_LOGIN_ENABLED is not "true". Authentication will fail.');
    // key remains null. Operations requiring the key will fail.
  }
}


export async function encryptPayload(payload: any) {
  if (!key) {
    console.error("[Auth-Edge encryptPayload] CRITICAL: JWT key is not initialized. JWT_SECRET was likely not processed correctly or is missing.");
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
    console.error("[Auth-Edge decryptPayload] CRITICAL: JWT key is not initialized. JWT_SECRET was likely not processed correctly or is missing.");
    // To prevent a hard crash if called client-side where key might legitimately not be (though it shouldn't be called then for verification)
    // we return null, but this is a server-side misconfiguration if key is null.
    return null;
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
    // console.log('[Auth-Edge getSessionFromToken] No tokenValue provided.');
    return null;
  }

  const decryptedPayload = await decryptPayload(tokenValue);
  if (!decryptedPayload) {
    // console.log('[Auth-Edge getSessionFromToken] Failed to decrypt payload or payload is null.');
    return null;
  }
  
  if (!decryptedPayload.userId || typeof decryptedPayload.username !== 'string' || typeof decryptedPayload.isAdmin !== 'boolean' || typeof decryptedPayload.isApproved !== 'boolean') {
    console.warn('[Auth-Edge getSessionFromToken] Decrypted payload is missing required fields or has incorrect types:', decryptedPayload);
    return null;
  }

  const user: User = {
    id: decryptedPayload.userId as string,
    username: decryptedPayload.username as string,
    isAdmin: decryptedPayload.isAdmin as boolean,
    isApproved: decryptedPayload.isApproved as boolean,
  };
  // console.log('[Auth-Edge getSessionFromToken] Session successfully retrieved:', user);
  return user;
}
