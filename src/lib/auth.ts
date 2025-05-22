// src/lib/auth.ts
// This file contains Node.js specific authentication logic (e.g., database interactions)
// and can re-export Edge-safe functions from auth-edge.ts.

import type { User } from './types';
import type { RowDataPacket } from 'mysql2/promise';
import db from './db'; // Database import, Node.js specific
export * from './auth-edge'; // Re-export Edge-safe functions like encryptPayload, decryptPayload, getSessionFromToken

// Helper to get user by username from DB (used by login action)
// This function IS NOT Edge-safe because it uses the database.
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
    // In a real app, you might want to throw a more specific error or handle it differently.
    throw new Error('Database error while fetching user.');
  } finally {
    connection.release();
  }
}
