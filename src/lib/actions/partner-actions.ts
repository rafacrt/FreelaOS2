
'use server';

import db from '@/lib/db';
import type { Partner } from '@/store/os-store'; // Using Partner type from store as it's compatible
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * Finds a partner by name or creates a new one if not found.
 * Returns the partner object (either existing or newly created).
 */
export async function findOrCreatePartnerByName(partnerName: string): Promise<Partner> {
  if (!partnerName || partnerName.trim() === '') {
    throw new Error('Partner name cannot be empty.');
  }
  const connection = await db.getConnection();
  try {
    const trimmedPartnerName = partnerName.trim();
    console.log(`[PartnerAction] Attempting to find partner: "${trimmedPartnerName}"`);
    // Check if partner exists
    const [existingPartners] = await connection.query<RowDataPacket[]>(
      'SELECT id, name FROM partners WHERE name = ?',
      [trimmedPartnerName]
    );

    if (existingPartners.length > 0) {
      const existingPartner = existingPartners[0];
      console.log(`[PartnerAction] Found existing partner: ID ${existingPartner.id}, Name ${existingPartner.name}`);
      return { id: String(existingPartner.id), name: existingPartner.name };
    }

    // Partner does not exist, create new
    console.log(`[PartnerAction] Partner "${trimmedPartnerName}" not found, creating new.`);
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO partners (name) VALUES (?)',
      [trimmedPartnerName]
    );
    
    if (result.insertId && result.insertId > 0) {
      console.log(`[PartnerAction] Successfully created partner: ID ${result.insertId}, Name ${trimmedPartnerName}`);
      return { id: String(result.insertId), name: trimmedPartnerName };
    } else {
      console.error('[PartnerAction] Failed to create partner: insertId is 0 or not returned. This often means the `id` column is not AUTO_INCREMENT.', result);
      throw new Error('Failed to create partner: No valid insertId returned. Check if `id` column is AUTO_INCREMENT.');
    }
  } catch (error: any) {
    console.error('[PartnerAction] Original DB error in findOrCreatePartnerByName:', error);
     if (error.message.includes('No valid insertId returned')) {
        throw error;
    }
    console.error(`[PartnerAction] Failed to find or create partner "${partnerName}". Details: ${error.message}`);
    throw new Error(`Failed to find or create partner "${partnerName}".`);
  } finally {
    connection.release();
  }
}

/**
 * Fetches all partners from the database.
 */
export async function getAllPartnersFromDB(): Promise<Partner[]> {
  const connection = await db.getConnection();
  try {
    console.log('[PartnerAction] Fetching all partners from DB.');
    const [rows] = await connection.query<RowDataPacket[]>('SELECT id, name FROM partners ORDER BY name ASC');
    console.log(`[PartnerAction] Found ${rows.length} partners.`);
    return rows.map(row => ({ id: String(row.id), name: row.name }));
  } catch (error: any) {
    console.error('[PartnerAction] Original DB error in getAllPartnersFromDB:', error);
    console.error(`[PartnerAction] Failed to fetch partners. Details: ${error.message}`);
    throw new Error('Failed to fetch partners from database.');
  } finally {
    connection.release();
  }
}
