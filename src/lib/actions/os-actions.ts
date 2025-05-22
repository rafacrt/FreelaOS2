
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData, OSStatus } from '@/lib/types';
// OSStatus enum already imported via types
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';

const generateNewOSNumero = async (connection: PoolConnection): Promise<string> => {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT MAX(CAST(numero AS UNSIGNED)) as maxNumero FROM os_table");
  const maxNumero = rows[0]?.maxNumero || 0;
  const newNumeroInt = Number(maxNumero) + 1;
  return String(newNumeroInt).padStart(6, '0');
};

export async function createOSInDB(data: CreateOSData): Promise<OS> {
  const connection = await db.getConnection();
  console.log('[OSAction createOSInDB] Starting with data:', JSON.stringify(data, null, 2));
  try {
    await connection.beginTransaction();
    console.log('[OSAction createOSInDB] Transaction started.');

    const client = await findOrCreateClientByName(data.cliente, connection);
    if (!client || !client.id) {
      console.error('[OSAction createOSInDB] Failed to get client ID for:', data.cliente, 'Client object received:', client);
      await connection.rollback();
      throw new Error('Failed to get client ID.');
    }
    console.log(`[OSAction createOSInDB] Client resolved: ID ${client.id}, Name ${client.name}`);

    let partnerId: string | null = null;
    let partnerName: string | undefined = undefined;
    if (data.parceiro && data.parceiro.trim() !== '') {
      const partner = await findOrCreatePartnerByName(data.parceiro, connection);
      if (!partner || !partner.id) {
        console.error('[OSAction createOSInDB] Failed to get partner ID for:', data.parceiro, 'Partner object received:', partner);
        await connection.rollback();
        throw new Error('Failed to get partner ID.');
      }
      partnerId = partner.id;
      partnerName = partner.name;
      console.log(`[OSAction createOSInDB] Partner resolved: ID ${partner.id}, Name ${partner.name}`);
    } else {
      console.log('[OSAction createOSInDB] No partner provided or partner name is empty.');
    }

    const newOsNumero = await generateNewOSNumero(connection);
    console.log(`[OSAction createOSInDB] New OS numero generated: ${newOsNumero}`);

    let programadoParaDate: string | null = null;
    if (data.programadoPara && data.programadoPara.trim() !== '') {
      const parsedDate = new Date(data.programadoPara);
      if (!isNaN(parsedDate.getTime())) {
        programadoParaDate = parsedDate.toISOString().split('T')[0];
      } else {
        console.warn(`[OSAction createOSInDB] Invalid programadoPara date string: "${data.programadoPara}". Setting to null.`);
      }
    }

    const osDataForDB = {
      numero: newOsNumero,
      cliente_id: parseInt(client.id, 10),
      parceiro_id: partnerId ? parseInt(partnerId, 10) : null,
      projeto: data.projeto,
      tarefa: data.tarefa,
      observacoes: data.observacoes || '',
      tempoTrabalhado: data.tempoTrabalhado || null,
      status: data.status, // OSStatus enum
      dataAbertura: new Date(),
      programadoPara: programadoParaDate,
      isUrgent: data.isUrgent || false,
      dataFinalizacao: null,
      dataInicioProducao: null,
      tempoProducaoMinutos: null,
    };
    console.log('[OSAction createOSInDB] OS data for DB:', JSON.stringify(osDataForDB, null, 2));

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO os_table (numero, cliente_id, parceiro_id, projeto, tarefa, observacoes, tempoTrabalhado, status, dataAbertura, programadoPara, isUrgent, dataFinalizacao, dataInicioProducao, tempoProducaoMinutos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      Object.values(osDataForDB)
    );

    if (!result.insertId) {
      console.error('[OSAction createOSInDB] Failed to create OS: insertId is 0. Check AUTO_INCREMENT on os_table.id.', result);
      await connection.rollback();
      throw new Error('Failed to create OS: No valid insertId returned from DB.');
    }
    console.log(`[OSAction createOSInDB] OS inserted with ID: ${result.insertId}`);
    await connection.commit();
    console.log('[OSAction createOSInDB] Transaction committed.');

    const createdOS: OS = {
      id: String(result.insertId),
      numero: newOsNumero,
      cliente: client.name,
      parceiro: partnerName,
      clientId: client.id,
      partnerId: partnerId ?? undefined,
      projeto: data.projeto,
      tarefa: data.tarefa,
      observacoes: data.observacoes || '',
      tempoTrabalhado: data.tempoTrabalhado || '',
      status: data.status,
      dataAbertura: osDataForDB.dataAbertura.toISOString(),
      programadoPara: programadoParaDate ? programadoParaDate : undefined,
      isUrgent: data.isUrgent || false,
    };
    console.log('[OSAction createOSInDB] OS object returned:', JSON.stringify(createdOS, null, 2));
    return createdOS;

  } catch (error: any) {
    console.error('[OSAction createOSInDB] Error. Rolling back.', error);
    if (connection) await connection.rollback(); // Ensure rollback on error
    throw new Error(`Failed to create OS: ${error.message}`);
  } finally {
    if (connection) connection.release();
    console.log('[OSAction createOSInDB] Connection released.');
  }
}

export async function getAllOSFromDB(): Promise<OS[]> {
  const connection = await db.getConnection();
  try {
    console.log('[OSAction getAllOSFromDB] Fetching all OS from DB.');
    const [rows] = await connection.query<RowDataPacket[]>(`
      SELECT
        os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.tempoTrabalhado, os.status,
        os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
        os.dataInicioProducao, os.tempoProducaoMinutos,
        c.id as clientId, c.name as cliente_name,
        p.id as partnerId, p.name as partner_name
      FROM os_table os
      JOIN clients c ON os.cliente_id = c.id
      LEFT JOIN partners p ON os.parceiro_id = p.id
      ORDER BY os.isUrgent DESC, os.dataAbertura DESC
    `);
    console.log(`[OSAction getAllOSFromDB] Found ${rows.length} OS records.`);
    return rows.map(row => ({
      id: String(row.id),
      numero: row.numero,
      cliente: row.cliente_name,
      parceiro: row.partner_name || undefined,
      clientId: String(row.clientId),
      partnerId: row.partnerId ? String(row.partnerId) : undefined,
      projeto: row.projeto,
      tarefa: row.tarefa,
      observacoes: row.observacoes,
      tempoTrabalhado: row.tempoTrabalhado,
      status: row.status as OSStatus,
      dataAbertura: new Date(row.dataAbertura).toISOString(),
      dataFinalizacao: row.dataFinalizacao ? new Date(row.dataFinalizacao).toISOString() : undefined,
      programadoPara: row.programadoPara ? new Date(row.programadoPara).toISOString().split('T')[0] : undefined,
      isUrgent: Boolean(row.isUrgent),
      dataInicioProducao: row.dataInicioProducao ? new Date(row.dataInicioProducao).toISOString() : undefined,
      tempoProducaoMinutos: row.tempoProducaoMinutos,
    }));
  } catch (error: any) {
    console.error('[OSAction getAllOSFromDB] Original DB error:', error);
    throw new Error(`Failed to fetch OS list from database: ${error.message}`);
  } finally {
    if (connection) connection.release();
  }
}

export async function updateOSStatusInDB(
  osId: string,
  newStatus: OSStatus,
  updateData: {
    dataFinalizacao?: string | null;
    dataInicioProducao?: string | null;
    tempoProducaoMinutos?: number | null;
  }
): Promise<boolean> {
  const connection = await db.getConnection();
  try {
    console.log(`[OSAction updateOSStatusInDB] Updating OS ID ${osId} to status ${newStatus} with data:`, updateData);
    await connection.beginTransaction();

    const fieldsToUpdate: string[] = ['status = ?'];
    const values: (string | number | null | boolean)[] = [newStatus];

    if (updateData.dataFinalizacao !== undefined) {
      fieldsToUpdate.push('dataFinalizacao = ?');
      values.push(updateData.dataFinalizacao);
    }
    if (updateData.dataInicioProducao !== undefined) {
      fieldsToUpdate.push('dataInicioProducao = ?');
      values.push(updateData.dataInicioProducao);
    }
    if (updateData.tempoProducaoMinutos !== undefined) {
      fieldsToUpdate.push('tempoProducaoMinutos = ?');
      values.push(updateData.tempoProducaoMinutos);
    }
    
    // Add isUrgent update if needed in the future, or other fields
    // For example, if toggling urgency also updates the DB directly:
    // if (updateData.isUrgent !== undefined) {
    //   fieldsToUpdate.push('isUrgent = ?');
    //   values.push(updateData.isUrgent);
    // }

    values.push(osId); // For the WHERE clause

    const sql = `UPDATE os_table SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    console.log(`[OSAction updateOSStatusInDB] SQL: ${sql} Values:`, values);

    const [result] = await connection.execute<ResultSetHeader>(sql, values);
    
    await connection.commit();
    console.log(`[OSAction updateOSStatusInDB] OS ID ${osId} status updated. Affected rows: ${result.affectedRows}`);
    return result.affectedRows > 0;
  } catch (error: any) {
    console.error(`[OSAction updateOSStatusInDB] Error updating OS status for ID ${osId}:`, error);
    if (connection) await connection.rollback();
    throw new Error(`Failed to update OS status in DB: ${error.message}`);
  } finally {
    if (connection) connection.release();
  }
}
