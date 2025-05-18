
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData } from '@/lib/types';
import { OSStatus } from '@/lib/types';
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';

const generateNewOSNumero = async (connection: PoolConnection): Promise<string> => {
  // In a real scenario, this might involve a transaction or a dedicated sequence table
  // For now, simple MAX + 1. Ensure 'numero' is treated as a string for potential leading zeros.
  const [rows] = await connection.query<RowDataPacket[]>("SELECT MAX(CAST(numero AS UNSIGNED)) as maxNumero FROM os_table");
  const maxNumero = rows[0]?.maxNumero || 0;
  const newNumeroInt = Number(maxNumero) + 1;
  return String(newNumeroInt).padStart(6, '0'); // Ensure 6 digits with leading zeros
};

export async function createOSInDB(data: CreateOSData): Promise<OS> {
  const connection = await db.getConnection();
  console.log('[OSAction] Starting createOSInDB with data:', data);
  try {
    await connection.beginTransaction();
    console.log('[OSAction] Transaction started.');

    // 1. Find or Create Client
    console.log(`[OSAction] Finding or creating client: "${data.cliente}"`);
    const client = await findOrCreateClientByName(data.cliente);
    if (!client || !client.id) {
        console.error('[OSAction] Failed to get client ID for:', data.cliente);
        await connection.rollback(); // Rollback if client creation fails
        throw new Error('Failed to get client ID.');
    }
    console.log(`[OSAction] Client resolved: ID ${client.id}, Name ${client.name}`);

    // 2. Find or Create Partner (if provided)
    let partnerId: string | null = null;
    let partnerName: string | undefined = undefined;
    if (data.parceiro && data.parceiro.trim() !== '') {
      console.log(`[OSAction] Finding or creating partner: "${data.parceiro}"`);
      const partner = await findOrCreatePartnerByName(data.parceiro);
      if (!partner || !partner.id) {
          console.error('[OSAction] Failed to get partner ID for:', data.parceiro);
          await connection.rollback(); // Rollback if partner creation fails
          throw new Error('Failed to get partner ID.');
      }
      partnerId = partner.id;
      partnerName = partner.name;
      console.log(`[OSAction] Partner resolved: ID ${partner.id}, Name ${partner.name}`);
    } else {
      console.log('[OSAction] No partner provided or partner name is empty.');
    }

    // 3. Generate new OS Numero
    console.log('[OSAction] Generating new OS numero.');
    const newOsNumero = await generateNewOSNumero(connection);
    console.log(`[OSAction] New OS numero generated: ${newOsNumero}`);

    // 4. Create OS
    let programadoParaDate: Date | null = null;
    if (data.programadoPara && data.programadoPara.trim() !== '') {
        const parsedDate = new Date(data.programadoPara);
        // Check if the date is valid. The input type="date" should give YYYY-MM-DD.
        // Appending T00:00:00Z to ensure it's treated as UTC midnight for storage if only date is given.
        if (!isNaN(parsedDate.getTime())) {
            // To store just the date part, we can format it back to YYYY-MM-DD string for MySQL DATE type
            // Or if the column is DATETIME, ensure it's a full valid datetime.
            // For a DATE column, passing a Date object directly is usually fine, MySQL driver handles it.
             programadoParaDate = parsedDate;
        } else {
            console.warn(`[OSAction] Invalid programadoPara date string received: "${data.programadoPara}". Setting to null.`);
        }
    }


    const osDataForDB = {
      numero: newOsNumero,
      cliente_id: parseInt(client.id, 10),
      parceiro_id: partnerId ? parseInt(partnerId, 10) : null,
      projeto: data.projeto,
      tarefa: data.tarefa,
      observacoes: data.observacoes || '', // Ensure empty string becomes empty string, not null, if column is NOT NULL
      tempoTrabalhado: data.tempoTrabalhado || null, // Allow null if field is empty
      status: data.status || OSStatus.NA_FILA,
      dataAbertura: new Date(), 
      programadoPara: programadoParaDate, // Use the Date object or null
      isUrgent: data.isUrgent || false,
      dataFinalizacao: null,
      dataInicioProducao: null,
      tempoProducaoMinutos: null,
    };
    
    console.log('[OSAction] OS data prepared for DB insertion:', osDataForDB);

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO os_table (numero, cliente_id, parceiro_id, projeto, tarefa, observacoes, tempoTrabalhado, status, dataAbertura, programadoPara, isUrgent, dataFinalizacao, dataInicioProducao, tempoProducaoMinutos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        osDataForDB.numero,
        osDataForDB.cliente_id,
        osDataForDB.parceiro_id,
        osDataForDB.projeto,
        osDataForDB.tarefa,
        osDataForDB.observacoes,
        osDataForDB.tempoTrabalhado,
        osDataForDB.status,
        osDataForDB.dataAbertura,
        osDataForDB.programadoPara,
        osDataForDB.isUrgent,
        osDataForDB.dataFinalizacao,
        osDataForDB.dataInicioProducao,
        osDataForDB.tempoProducaoMinutos,
      ]
    );

    if (!result.insertId || result.insertId === 0) {
      console.error('[OSAction] Failed to create OS: insertId is 0 or not returned. This often means the `id` column in os_table is not AUTO_INCREMENT.', result);
      await connection.rollback();
      throw new Error('Failed to create OS: No valid insertId returned from DB. Check AUTO_INCREMENT on os_table.id.');
    }
    console.log(`[OSAction] OS successfully inserted with ID: ${result.insertId}`);

    await connection.commit();
    console.log('[OSAction] Transaction committed.');

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
      status: data.status || OSStatus.NA_FILA,
      dataAbertura: osDataForDB.dataAbertura.toISOString(),
      programadoPara: programadoParaDate ? programadoParaDate.toISOString().split('T')[0] : undefined,
      isUrgent: data.isUrgent || false,
    };
    console.log('[OSAction] OS object constructed to return to client:', createdOS);
    return createdOS;

  } catch (error: any) {
    await connection.rollback(); // Ensure rollback on any error within the try block
    console.error('[OSAction] Original DB error in createOSInDB:', error);
    if (error.message.includes('No valid insertId returned')) {
        throw error;
    }
    console.error(`[OSAction] Failed to create OS. Details: ${error.message}`);
    throw new Error(`Failed to create OS: ${error.message}`);
  } finally {
    connection.release();
    console.log('[OSAction] Connection released.');
  }
}

export async function getAllOSFromDB(): Promise<OS[]> {
  const connection = await db.getConnection();
  try {
    console.log('[OSAction] Fetching all OS from DB.');
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
    console.log(`[OSAction] Found ${rows.length} OS records.`);
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
    console.error('[OSAction] Original DB error in getAllOSFromDB:', error);
    console.error(`[OSAction] Failed to fetch OS list. Details: ${error.message}`);
    throw new Error('Failed to fetch OS list from database.');
  } finally {
    connection.release();
    console.log('[OSAction] Connection released after fetching all OS.');
  }
}
