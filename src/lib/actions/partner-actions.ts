
'use server';

import db from '@/lib/db';
import type { Partner } from '@/store/os-store'; // Using Partner type from store
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';

/**
 * Finds a partner by name or creates a new one if not found.
 * This version is simplified for OS assignment and might not include all partner login fields.
 * Returns the partner object (either existing or newly created).
 * Accepts an optional existing connection to participate in a transaction.
 */
export async function findOrCreatePartnerByName(partnerName: string, existingConnection?: PoolConnection): Promise<Partner> {
  if (!partnerName || partnerName.trim() === '') {
    throw new Error('Partner name cannot be empty.');
  }
  const connection = existingConnection || await db.getConnection();
  try {
    const trimmedPartnerName = partnerName.trim();
    console.log(`[PartnerAction findOrCreate] Attempting to find partner: "${trimmedPartnerName}"`);
    const [existingPartners] = await connection.query<RowDataPacket[]>(
      'SELECT id, name, username, email, contact_person, is_approved FROM partners WHERE name = ?', // Fetch more fields
      [trimmedPartnerName]
    );

    if (existingPartners.length > 0) {
      const p = existingPartners[0];
      console.log(`[PartnerAction findOrCreate] Found existing partner: ID ${p.id}, Name ${p.name}`);
      return { 
        id: String(p.id), 
        name: p.name,
        username: p.username,
        email: p.email,
        contact_person: p.contact_person,
        is_approved: Boolean(p.is_approved)
      };
    }

    console.log(`[PartnerAction findOrCreate] Partner "${trimmedPartnerName}" not found, creating new (basic entry).`);
    // For OS assignment, we might just create a basic partner entry.
    // A full partner creation (with login) would be a separate admin action.
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO partners (name, is_approved) VALUES (?, ?)', // Default is_approved to false if created this way
      [trimmedPartnerName, false]
    );

    if (result.insertId && result.insertId > 0) {
      console.log(`[PartnerAction findOrCreate] Successfully created basic partner: ID ${result.insertId}, Name ${trimmedPartnerName}`);
      return { id: String(result.insertId), name: trimmedPartnerName, is_approved: false };
    } else {
      console.error('[PartnerAction findOrCreate] Failed to create partner: insertId is 0 or not returned.');
      throw new Error('Failed to create partner: No valid insertId returned.');
    }
  } catch (error: any) {
    console.error('[PartnerAction findOrCreate] Original DB error:', error);
    throw new Error(`Failed to find or create partner "${partnerName}".`);
  } finally {
    if (!existingConnection && connection) {
      connection.release();
    }
  }
}

/**
 * Fetches all partners from the database with their extended details.
 */
export async function getAllPartnersFromDB(): Promise<Partner[]> {
  const connection = await db.getConnection();
  try {
    console.log('[PartnerAction getAllPartnersFromDB] Fetching all partners from DB.');
    const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT id, name, username, email, contact_person, is_approved, created_at, updated_at FROM partners ORDER BY name ASC'
    );
    console.log(`[PartnerAction getAllPartnersFromDB] Found ${rows.length} partners.`);
    return rows.map(row => ({ 
        id: String(row.id), 
        name: row.name,
        username: row.username,
        email: row.email,
        contact_person: row.contact_person,
        is_approved: Boolean(row.is_approved),
        // created_at: row.created_at, // Optional: include if needed by admin UI
        // updated_at: row.updated_at, // Optional: include if needed by admin UI
    }));
  } catch (error: any) {
    console.error('[PartnerAction getAllPartnersFromDB] Original DB error:', error);
    throw new Error('Failed to fetch partners from database.');
  } finally {
    if (connection) connection.release();
  }
}

// Future: Add actions like createPartnerWithCredentials, updatePartnerCredentials, approvePartner, etc.
// These would be called from an admin interface for managing partners.
