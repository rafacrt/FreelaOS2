
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData } from '@/lib/types';
import { OSStatus, isValidDate } from '@/lib/types'; // Import OSStatus
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import { parseISO, differenceInMinutes, format as formatDateFns, differenceInSeconds, isValid } from 'date-fns';

const generateNewOSNumero = async (connection: PoolConnection): Promise<string> => {
  console.log('[OSAction generateNewOSNumero] Gerando novo número de OS...');
  const [rows] = await connection.query<RowDataPacket[]>("SELECT MAX(CAST(numero AS UNSIGNED)) as maxNumero FROM os_table");
  const maxNumero = rows[0]?.maxNumero || 0;
  const newNumeroInt = Number(maxNumero) + 1;
  const newNumeroStr = String(newNumeroInt).padStart(6, '0');
  console.log(`[OSAction generateNewOSNumero] Novo número gerado: ${newNumeroStr}`);
  return newNumeroStr;
};

export async function createOSInDB(data: CreateOSData): Promise<OS> {
  const connection = await db.getConnection();
  console.log('[OSAction createOSInDB] Iniciando com dados:', JSON.stringify(data, null, 2));
  try {
    await connection.beginTransaction();
    console.log('[OSAction createOSInDB] Transação iniciada.');

    const client = await findOrCreateClientByName(data.cliente, connection);
    if (!client || !client.id) {
      console.error('[OSAction createOSInDB] Falha ao obter ID do cliente para:', data.cliente, 'Objeto cliente recebido:', client);
      await connection.rollback();
      throw new Error('Falha ao obter ID do cliente.');
    }
    console.log(`[OSAction createOSInDB] Cliente resolvido: ID ${client.id}, Nome ${client.name}`);

    let partnerId: string | null = null;
    let partnerName: string | undefined = undefined;
    if (data.parceiro && data.parceiro.trim() !== '') {
      const partner = await findOrCreatePartnerByName(data.parceiro, connection);
      if (!partner || !partner.id) {
        console.error('[OSAction createOSInDB] Falha ao obter ID do parceiro para:', data.parceiro, 'Objeto parceiro recebido:', partner);
        await connection.rollback();
        throw new Error('Falha ao obter ID do parceiro.');
      }
      partnerId = partner.id;
      partnerName = partner.name;
      console.log(`[OSAction createOSInDB] Parceiro resolvido: ID ${partner.id}, Nome ${partner.name}`);
    } else {
      console.log('[OSAction createOSInDB] Nenhum parceiro fornecido ou nome do parceiro está vazio.');
    }

    const newOsNumero = await generateNewOSNumero(connection);

    let programadoParaDate: string | null = null;
    if (data.programadoPara && data.programadoPara.trim() !== '') {
      try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(data.programadoPara)) {
            const parsedDate = parseISO(data.programadoPara + "T00:00:00.000Z"); 
            if (isValidDate(parsedDate)) {
                programadoParaDate = data.programadoPara; 
            }
        }
      } catch (e) {
        console.warn(`[OSAction createOSInDB] Erro ao parsear programadoPara: "${data.programadoPara}". Definindo como null. Erro:`, e);
      }
    }

    const now = new Date();
    const osDataForDB = {
      numero: newOsNumero,
      cliente_id: parseInt(client.id, 10),
      parceiro_id: partnerId ? parseInt(partnerId, 10) : null,
      projeto: data.projeto,
      tarefa: data.tarefa,
      observacoes: data.observacoes || '',
      tempoTrabalhado: data.tempoTrabalhado || null,
      status: data.status,
      dataAbertura: now,
      programadoPara: programadoParaDate,
      isUrgent: data.isUrgent || false,
      dataFinalizacao: null,
      dataInicioProducao: data.status === OSStatus.EM_PRODUCAO ? now : null, // First time production starts
      tempoProducaoMinutos: null, // Deprecated, will be calculated from seconds
      tempoGastoProducaoSegundos: 0, 
      dataInicioProducaoAtual: data.status === OSStatus.EM_PRODUCAO ? now : null, 
      created_at: now,
      updated_at: now,
    };
    console.log('[OSAction createOSInDB] Dados da OS para o DB:', JSON.stringify(osDataForDB, null, 2));

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO os_table (numero, cliente_id, parceiro_id, projeto, tarefa, observacoes, tempoTrabalhado, status, dataAbertura, programadoPara, isUrgent, dataFinalizacao, dataInicioProducao, tempoProducaoMinutos, tempoGastoProducaoSegundos, dataInicioProducaoAtual, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        osDataForDB.numero, osDataForDB.cliente_id, osDataForDB.parceiro_id, osDataForDB.projeto,
        osDataForDB.tarefa, osDataForDB.observacoes, osDataForDB.tempoTrabalhado, osDataForDB.status,
        osDataForDB.dataAbertura, osDataForDB.programadoPara, osDataForDB.isUrgent, osDataForDB.dataFinalizacao,
        osDataForDB.dataInicioProducao, osDataForDB.tempoProducaoMinutos, osDataForDB.tempoGastoProducaoSegundos,
        osDataForDB.dataInicioProducaoAtual, osDataForDB.created_at, osDataForDB.updated_at
      ]
    );

    if (!result.insertId) {
      console.error('[OSAction createOSInDB] Falha ao criar OS: insertId é 0.', result);
      await connection.rollback();
      throw new Error('Falha ao criar OS: Nenhum insertId válido retornado do DB.');
    }
    await connection.commit();

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
      dataFinalizacao: undefined,
      dataInicioProducao: osDataForDB.dataInicioProducao ? osDataForDB.dataInicioProducao.toISOString() : undefined,
      tempoProducaoMinutos: undefined, // Will be calculated
      tempoGastoProducaoSegundos: osDataForDB.tempoGastoProducaoSegundos,
      dataInicioProducaoAtual: osDataForDB.dataInicioProducaoAtual ? osDataForDB.dataInicioProducaoAtual.toISOString() : null,
    };
    return createdOS;

  } catch (error: any) {
    console.error('[OSAction createOSInDB] Erro durante a criação da OS. Rollback será tentado.', error.message, error.stack, error.code, error.sqlMessage);
    if (connection) await connection.rollback();
    throw new Error(`Falha ao criar OS no banco de dados: ${error.message || 'Erro desconhecido'}`);
  } finally {
    if (connection) connection.release();
  }
}


export async function updateOSInDB(osData: OS): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log(`[OSAction updateOSInDB] Iniciando atualização para OS ID: ${osData.id}. Dados recebidos:`, JSON.stringify(osData, null, 2));
  try {
    await connection.beginTransaction();
    console.log(`[OSAction updateOSInDB] Transação iniciada para OS ID: ${osData.id}`);

    const client = await findOrCreateClientByName(osData.cliente, connection);
    if (!client || !client.id) { throw new Error('Falha ao obter ID do cliente para atualização.'); }
    let partnerIdSQL: number | null = null;
    let partnerNameForReturn: string | undefined = undefined;
    if (osData.parceiro && osData.parceiro.trim() !== '') {
      const partner = await findOrCreatePartnerByName(osData.parceiro, connection);
      if (!partner || !partner.id) { throw new Error('Falha ao obter ID do parceiro para atualização.');}
      partnerIdSQL = parseInt(partner.id, 10);
      partnerNameForReturn = partner.name;
    }

    let programadoParaSQL: string | null = null;
    if (osData.programadoPara && osData.programadoPara.trim() !== '') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(osData.programadoPara)) {
          const parsedDate = parseISO(osData.programadoPara + "T00:00:00.000Z");
          if (isValid(parsedDate)) programadoParaSQL = osData.programadoPara;
      } else {
          try {
            const parsedDate = parseISO(osData.programadoPara);
            if (isValid(parsedDate)) programadoParaSQL = formatDateFns(parsedDate, 'yyyy-MM-dd');
          } catch (e) { console.warn(`[OSAction updateOSInDB] Erro ao parsear programadoPara ISO "${osData.programadoPara}" para update.`); }
      }
    }

    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      'SELECT status, dataAbertura, dataInicioProducao, dataFinalizacao, tempoGastoProducaoSegundos, dataInicioProducaoAtual FROM os_table WHERE id = ?',
      [osData.id]
    );
    if (currentOSRows.length === 0) { throw new Error(`OS com ID ${osData.id} não encontrada para atualização.`); }
    const currentOSFromDB = currentOSRows[0];

    const now = new Date();
    let newStatus = osData.status;
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataFinalizacaoSQL: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (newStatus !== currentOSFromDB.status) {
      console.log(`[OSAction updateOSInDB] Status mudou de ${currentOSFromDB.status} para ${newStatus}`);
      if (newStatus === OSStatus.EM_PRODUCAO) {
        if (!newDataInicioProducaoAtualSQL) {
          newDataInicioProducaoAtualSQL = now;
          if (!newDataInicioProducaoHistoricoSQL) {
            newDataInicioProducaoHistoricoSQL = now;
          }
        }
      } else { 
        if (newDataInicioProducaoAtualSQL) { 
          const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
          newTempoGastoProducaoSegundosSQL += secondsElapsed;
          newDataInicioProducaoAtualSQL = null;
        }
      }
      if (newStatus === OSStatus.FINALIZADO) {
        if (!newDataFinalizacaoSQL) newDataFinalizacaoSQL = now;
      } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) {
        newDataFinalizacaoSQL = null;
      }
    }
    
    // This ensures that if osData from client provides explicit timer data (due to manual play/pause), it takes precedence.
    // This can happen if toggleProductionTimer was called just before saving other fields.
    if (osData.dataInicioProducaoAtual !== undefined) { // If client sent this, it means a manual toggle happened
        newDataInicioProducaoAtualSQL = osData.dataInicioProducaoAtual ? parseISO(osData.dataInicioProducaoAtual) : null;
    }
    if (osData.tempoGastoProducaoSegundos !== undefined) {
        newTempoGastoProducaoSegundosSQL = osData.tempoGastoProducaoSegundos;
    }
     if (osData.dataInicioProducao !== undefined && !newDataInicioProducaoHistoricoSQL && newDataInicioProducaoAtualSQL) { // only set if relevant
        newDataInicioProducaoHistoricoSQL = parseISO(osData.dataInicioProducao);
     }


    const updateQuery = `
      UPDATE os_table SET
        cliente_id = ?, parceiro_id = ?, projeto = ?, tarefa = ?, observacoes = ?,
        tempoTrabalhado = ?, status = ?, programadoPara = ?, isUrgent = ?,
        dataFinalizacao = ?, dataInicioProducao = ?, 
        tempoGastoProducaoSegundos = ?, dataInicioProducaoAtual = ?, updated_at = NOW()
      WHERE id = ?`;
    const values = [
      parseInt(client.id, 10), partnerIdSQL, osData.projeto, osData.tarefa,
      osData.observacoes || '', osData.tempoTrabalhado || null, newStatus,
      programadoParaSQL, osData.isUrgent, newDataFinalizacaoSQL,
      newDataInicioProducaoHistoricoSQL, newTempoGastoProducaoSegundosSQL,
      newDataInicioProducaoAtualSQL, parseInt(osData.id, 10)
    ];
    console.log('[OSAction updateOSInDB] Query de Update SQL:', updateQuery.trim().replace(/\s+/g, ' '));
    console.log('[OSAction updateOSInDB] Valores para Update:', values.map(v => v instanceof Date ? v.toISOString() : v));

    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);
    await connection.commit();

    const updatedOSForReturn: OS = {
      ...osData, 
      clientId: client.id, cliente: client.name,
      parceiro: partnerNameForReturn, partnerId: partnerIdSQL ? String(partnerIdSQL) : undefined,
      programadoPara: programadoParaSQL ?? undefined,
      dataAbertura: currentOSFromDB.dataAbertura ? new Date(currentOSFromDB.dataAbertura).toISOString() : new Date().toISOString(),
      status: newStatus,
      dataFinalizacao: newDataFinalizacaoSQL ? newDataFinalizacaoSQL.toISOString() : undefined,
      dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
      tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
      dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
      tempoProducaoMinutos: Math.floor(newTempoGastoProducaoSegundosSQL / 60),
    };
    console.log('[OSAction updateOSInDB] OS atualizada retornada para o store:', JSON.stringify(updatedOSForReturn, null, 2));
    return updatedOSForReturn;

  } catch (error: any) {
    console.error(`[OSAction updateOSInDB] Erro ao atualizar OS ID ${osData.id}. Rollback será tentado. Erro:`, error.message, error.stack, error.code, error.sqlMessage);
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}


export async function getAllOSFromDB(): Promise<OS[]> {
  const connection = await db.getConnection();
  try {
    const query = `
      SELECT
        os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.tempoTrabalhado, os.status,
        os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
        os.dataInicioProducao, os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual,
        os.created_at, os.updated_at, -- Re-added these
        c.id as clientId, c.name as cliente_name,
        p.id as partnerId, p.name as partner_name
      FROM os_table os
      JOIN clients c ON os.cliente_id = c.id
      LEFT JOIN partners p ON os.parceiro_id = p.id
      ORDER BY os.isUrgent DESC, os.dataAbertura DESC
    `;
    const [rows] = await connection.query<RowDataPacket[]>(query);
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
      programadoPara: row.programadoPara ? formatDateFns(parseISO(row.programadoPara + "T00:00:00Z"), 'yyyy-MM-dd') : undefined,
      isUrgent: Boolean(row.isUrgent),
      dataInicioProducao: row.dataInicioProducao ? new Date(row.dataInicioProducao).toISOString() : undefined,
      tempoProducaoMinutos: row.tempoGastoProducaoSegundos ? Math.floor(row.tempoGastoProducaoSegundos / 60) : undefined, // Calculated for display
      tempoGastoProducaoSegundos: row.tempoGastoProducaoSegundos || 0,
      dataInicioProducaoAtual: row.dataInicioProducaoAtual ? new Date(row.dataInicioProducaoAtual).toISOString() : null,
    }));
  } catch (error: any) {
    console.error('[OSAction getAllOSFromDB] Erro original do DB:', error.message, error.stack, error.code, error.sqlMessage);
    throw new Error(`Falha ao buscar lista de OS do banco: ${error.message || 'Erro desconhecido'}`);
  } finally {
    if (connection) connection.release();
  }
}

export async function updateOSStatusInDB(osId: string, newStatus: OSStatus): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log(`[OSAction updateOSStatusInDB] Atualizando OS ID ${osId} para status ${newStatus}`);
  try {
    await connection.beginTransaction();

    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM os_table WHERE id = ?', 
      [osId]
    );
    if (currentOSRows.length === 0) { throw new Error(`OS ID ${osId} não encontrada.`); }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction updateOSStatusInDB] Estado atual (antes de mudar status) da OS ID ${osId} no DB:`, JSON.stringify(currentOSFromDB, null, 2));


    const now = new Date();
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataFinalizacaoSQL: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (newStatus === OSStatus.EM_PRODUCAO) {
      if (!newDataInicioProducaoAtualSQL) { 
          newDataInicioProducaoAtualSQL = now;
          if (!newDataInicioProducaoHistoricoSQL) {
              newDataInicioProducaoHistoricoSQL = now;
          }
      }
    } else { 
      if (newDataInicioProducaoAtualSQL) { 
          const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
          newTempoGastoProducaoSegundosSQL += secondsElapsed;
          newDataInicioProducaoAtualSQL = null;
      }
    }

    if (newStatus === OSStatus.FINALIZADO) {
        if (!newDataFinalizacaoSQL) { 
            newDataFinalizacaoSQL = now;
        }
    } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) {
      newDataFinalizacaoSQL = null;
    }

    const sql = `
      UPDATE os_table SET
        status = ?, dataFinalizacao = ?, dataInicioProducao = ?, 
        tempoGastoProducaoSegundos = ?, dataInicioProducaoAtual = ?, updated_at = NOW()
      WHERE id = ?`;
    const values = [
      newStatus, newDataFinalizacaoSQL, newDataInicioProducaoHistoricoSQL,
      newTempoGastoProducaoSegundosSQL, newDataInicioProducaoAtualSQL, parseInt(osId, 10)
    ];
    console.log(`[OSAction updateOSStatusInDB] SQL: ${sql.trim().replace(/\s+/g, ' ')}`);
    console.log(`[OSAction updateOSStatusInDB] Valores:`, values.map(v => v instanceof Date ? v.toISOString() : v));

    const [result] = await connection.execute<ResultSetHeader>(sql, values);
    await connection.commit();
    
    if (result.affectedRows > 0) {
        const [clientRows] = await connection.query<RowDataPacket[]>('SELECT name FROM clients WHERE id = ?', [currentOSFromDB.cliente_id]);
        const clientName = clientRows.length > 0 ? clientRows[0].name : 'Cliente Desconhecido';
        let partnerName: string | undefined = undefined;
        if (currentOSFromDB.parceiro_id) {
            const [partnerRows] = await connection.query<RowDataPacket[]>('SELECT name FROM partners WHERE id = ?', [currentOSFromDB.parceiro_id]);
            partnerName = partnerRows.length > 0 ? partnerRows[0].name : undefined;
        }

        const updatedOS: OS = {
            id: osId,
            numero: currentOSFromDB.numero,
            cliente: clientName,
            parceiro: partnerName,
            clientId: String(currentOSFromDB.cliente_id),
            partnerId: currentOSFromDB.parceiro_id ? String(currentOSFromDB.parceiro_id) : undefined,
            projeto: currentOSFromDB.projeto,
            tarefa: currentOSFromDB.tarefa,
            observacoes: currentOSFromDB.observacoes,
            tempoTrabalhado: currentOSFromDB.tempoTrabalhado,
            status: newStatus,
            dataAbertura: new Date(currentOSFromDB.dataAbertura).toISOString(),
            programadoPara: currentOSFromDB.programadoPara ? formatDateFns(parseISO(currentOSFromDB.programadoPara + "T00:00:00Z"), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(currentOSFromDB.isUrgent),
            dataFinalizacao: newDataFinalizacaoSQL ? newDataFinalizacaoSQL.toISOString() : undefined,
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
            tempoProducaoMinutos: Math.floor(newTempoGastoProducaoSegundosSQL / 60),
        };
        console.log(`[OSAction updateOSStatusInDB] OS atualizada retornada para o store:`, JSON.stringify(updatedOS, null, 2));
        return updatedOS;
    }
    await connection.rollback(); 
    return null;

  } catch (error: any) {
    console.error(`[OSAction updateOSStatusInDB] Erro ao atualizar status da OS ID ${osId} para ${newStatus}:`, error.message, error.stack, error.code, error.sqlMessage);
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}

export async function toggleOSProductionTimerInDB(osId: string, action: 'play' | 'pause'): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log(`[OSAction toggleOSProductionTimerInDB] OS ID: ${osId}, Ação: ${action}`);
  try {
    await connection.beginTransaction();

    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM os_table WHERE id = ?', 
      [osId]
    );
    if (currentOSRows.length === 0) { throw new Error(`OS ID ${osId} não encontrada para toggle.`);}
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction toggleOSProductionTimerInDB] Estado atual da OS ID ${osId}:`, JSON.stringify(currentOSFromDB, null, 2));


    const now = new Date();
    let newStatus = currentOSFromDB.status as OSStatus;
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (action === 'play') {
      if (!newDataInicioProducaoAtualSQL && newStatus !== OSStatus.FINALIZADO) { 
        newDataInicioProducaoAtualSQL = now;
        if (newStatus !== OSStatus.EM_PRODUCAO) { // Only change status if it's not already In Production
            newStatus = OSStatus.EM_PRODUCAO; 
        }
        if (!newDataInicioProducaoHistoricoSQL) {
             newDataInicioProducaoHistoricoSQL = now;
        }
      }
    } else if (action === 'pause') {
      if (newDataInicioProducaoAtualSQL) { 
        const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
        newTempoGastoProducaoSegundosSQL += secondsElapsed;
        newDataInicioProducaoAtualSQL = null;
        // Pausing manually does NOT change the status. User changes status via dropdown.
      }
    }

    const updateQuery = `
      UPDATE os_table SET
        status = ?, tempoGastoProducaoSegundos = ?, dataInicioProducaoAtual = ?,
        dataInicioProducao = ?, updated_at = NOW()
      WHERE id = ?`;
    const values = [
      newStatus, newTempoGastoProducaoSegundosSQL, newDataInicioProducaoAtualSQL,
      newDataInicioProducaoHistoricoSQL, parseInt(osId, 10)
    ];

    console.log('[OSAction toggleOSProductionTimerInDB] Query:', updateQuery.trim().replace(/\s+/g, ' '));
    console.log('[OSAction toggleOSProductionTimerInDB] Valores:', values.map(v => v instanceof Date ? v.toISOString() : v));
    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);
    await connection.commit();
    
    if (result.affectedRows > 0) {
        const [clientRows] = await connection.query<RowDataPacket[]>('SELECT name FROM clients WHERE id = ?', [currentOSFromDB.cliente_id]);
        const clientName = clientRows.length > 0 ? clientRows[0].name : 'Cliente Desconhecido';
        let partnerName: string | undefined = undefined;
        if (currentOSFromDB.parceiro_id) {
            const [partnerRows] = await connection.query<RowDataPacket[]>('SELECT name FROM partners WHERE id = ?', [currentOSFromDB.parceiro_id]);
            partnerName = partnerRows.length > 0 ? partnerRows[0].name : undefined;
        }
        const updatedOS: OS = {
            id: osId,
            numero: currentOSFromDB.numero,
            cliente: clientName,
            parceiro: partnerName,
            clientId: String(currentOSFromDB.cliente_id),
            partnerId: currentOSFromDB.parceiro_id ? String(currentOSFromDB.parceiro_id) : undefined,
            projeto: currentOSFromDB.projeto,
            tarefa: currentOSFromDB.tarefa,
            observacoes: currentOSFromDB.observacoes,
            tempoTrabalhado: currentOSFromDB.tempoTrabalhado,
            status: newStatus, 
            dataAbertura: new Date(currentOSFromDB.dataAbertura).toISOString(),
            programadoPara: currentOSFromDB.programadoPara ? formatDateFns(parseISO(currentOSFromDB.programadoPara + "T00:00:00Z"), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(currentOSFromDB.isUrgent),
            dataFinalizacao: currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao).toISOString() : undefined, // Not changed by timer toggle
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
            tempoProducaoMinutos: Math.floor(newTempoGastoProducaoSegundosSQL / 60),
        };
        console.log(`[OSAction toggleOSProductionTimerInDB] OS atualizada retornada para o store:`, JSON.stringify(updatedOS, null, 2));
        return updatedOS;
    }
    await connection.rollback();
    return null;

  } catch (error: any) {
    console.error(`[OSAction toggleOSProductionTimerInDB] Erro ao alternar timer para OS ID ${osId}:`, error.message, error.stack, error.code, error.sqlMessage);
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}

    