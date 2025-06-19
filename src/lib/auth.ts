
// src/lib/auth.ts
import type { User, PartnerSessionData } from './types'; 
import type { RowDataPacket } from 'mysql2/promise';
import db from './db'; 
export * from './auth-edge'; 

// For Admin/Internal Users
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
    console.error("[getUserByUsername] DB Error:", error);
    throw new Error('Database error while fetching user.');
  } finally {
    if (connection) connection.release();
  }
}

// For Partner Users
export async function getPartnerByUsernameOrEmail(identifier: string): Promise<(PartnerSessionData & { password_hash: string }) | null> {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT id, name, username, email, password_hash, is_approved FROM partners WHERE (username = ? OR email = ?) AND password_hash IS NOT NULL',
      [identifier, identifier]
    );
    if (rows.length > 0) {
      const partnerRow = rows[0];
      return {
        id: String(partnerRow.id),
        username: partnerRow.username, 
        partnerName: partnerRow.name,  
        email: partnerRow.email, // Ensure email is selected and returned
        password_hash: partnerRow.password_hash,
        isApproved: Boolean(partnerRow.is_approved),
      };
    }
    return null;
  } catch (error) {
    console.error("[getPartnerByUsernameOrEmail] DB Error:", error);
    throw new Error('Database error while fetching partner.');
  } finally {
    if (connection) connection.release();
  }
}
