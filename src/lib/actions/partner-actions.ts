
'use server';

import db from '@/lib/db';
import type { Partner } from '@/store/os-store';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import bcrypt from 'bcrypt';

// Tipos para dados de criação e atualização de parceiros
export interface CreatePartnerData {
  name: string;
  username: string;
  email?: string;
  password: string; // Senha em texto plano, obrigatória na criação
  contact_person?: string;
  is_approved: boolean;
}

export interface UpdatePartnerDetailsData {
  id: string;
  name: string;
  username: string;
  email?: string;
  contact_person?: string;
  is_approved: boolean;
  password?: string; // Senha opcional para atualização
}


const mapPartnerRowToPartner = (row: RowDataPacket): Partner => ({
    id: String(row.id),
    name: row.name,
    username: row.username,
    email: row.email, // Added email
    contact_person: row.contact_person,
    is_approved: Boolean(row.is_approved),
    // password_hash não é retornado ao cliente
});


export async function createPartner(data: CreatePartnerData): Promise<Partner> {
  const { name, username, email, password, contact_person, is_approved } = data;
  if (!password) { 
    throw new Error('Senha é obrigatória para criar um novo parceiro.');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existingByUsername] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM partners WHERE username = ?',
      [username]
    );
    if (existingByUsername.length > 0) {
      throw new Error('Este nome de usuário já está em uso.');
    }
    if (email && email.trim() !== '') {
      const [existingByEmail] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM partners WHERE email = ?',
        [email]
      );
      if (existingByEmail.length > 0) {
        throw new Error('Este email já está em uso.');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO partners (name, username, email, password_hash, contact_person, is_approved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [name, username, email || null, hashedPassword, contact_person || null, is_approved]
    );

    if (!result.insertId) {
      throw new Error('Falha ao criar parceiro no banco de dados.');
    }
    await connection.commit();
    return {
      id: String(result.insertId),
      name,
      username,
      email: email || undefined,
      contact_person,
      is_approved,
    };
  } catch (error: any) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

export async function updatePartnerDetails(data: UpdatePartnerDetailsData): Promise<Partner> {
  const { id, name, username, email, contact_person, is_approved, password } = data;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existingByUsername] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM partners WHERE username = ? AND id != ?',
      [username, id]
    );
    if (existingByUsername.length > 0) {
      throw new Error('Este nome de usuário já está em uso por outro parceiro.');
    }
    if (email && email.trim() !== '') {
      const [existingByEmail] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM partners WHERE email = ? AND id != ?',
        [email, id]
      );
      if (existingByEmail.length > 0) {
        throw new Error('Este email já está em uso por outro parceiro.');
      }
    }

    let query = 'UPDATE partners SET name = ?, username = ?, email = ?, contact_person = ?, is_approved = ?, updated_at = NOW()';
    const queryParams: (string | boolean | number | null)[] = [name, username, email || null, contact_person || null, is_approved];

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      queryParams.push(hashedPassword);
    }
    query += ' WHERE id = ?';
    queryParams.push(id);

    const [result] = await connection.execute<ResultSetHeader>(query, queryParams);

    if (result.affectedRows === 0) {
      throw new Error('Parceiro não encontrado ou nenhum dado alterado.');
    }
    await connection.commit();
     return { 
      id: String(id),
      name,
      username,
      email: email || undefined,
      contact_person,
      is_approved,
    };
  } catch (error: any) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}


export async function findOrCreatePartnerByName(partnerName: string, existingConnection?: PoolConnection): Promise<Partner> {
  if (!partnerName || partnerName.trim() === '') {
    throw new Error('Partner name cannot be empty.');
  }
  const connection = existingConnection || await db.getConnection();
  try {
    const trimmedPartnerName = partnerName.trim();
    const [existingPartners] = await connection.query<RowDataPacket[]>(
      'SELECT id, name, username, email, contact_person, is_approved FROM partners WHERE name = ?',
      [trimmedPartnerName]
    );

    if (existingPartners.length > 0) {
      const p = existingPartners[0];
      return mapPartnerRowToPartner(p);
    }

    const defaultUsername = `parceiro_${Date.now()}`; 
    const defaultEmail = `${defaultUsername}@placeholder.invalid`; // Placeholder email
    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO partners (name, username, email, is_approved, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [trimmedPartnerName, defaultUsername, defaultEmail, false] 
    );

    if (result.insertId) {
      return { 
          id: String(result.insertId), 
          name: trimmedPartnerName, 
          username: defaultUsername,
          email: defaultEmail,
          is_approved: false 
        };
    } else {
      throw new Error('Failed to create partner: No valid insertId returned.');
    }
  } catch (error: any) {
    throw new Error(`Failed to find or create partner "${partnerName}". Error: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (!existingConnection && connection) {
      connection.release();
    }
  }
}


export async function getAllPartnersFromDB(): Promise<Partner[]> {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
        'SELECT id, name, username, email, contact_person, is_approved, created_at, updated_at FROM partners ORDER BY name ASC'
    );
    return rows.map(mapPartnerRowToPartner);
  } catch (error: any) {
    throw new Error('Failed to fetch partners from database.');
  } finally {
    if (connection) connection.release();
  }
}

export async function deletePartnerById(partnerId: string): Promise<boolean> {
  if (!partnerId) {
    throw new Error('Partner ID é obrigatório para exclusão.');
  }
  const connection = await db.getConnection();
  try {
    
    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM partners WHERE id = ?',
      [partnerId]
    );

    if (result.affectedRows > 0) {
      return true;
    } else {
      return false; 
    }
  } catch (error: any) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || (error.message && error.message.includes('foreign key constraint fails'))) {
      throw new Error('Não é possível excluir este parceiro pois ele ainda está vinculado a outros registros importantes, apesar das tentativas de desassociação automática.');
    }
    throw new Error(`Falha ao excluir parceiro: ${error.message}`);
  } finally {
    if (connection) connection.release();
  }
}
      
const SIMULATED_PARTNER_USERNAME = 'sim_partner_user';
const SIMULATED_PARTNER_NAME = 'Parceiro Simulado Inc.';
const SIMULATED_PARTNER_EMAIL = 'sim.partner@example.com'; 
const SIMULATED_PARTNER_DUMMY_PASSWORD = 'sim_password_auto_123';

export async function ensureSimulatedPartnerExists(): Promise<Partner> {
  const connection = await db.getConnection();
  try {
    const [existingPartners] = await connection.query<RowDataPacket[]>(
      'SELECT id, name, username, email, contact_person, is_approved FROM partners WHERE username = ?',
      [SIMULATED_PARTNER_USERNAME]
    );

    if (existingPartners.length > 0) {
      const p = existingPartners[0];
      return mapPartnerRowToPartner(p);
    }

    const hashedPassword = await bcrypt.hash(SIMULATED_PARTNER_DUMMY_PASSWORD, 10);

    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO partners (name, username, email, password_hash, is_approved, contact_person, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [
        SIMULATED_PARTNER_NAME,
        SIMULATED_PARTNER_USERNAME,
        SIMULATED_PARTNER_EMAIL,
        hashedPassword,
        true, 
        'Contato Simulado' 
      ]
    );

    if (result.insertId) {
      return {
        id: String(result.insertId),
        name: SIMULATED_PARTNER_NAME,
        username: SIMULATED_PARTNER_USERNAME,
        email: SIMULATED_PARTNER_EMAIL,
        contact_person: 'Contato Simulado',
        is_approved: true,
      };
    } else {
      throw new Error('Failed to create simulated partner: No valid insertId returned.');
    }
  } catch (error: any) {
    throw new Error(`Failed to ensure simulated partner exists: ${error.message}`);
  } finally {
    if (connection) connection.release();
  }
}
