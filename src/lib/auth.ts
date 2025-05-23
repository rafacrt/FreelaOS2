// src/lib/auth.ts
// This file contains Node.js specific authentication logic (e.g., database interactions)
// and re-exports Edge-safe functions from auth-edge.ts.

import type { User } from './types';
import type { RowDataPacket } from 'mysql2/promise';
import db from './db'; // Database import, Node.js specific
export * from './auth-edge'; // Re-export Edge-safe functions like encryptPayload, decryptPayload, getSessionFromToken

// Helper to get user by username from DB (used by login action)
// This function IS NOT Edge-safe because it uses the database.
export async function getUserByUsername(username: string): Promise<(User & { password_hash: string }) | null> {
  const connection = await db.getConnection();
  try {
    console.log(`[Auth getUserByUsername] Fetching user from DB: ${username}`);
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT id, username, password_hash, is_admin, is_approved FROM users WHERE username = ?',
      [username]
    );
    if (rows.length > 0) {
      const userRow = rows[0];
      console.log(`[Auth getUserByUsername] User found: ${username}`);
      return {
        id: String(userRow.id),
        username: userRow.username,
        password_hash: userRow.password_hash,
        isAdmin: Boolean(userRow.is_admin),
        isApproved: Boolean(userRow.is_approved),
      };
    }
    console.log(`[Auth getUserByUsername] User not found: ${username}`);
    return null;
  } catch (error) {
    console.error('[Auth getUserByUsername] Error fetching user:', error);
    // In a real app, you might want to throw a more specific error or handle it differently.
    throw new Error('Database error while fetching user.');
  } finally {
    if (connection) connection.release();
  }
}

// It seems like getSession was intended to be a convenience function to get the token from cookies and then decrypt.
// For Server Components, they can use `cookies()` from `next/headers` directly.
// For client components, middleware handles redirection, but if they need user info, it's passed or fetched via API.
// We already re-export getSessionFromToken from auth-edge.ts.
// If a direct `getSession()` that reads cookies server-side is needed, it would look like this:
// import { cookies } from 'next/headers';
// import { getSessionFromToken as getSessionDataFromToken } from './auth-edge';
// export async function getSession(): Promise<User | null> {
//   const tokenValue = cookies().get(AUTH_COOKIE_NAME)?.value;
//   return await getSessionDataFromToken(tokenValue);
// }
// However, to avoid confusion and direct use of 'next/headers' here,
// components/pages should call `cookies()` themselves and then pass to `getSessionFromToken`.
