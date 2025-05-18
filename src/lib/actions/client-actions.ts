
'use server';

import db from '@/lib/db';
import type { Client } from '@/lib/types';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';

/**
 * Finds a client by name or creates a new one if not found.
 * Returns the client object (either existing or newly created).
 */
export async function findOrCreateClientByName(clientName: string): Promise<Client> {
  if (!clientName || clientName.trim() === '') {
    throw new Error('Client name cannot be empty.');
  }

  const connection = await db.getConnection();
  try {
    const trimmedClientName = clientName.trim();
    console.log(`[ClientAction] Attempting to find client: "${trimmedClientName}"`);
    // Check if client exists
    const [existingClients] = await connection.query<RowDataPacket[]>(
      'SELECT id, name FROM clients WHERE name = ?',
      [trimmedClientName]
    );

    if (existingClients.length > 0) {
      const existingClient = existingClients[0];
      console.log(`[ClientAction] Found existing client: ID ${existingClient.id}, Name ${existingClient.name}`);
      return { id: String(existingClient.id), name: existingClient.name };
    }

    // Client does not exist, create new
    console.log(`[ClientAction] Client "${trimmedClientName}" not found, creating new.`);
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO clients (name) VALUES (?)',
      [trimmedClientName]
    );

    if (result.insertId && result.insertId > 0) {
      console.log(`[ClientAction] Successfully created client: ID ${result.insertId}, Name ${trimmedClientName}`);
      return { id: String(result.insertId), name: trimmedClientName };
    } else {
      console.error('[ClientAction] Failed to create client: insertId is 0 or not returned. This often means the `id` column is not AUTO_INCREMENT.', result);
      throw new Error('Failed to create client: No valid insertId returned. Check if `id` column is AUTO_INCREMENT.');
    }
  } catch (error: any) {
    console.error('[ClientAction] Original DB error in findOrCreateClientByName:', error);
    // Avoid re-throwing if it's the custom error we just threw
    if (error.message.includes('No valid insertId returned')) {
        throw error;
    }
    console.error(`[ClientAction] Failed to find or create client "${clientName}". Details: ${error.message}`);
    throw new Error(`Failed to find or create client "${clientName}".`);
  } finally {
    connection.release();
  }
}

/**
 * Fetches all clients from the database.
 */
export async function getAllClientsFromDB(): Promise<Client[]> {
  const connection = await db.getConnection();
  try {
    console.log('[ClientAction] Fetching all clients from DB.');
    const [rows] = await connection.query<RowDataPacket[]>('SELECT id, name FROM clients ORDER BY name ASC');
    console.log(`[ClientAction] Found ${rows.length} clients.`);
    return rows.map(row => ({ id: String(row.id), name: row.name }));
  } catch (error: any) {
    console.error('[ClientAction] Original DB error in getAllClientsFromDB:', error);
    console.error(`[ClientAction] Failed to fetch clients. Details: ${error.message}`);
    throw new Error('Failed to fetch clients from database.');
  } finally {
    connection.release();
  }
}
