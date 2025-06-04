
// src/lib/auth-edge.ts
import type { User, PartnerSessionData, SessionPayload } from './types'; // Updated imports
import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/env.mjs'; // Import env variables correctly

console.log('[Auth-Edge] Module loaded.');

let key: Uint8Array | null = null; 
const jwtSecretFromEnv = env.JWT_SECRET;
const devLoginEnabled = env.DEV_LOGIN_ENABLED === "true";
const nextPublicDevMode = env.NEXT_PUBLIC_DEV_MODE === "true";

if (jwtSecretFromEnv) {
  console.log('[Auth-Edge] JWT_SECRET read successfully from env.mjs. Length:', jwtSecretFromEnv.length);
  try {
    key = new TextEncoder().encode(jwtSecretFromEnv);
    console.log('[Auth-Edge] JWT_SECRET_KEY successfully encoded for JWT operations.');
  } catch (error: any) {
    console.error('[Auth-Edge] Failed to encode JWT_SECRET_KEY from env.mjs. Error:', error.message, error);
  }
} else {
  // Use fallback key if JWT_SECRET is not set AND (DEV_LOGIN_ENABLED is true OR NEXT_PUBLIC_DEV_MODE is true)
  if (devLoginEnabled || nextPublicDevMode) {
    console.warn(`
    **************************************************************************************
    ** [Auth-Edge] WARNING: JWT_SECRET environment variable is not set or is empty!     **
    ** Using a default, INSECURE key because DEV_LOGIN_ENABLED or NEXT_PUBLIC_DEV_MODE is true. **
    ** This is FOR DEVELOPMENT ONLY and is NOT SECURE for production.                   **
    **************************************************************************************
    `);
    key = new TextEncoder().encode("DEFAULT_INSECURE_FALLBACK_SECRET_FOR_DEV_LOGIN_ONLY_MIN_32_CHARS");
  } else {
    console.error('[Auth-Edge] CRITICAL: JWT_SECRET environment variable is not set or is empty, and neither DEV_LOGIN_ENABLED nor NEXT_PUBLIC_DEV_MODE is "true". Authentication will fail.');
  }
}

// payload here should be SessionPayload
export async function encryptPayload(payload: SessionPayload) { 
  if (!key) {
    console.error("[Auth-Edge encryptPayload] CRITICAL: JWT key is not initialized.");
    throw new Error("JWT key not initialized for encryption. Check server logs for JWT_SECRET issues.");
  }
  // The payload itself now contains sessionType, so no need to add it separately here.
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') 
    .sign(key);
}

export async function decryptPayload(token: string): Promise<SessionPayload | null> {
  if (!key) {
    console.error("[Auth-Edge decryptPayload] CRITICAL: JWT key is not initialized.");
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    // Validate the structure of the payload to ensure it's one of the expected session types
    if (payload.sessionType === 'admin' && payload.id && payload.username && typeof payload.isAdmin === 'boolean' && typeof payload.isApproved === 'boolean') {
        return payload as SessionPayload;
    } else if (payload.sessionType === 'partner' && payload.id && payload.username && payload.partnerName && typeof payload.isApproved === 'boolean') {
        return payload as SessionPayload;
    }
    console.warn('[Auth-Edge decryptPayload] Decrypted payload does not match expected SessionPayload structure:', payload);
    return null;
  } catch (error) {
    console.warn('[Auth-Edge decryptPayload] Failed to verify JWT or token expired/invalid.');
    return null;
  }
}

export async function getSessionFromToken(tokenValue?: string): Promise<SessionPayload | null> {
  if (!tokenValue) {
    return null;
  }
  const decryptedPayload = await decryptPayload(tokenValue);
  if (!decryptedPayload) {
    return null;
  }
  // Basic validation of the payload structure based on sessionType
  if (decryptedPayload.sessionType === 'admin') {
    const adminPayload = decryptedPayload as { sessionType: 'admin' } & User;
    if (adminPayload.id && adminPayload.username && typeof adminPayload.isAdmin === 'boolean' && typeof adminPayload.isApproved === 'boolean') {
      return adminPayload;
    }
  } else if (decryptedPayload.sessionType === 'partner') {
    const partnerPayload = decryptedPayload as { sessionType: 'partner' } & PartnerSessionData;
    if (partnerPayload.id && partnerPayload.username && partnerPayload.partnerName && typeof partnerPayload.isApproved === 'boolean') {
      return partnerPayload;
    }
  }
  console.warn('[Auth-Edge getSessionFromToken] Decrypted payload is missing required fields or has incorrect types for its sessionType:', decryptedPayload);
  return null;
}
