
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
  password?: string; // Senha em texto plano, obrigatória na criação
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
  // Senha não é atualizada por esta action, para manter a simplicidade
}


const mapPartnerRowToPartner = (row: RowDataPacket): Partner => ({
    id: String(row.id),
    name: row.name,
    username: row.username,
    email: row.email,
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

    // Verificar se username ou email já existem
    const [existingByUsername] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM partners WHERE username = ?',
      [username]
    );
    if (existingByUsername.length > 0) {
      throw new Error('Este nome de usuário já está em uso.');
    }
    if (email) {
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
    console.log(`[PartnerAction createPartner] Parceiro "${name}" (User: ${username}) criado com ID: ${result.insertId}`);
    return {
      id: String(result.insertId),
      name,
      username,
      email,
      contact_person,
      is_approved,
    };
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('[PartnerAction createPartner] Erro:', error);
    throw error; // Re-throw para ser capturado pelo modal
  } finally {
    if (connection) connection.release();
  }
}

export async function updatePartnerDetails(data: UpdatePartnerDetailsData): Promise<Partner> {
  const { id, name, username, email, contact_person, is_approved } = data;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar se o novo username ou email conflita com OUTRO parceiro
    const [existingByUsername] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM partners WHERE username = ? AND id != ?',
      [username, id]
    );
    if (existingByUsername.length > 0) {
      throw new Error('Este nome de usuário já está em uso por outro parceiro.');
    }
    if (email) {
      const [existingByEmail] = await connection.query<RowDataPacket[]>(
        'SELECT id FROM partners WHERE email = ? AND id != ?',
        [email, id]
      );
      if (existingByEmail.length > 0) {
        throw new Error('Este email já está em uso por outro parceiro.');
      }
    }

    const [result] = await connection.execute<ResultSetHeader>(
      'UPDATE partners SET name = ?, username = ?, email = ?, contact_person = ?, is_approved = ?, updated_at = NOW() WHERE id = ?',
      [name, username, email || null, contact_person || null, is_approved, id]
    );

    if (result.affectedRows === 0) {
      throw new Error('Parceiro não encontrado ou nenhum dado alterado.');
    }
    await connection.commit();
    console.log(`[PartnerAction updatePartnerDetails] Detalhes do Parceiro ID ${id} atualizados.`);
     return {
      id: String(id),
      name,
      username,
      email,
      contact_person,
      is_approved,
    };
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('[PartnerAction updatePartnerDetails] Erro:', error);
    throw error; // Re-throw para ser capturado pelo modal
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

    const [result] = await connection.execute<ResultSetHeader>(
      'INSERT INTO partners (name, is_approved, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      [trimmedPartnerName, false] // Default to not approved if created this way
    );

    if (result.insertId) {
      return { 
          id: String(result.insertId), 
          name: trimmedPartnerName, 
          is_approved: false 
        };
    } else {
      throw new Error('Failed to create partner: No valid insertId returned.');
    }
  } catch (error: any) {
    console.error('[PartnerAction findOrCreateByName] Original DB error:', error);
    throw new Error(`Failed to find or create partner "${partnerName}".`);
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
    console.error('[PartnerAction getAllPartnersFromDB] Original DB error:', error);
    throw new Error('Failed to fetch partners from database.');
  } finally {
    if (connection) connection.release();
  }
}

// TODO: Implementar deletePartnerByIdInDB se necessário

      