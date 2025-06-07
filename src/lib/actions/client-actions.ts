
'use server';

import db from '@/lib/db';
import type { Client } from '@/lib/types';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';

/**
 * Finds a client by name or creates a new one if not found.
 * Returns the client object (either existing or newly created).
 * Accepts an optional existing connection to participate in a transaction.
 */
export async function findOrCreateClientByName(clientName: string, existingConnection?: PoolConnection): Promise<Client> {
  if (!clientName || clientName.trim() === '') {
    throw new Error('Client name cannot be empty.');
  }

  const connection = existingConnection || await db.getConnection();
  try {
    const trimmedClientName = clientName.trim();
    console.log(`[ClientAction] Attempting to find client: "${trimmedClientName}" using ${existingConnection ? 'existing' : 'new'} connection.`);
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
      console.error('[ClientAction] Failed to create client: insertId is 0 or not returned. This often means the `id` column is not AUTO_INCREMENT or a DB constraint failed.', result);
      throw new Error('Failed to create client: No valid insertId returned. Check if `id` column is AUTO_INCREMENT and for other DB constraints.');
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
    // Only release the connection if we acquired it in this function
    if (!existingConnection && connection) {
      connection.release();
    }
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
    if (connection) connection.release();
  }
}

/**
 * Updates an existing client's name in the database.
 */
export async function updateClientInDB(client: Client): Promise<Client | null> {
  if (!client.id || !client.name || client.name.trim() === '') {
    throw new Error('Client ID and a valid name are required for update.');
  }
  const connection = await db.getConnection();
  try {
    console.log(`[ClientAction updateClientInDB] Updating client ID: ${client.id} to name: "${client.name.trim()}"`);
    const [result] = await connection.execute<ResultSetHeader>(
      'UPDATE clients SET name = ? WHERE id = ?',
      [client.name.trim(), client.id]
    );

    if (result.affectedRows > 0) {
      console.log(`[ClientAction updateClientInDB] Client ID: ${client.id} updated successfully.`);
      return { id: client.id, name: client.name.trim() };
    } else {
      console.warn(`[ClientAction updateClientInDB] No client found with ID: ${client.id} to update, or name was the same.`);
      // Fetch the client to ensure we return the current state if no rows were affected because the name was identical
      const [currentClients] = await connection.query<RowDataPacket[]>('SELECT id, name FROM clients WHERE id = ?', [client.id]);
      if (currentClients.length > 0) {
        return { id: String(currentClients[0].id), name: currentClients[0].name };
      }
      return null; // Client not found
    }
  } catch (error: any) {
    console.error(`[ClientAction updateClientInDB] Error updating client ID ${client.id}:`, error);
    if (error.code === 'ER_DUP_ENTRY') {
        throw new Error(`Já existe um cliente com o nome "${client.name.trim()}".`);
    }
    throw new Error(`Failed to update client "${client.name.trim()}".`);
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Deletes a client from the database.
 * Throws an error if the client is associated with any OS.
 */
export async function deleteClientFromDB(clientId: string): Promise<boolean> {
  if (!clientId) {
    throw new Error('Client ID is required for deletion.');
  }
  const connection = await db.getConnection();
  try {
    console.log(`[ClientAction deleteClientFromDB] Attempting to delete client ID: ${clientId}`);

    // Check if client is associated with any OS
    const [osCountResult] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM os_table WHERE cliente_id = ?',
      [clientId]
    );
    const osCount = osCountResult[0].count;

    if (osCount > 0) {
      console.warn(`[ClientAction deleteClientFromDB] Client ID: ${clientId} is associated with ${osCount} OS(s). Deletion aborted.`);
      throw new Error(`Não é possível excluir este cliente pois ele está vinculado a ${osCount} Ordem(ns) de Serviço. Desassocie-o das OSs primeiro.`);
    }

    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM clients WHERE id = ?',
      [clientId]
    );

    if (result.affectedRows > 0) {
      console.log(`[ClientAction deleteClientFromDB] Client ID: ${clientId} deleted successfully.`);
      return true;
    } else {
      console.warn(`[ClientAction deleteClientFromDB] No client found with ID: ${clientId} to delete.`);
      return false; // Client not found
    }
  } catch (error: any) {
     // If the error is the one we threw, re-throw it.
    if (error.message.startsWith('Não é possível excluir este cliente pois ele está vinculado')) {
        throw error;
    }
    console.error(`[ClientAction deleteClientFromDB] Error deleting client ID ${clientId}:`, error);
    // Check for other potential foreign key errors if any exist (though unlikely for clients table beyond OS)
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
         throw new Error('Não é possível excluir este cliente pois ele está referenciado em outros registros.');
    }
    throw new Error(`Failed to delete client ID ${clientId}.`);
  } finally {
    if (connection) connection.release();
  }
}
