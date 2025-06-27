'use server';

import db from '@/lib/db';
import type { Client } from '@/lib/types';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';

/**
 * Finds a client by name or creates a new one if not found.
 * Can optionally associate a source partner.
 * Returns the client object (either existing or newly created).
 * Accepts an optional existing connection to participate in a transaction.
 */
export async function findOrCreateClientByName(clientName: string, sourcePartnerId?: string | null, existingConnection?: PoolConnection): Promise<Client> {
  if (!clientName || clientName.trim() === '') {
    throw new Error('Client name cannot be empty.');
  }

  const connection = existingConnection || await db.getConnection();
  try {
    const trimmedClientName = clientName.trim();
    
    // Check if client exists
    const [existingClients] = await connection.query<RowDataPacket[]>(
      `SELECT c.id, c.name, c.source_partner_id, p.name as source_partner_name 
       FROM clients c
       LEFT JOIN partners p ON c.source_partner_id = p.id
       WHERE c.name = ?`,
      [trimmedClientName]
    );

    if (existingClients.length > 0) {
      const existingClient = existingClients[0];
      // If found, and sourcePartnerId is provided, update it if different
      if (sourcePartnerId !== undefined && String(existingClient.source_partner_id || '') !== String(sourcePartnerId || '')) {
         await connection.execute('UPDATE clients SET source_partner_id = ? WHERE id = ?', [sourcePartnerId || null, existingClient.id]);
         existingClient.source_partner_id = sourcePartnerId || null;
         // Re-fetch partner name if source partner changed
         if (sourcePartnerId) {
            const [partnerNameResult] = await connection.query<RowDataPacket[]>('SELECT name FROM partners WHERE id = ?', [sourcePartnerId]);
            existingClient.source_partner_name = partnerNameResult[0]?.name || null;
         } else {
            existingClient.source_partner_name = null;
         }
      }
      return { 
          id: String(existingClient.id), 
          name: existingClient.name, 
          sourcePartnerId: existingClient.source_partner_id ? String(existingClient.source_partner_id) : null,
          sourcePartnerName: existingClient.source_partner_name || null 
        };
    }

    // Client does not exist, create new
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO clients (name, source_partner_id) VALUES (?, ?)',
      [trimmedClientName, sourcePartnerId || null]
    );

    if (result.insertId && result.insertId > 0) {
      let newClientSourcePartnerName: string | null = null;
      if (sourcePartnerId) {
        const [partnerNameResult] = await connection.query<RowDataPacket[]>('SELECT name FROM partners WHERE id = ?', [sourcePartnerId]);
        newClientSourcePartnerName = partnerNameResult[0]?.name || null;
      }
      return { 
          id: String(result.insertId), 
          name: trimmedClientName, 
          sourcePartnerId: sourcePartnerId ? String(sourcePartnerId) : null,
          sourcePartnerName: newClientSourcePartnerName
        };
    } else {
      throw new Error('Failed to create client: No valid insertId returned.');
    }
  } catch (error: any) {
    if (error.message.includes('No valid insertId returned')) {
        throw error;
    }
    throw new Error(`Failed to find or create client "${clientName}".`);
  } finally {
    if (!existingConnection && connection) {
      connection.release();
    }
  }
}

/**
 * Fetches all clients from the database, including their source partner's name.
 */
export async function getAllClientsFromDB(): Promise<Client[]> {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>(`
      SELECT c.id, c.name, c.source_partner_id, p.name as source_partner_name
      FROM clients c
      LEFT JOIN partners p ON c.source_partner_id = p.id
      ORDER BY c.name ASC
    `);
    return rows.map(row => ({ 
        id: String(row.id), 
        name: row.name,
        sourcePartnerId: row.source_partner_id ? String(row.source_partner_id) : null,
        sourcePartnerName: row.source_partner_name || null,
    }));
  } catch (error: any) {
    throw new Error('Failed to fetch clients from database.');
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Updates an existing client's name and/or source partner in the database.
 */
export async function updateClientInDB(client: Client): Promise<Client | null> {
  const { id, name, sourcePartnerId } = client;
  if (!id || !name || name.trim() === '') {
    throw new Error('Client ID and a valid name are required for update.');
  }
  const connection = await db.getConnection();
  try {
    
    // Check for duplicate name if name is being changed
    const [existingClient] = await connection.query<RowDataPacket[]>('SELECT name FROM clients WHERE id = ?', [id]);
    if (existingClient.length === 0) {
        throw new Error(`Cliente com ID ${id} não encontrado.`);
    }
    if (existingClient[0].name !== name.trim()) {
        const [duplicateNameCheck] = await connection.query<RowDataPacket[]>('SELECT id FROM clients WHERE name = ? AND id != ?', [name.trim(), id]);
        if (duplicateNameCheck.length > 0) {
            throw new Error(`Já existe um cliente com o nome "${name.trim()}".`);
        }
    }
    
    const [result] = await connection.execute<ResultSetHeader>(
      'UPDATE clients SET name = ?, source_partner_id = ? WHERE id = ?',
      [name.trim(), sourcePartnerId || null, id]
    );

    if (result.affectedRows > 0) {
      let updatedSourcePartnerName: string | null = null;
      if (sourcePartnerId) {
          const [partnerRow] = await connection.query<RowDataPacket[]>('SELECT name FROM partners WHERE id = ?', [sourcePartnerId]);
          updatedSourcePartnerName = partnerRow[0]?.name || null;
      }
      return { id: id, name: name.trim(), sourcePartnerId: sourcePartnerId || null, sourcePartnerName: updatedSourcePartnerName };
    } else {
      const [currentClients] = await connection.query<RowDataPacket[]>(
        `SELECT c.id, c.name, c.source_partner_id, p.name as source_partner_name 
         FROM clients c LEFT JOIN partners p ON c.source_partner_id = p.id 
         WHERE c.id = ?`, [id]);
      if (currentClients.length > 0) {
        const currentRow = currentClients[0];
        return { 
            id: String(currentRow.id), 
            name: currentRow.name,
            sourcePartnerId: currentRow.source_partner_id ? String(currentRow.source_partner_id) : null,
            sourcePartnerName: currentRow.source_partner_name || null,
        };
      }
      return null; // Client not found
    }
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Já existe um cliente com o nome')) {
        throw error; // Re-throw specific errors
    }
    throw new Error(`Failed to update client "${name.trim()}".`);
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

    // Check if client is associated with any OS
    const [osCountResult] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM os_table WHERE cliente_id = ?',
      [clientId]
    );
    const osCount = osCountResult[0].count;

    if (osCount > 0) {
      throw new Error(`Não é possível excluir este cliente pois ele está vinculado a ${osCount} Ordem(ns) de Serviço. Desassocie-o das OSs primeiro.`);
    }

    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM clients WHERE id = ?',
      [clientId]
    );

    if (result.affectedRows > 0) {
      return true;
    } else {
      return false; // Client not found
    }
  } catch (error: any) {
     // If the error is the one we threw, re-throw it.
    if (error.message.startsWith('Não é possível excluir este cliente pois ele está vinculado')) {
        throw error;
    }
    // Check for other potential foreign key errors if any exist (though unlikely for clients table beyond OS)
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
         throw new Error('Não é possível excluir este cliente pois ele está referenciado em outros registros.');
    }
    throw new Error(`Failed to delete client ID ${clientId}.`);
  } finally {
    if (connection) connection.release();
  }
}
