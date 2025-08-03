// src/lib/auth-edge.ts
import type { User, PartnerSessionData, SessionPayload } from './types'; // Updated imports
import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/env.mjs'; // Import env variables correctly

let key: Uint8Array | null = null; 
const jwtSecretFromEnv = env.JWT_SECRET;

// No longer needed as env validation handles defaults/presence
// const devLoginEnabled = env.DEV_LOGIN_ENABLED === true;
// const nextPublicDevMode = env.NEXT_PUBLIC_DEV_MODE === true;

if (jwtSecretFromEnv) {
  try {
    key = new TextEncoder().encode(jwtSecretFromEnv);
  } catch (error: any) {
    console.error("Failed to encode JWT_SECRET:", error);
  }
} else {
  // This else block is less critical now because t3-env will throw an error if JWT_SECRET is missing.
  // It's kept as a fallback for scenarios where validation might be skipped.
  console.error("FATAL: JWT_SECRET environment variable is not set. The application will not function securely.");
}

// payload here should be SessionPayload
export async function encryptPayload(payload: SessionPayload) { 
  if (!key) {
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
    console.error("JWT key not initialized for decryption.");
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
    console.warn("Decrypted JWT payload has an invalid structure:", payload);
    return null;
  } catch (error) {
    // This is expected for invalid or expired tokens, so a simple console.log is fine.
    // console.log("JWT verification failed:", error);
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
  return null;
}
