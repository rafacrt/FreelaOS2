// src/lib/auth.ts
// This file contains Node.js specific authentication logic (e.g., database interactions)
// and can re-export Edge-safe functions from auth-edge.ts.

import { cookies } from 'next/headers';
import type { User } from './types';
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE } from './constants';
import { SignJWT, jwtVerify } from 'jose';
import type { RowDataPacket } from 'mysql2/promise';
import db from './db'; 

const JWT_SECRET_KEY = process.env.JWT_SECRET;

if (!JWT_SECRET_KEY) {
  throw new Error('JWT_SECRET environment variable is not set. Please add it to your .env.local file.');
}
const key = new TextEncoder().encode(JWT_SECRET_KEY);

export async function encryptPayload(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Token expires in 7 days
    .sign(key);
}

export async function decryptPayload(token: string): Promise<any | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('Failed to verify JWT or token expired:', error);
    return null;
  }
}

export async function createSession(userId: string, username: string, isAdmin: boolean, isApproved: boolean) {
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const sessionPayload = { userId, username, isAdmin, isApproved, expires };
  const token = await encryptPayload(sessionPayload);

  cookies().set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
    sameSite: 'lax',
  });
  console.log(`[Auth createSession] Session cookie set for user: ${username}`);
}

export async function getSession(): Promise<User | null> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    // console.log('[Auth getSession] No session token found.');
    return null;
  }

  const decryptedPayload = await decryptPayload(token);
  if (!decryptedPayload || !decryptedPayload.userId) {
    // console.log('[Auth getSession] Invalid or expired token payload.');
    return null;
  }
  
  // console.log('[Auth getSession] Session token decrypted, payload:', decryptedPayload);
  return {
    id: decryptedPayload.userId as string,
    username: decryptedPayload.username as string,
    isAdmin: decryptedPayload.isAdmin as boolean,
    isApproved: decryptedPayload.isApproved as boolean,
  };
}

export async function logout() {
  cookies().delete(AUTH_COOKIE_NAME);
  console.log('[Auth logout] Session cookie deleted.');
}

// Helper to get user by username from DB (used by login action)
export async function getUserByUsername(username: string): Promise<(User & { password_hash: string }) | null> {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT id, username, password_hash, is_admin, is_approved FROM users WHERE username = ?',
      [username]
    );
    if (rows.length > 0) {
      const userRow = rows[0];
      return {
        id: String(userRow.id),
        username: userRow.username,
        password_hash: userRow.password_hash,
        isAdmin: Boolean(userRow.is_admin),
        isApproved: Boolean(userRow.is_approved),
      };
    }
    return null;
  } catch (error) {
    console.error('[Auth getUserByUsername] Error fetching user:', error);
    throw new Error('Database error while fetching user.');
  } finally {
    connection.release();
  }
}
