
// src/lib/actions/os-actions.ts
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData, ChecklistItem, PartnerSessionData } from '@/lib/types';
import { OSStatus } from '@/lib/types';
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import { parseISO, differenceInSeconds, format as formatDateFns, isValid } from 'date-fns';
import { sendOSApprovalEmail, sendGeneralStatusUpdateEmail } from '@/lib/email-service';

const generateNewOSNumero = async (connection: PoolConnection): Promise<string> => {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT MAX(CAST(numero AS UNSIGNED)) as maxNumero FROM os_table");
  const maxNumero = rows[0]?.maxNumero || 0;
  const newNumeroInt = Number(maxNumero) + 1;
  const newNumeroStr = String(newNumeroInt).padStart(6, '0');
  return newNumeroStr;
};

const mapDbRowToOS = (row: RowDataPacket): OS => {
  let parsedChecklist: ChecklistItem[] = [];
  if (row.checklist_json) {
    try {
      const rawChecklist = JSON.parse(row.checklist_json);
      if (Array.isArray(rawChecklist)) {
        parsedChecklist = rawChecklist.map((item, index) => ({
          id: `db-item-${row.id}-${index}`,
          text: item.text || '',
          completed: item.completed || false,
        }));
      }
    } catch (e) {
    }
  }

  let dataAberturaISO: string;
  const dataAberturaParsed = new Date(row.dataAbertura);
  if (isValid(dataAberturaParsed)) {
    dataAberturaISO = dataAberturaParsed.toISOString();
  } else {
    dataAberturaISO = new Date(0).toISOString();
  }

  let dataFinalizacaoISO: string | undefined = undefined;
  if (row.dataFinalizacao) {
    const parsed = new Date(row.dataFinalizacao);
    if (isValid(parsed)) dataFinalizacaoISO = parsed.toISOString();
  }

  let programadoParaFormatted: string | undefined = undefined;
  if (row.programadoPara && typeof row.programadoPara === 'string') {
     if (/^\d{4}-\d{2}-\d{2}$/.test(row.programadoPara)) {
        const parsedDate = parseISO(row.programadoPara + "T00:00:00Z");
        if (isValid(parsedDate)) {
            programadoParaFormatted = formatDateFns(parsedDate, 'yyyy-MM-dd');
        }
    } else {
        const parsedDate = parseISO(row.programadoPara);
        if (isValid(parsedDate)) {
             programadoParaFormatted = formatDateFns(parsedDate, 'yyyy-MM-dd');
        }
    }
  }

  let dataInicioProducaoISO: string | undefined = undefined;
  if (row.dataInicioProducao) {
    const parsed = new Date(row.dataInicioProducao);
    if (isValid(parsed)) dataInicioProducaoISO = parsed.toISOString();
  }

  let dataInicioProducaoAtualISO: string | null = null;
  if (row.dataInicioProducaoAtual) {
    const parsed = new Date(row.dataInicioProducaoAtual);
    if (isValid(parsed)) dataInicioProducaoAtualISO = parsed.toISOString();
  }

  return {
    id: String(row.id),
    numero: row.numero,
    cliente: row.cliente_name,
    parceiro: row.execution_partner_name || undefined,
    clientId: String(row.cliente_id),
    partnerId: row.parceiro_id ? String(row.parceiro_id) : undefined,
    projeto: row.projeto,
    tarefa: row.tarefa,
    observacoes: row.observacoes,
    checklist: parsedChecklist,
    status: row.status as OSStatus,
    dataAbertura: dataAberturaISO,
    dataFinalizacao: dataFinalizacaoISO,
    programadoPara: programadoParaFormatted,
    isUrgent: Boolean(row.isUrgent),
    dataInicioProducao: dataInicioProducaoISO,
    tempoGastoProducaoSegundos: row.tempoGastoProducaoSegundos || 0,
    dataInicioProducaoAtual: dataInicioProducaoAtualISO,
    createdByPartnerId: row.created_by_partner_id ? String(row.created_by_partner_id) : undefined,
    creatorName: row.creator_name,
    creatorType: row.creator_type,
  };
};

const OS_SELECT_QUERY_FIELDS = `
  os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.checklist_json, os.status,
  os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
  os.dataInicioProducao, os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual,
  os.cliente_id, c.name as cliente_name,
  os.parceiro_id, exec_p.name as execution_partner_name,
  os.created_by_partner_id, os.creator_name, os.creator_type
`;

export async function createOSInDB(data: CreateOSData, creator: { name: string, type: 'admin' | 'partner', id?: string }): Promise<OS | null> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const client = await findOrCreateClientByName(data.cliente, null, connection);
    if (!client || !client.id) {
      await connection.rollback();
      throw new Error('Falha ao obter ID do cliente.');
    }

    let executionPartnerId: string | null = null;
    let executionPartnerIdSQL: number | null = null;
    if (data.parceiro && data.parceiro.trim() !== '') {
      const execPartner = await findOrCreatePartnerByName(data.parceiro, connection);
      if (!execPartner || !execPartner.id) {
        await connection.rollback();
        throw new Error('Falha ao obter ID do parceiro de execução.');
      }
      executionPartnerId = execPartner.id;
      const parsedExecPartnerId = parseInt(executionPartnerId, 10);
      if (isNaN(parsedExecPartnerId)) {
          await connection.rollback();
          throw new Error(`ID do parceiro de execução inválido: ${executionPartnerId}`);
      }
      executionPartnerIdSQL = parsedExecPartnerId;
    }

    const newOsNumero = await generateNewOSNumero(connection);

    let programadoParaDate: string | null = null;
    if (data.programadoPara && data.programadoPara.trim() !== '') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(data.programadoPara)) {
          const parsedDate = parseISO(data.programadoPara + "T00:00:00.000Z");
          if (isValid(parsedDate)) {
            programadoParaDate = data.programadoPara;
          }
      }
    }

    let checklistJsonForDB: string | null = null;
    if (data.checklistItems && data.checklistItems.length > 0) {
      const checklistToStore: Omit<ChecklistItem, 'id'>[] = data.checklistItems
        .map(text => ({ text: text.trim(), completed: false }))
        .filter(item => item.text !== '');
      if (checklistToStore.length > 0) {
        checklistJsonForDB = JSON.stringify(checklistToStore);
      }
    }

    const now = new Date();
    let initialStatus = data.status || OSStatus.NA_FILA;
    let createdByPartnerIdSQL: number | null = null;

    if (creator.type === 'partner' && creator.id) {
        initialStatus = OSStatus.AGUARDANDO_APROVACAO;
        const parsedId = parseInt(creator.id, 10);
        if (!isNaN(parsedId)) {
            createdByPartnerIdSQL = parsedId;
        } else {
        }
    }

    const clienteIdSQL = parseInt(client.id, 10);
    if (isNaN(clienteIdSQL)) {
        await connection.rollback();
        throw new Error(`ID do cliente inválido: ${client.id}`);
    }

    const osDataForDB = {
      numero: newOsNumero,
      cliente_id: clienteIdSQL,
      parceiro_id: executionPartnerIdSQL,
      projeto: data.projeto,
      tarefa: data.tarefa,
      observacoes: data.observacoes || '',
      checklist_json: checklistJsonForDB,
      status: initialStatus,
      dataAbertura: now,
      programadoPara: programadoParaDate,
      isUrgent: data.isUrgent || false,
      dataFinalizacao: null,
      dataInicioProducao: initialStatus === OSStatus.EM_PRODUCAO ? now : null,
      tempoGastoProducaoSegundos: 0,
      dataInicioProducaoAtual: initialStatus === OSStatus.EM_PRODUCAO ? now : null,
      created_at: now,
      updated_at: now,
      created_by_partner_id: createdByPartnerIdSQL,
      creator_name: creator.name,
      creator_type: creator.type,
    };

    const insertQueryValues = [
        osDataForDB.numero, osDataForDB.cliente_id, osDataForDB.parceiro_id,
        osDataForDB.projeto, osDataForDB.tarefa, osDataForDB.observacoes, osDataForDB.checklist_json,
        osDataForDB.status, osDataForDB.dataAbertura, osDataForDB.programadoPara, osDataForDB.isUrgent,
        osDataForDB.dataFinalizacao, osDataForDB.dataInicioProducao, osDataForDB.tempoGastoProducaoSegundos,
        osDataForDB.dataInicioProducaoAtual, osDataForDB.created_at, osDataForDB.updated_at,
        osDataForDB.created_by_partner_id, osDataForDB.creator_name, osDataForDB.creator_type
    ];

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO os_table (numero, cliente_id, parceiro_id, projeto, tarefa, observacoes, checklist_json, status, dataAbertura, programadoPara, isUrgent, dataFinalizacao, dataInicioProducao, tempoGastoProducaoSegundos, dataInicioProducaoAtual, created_at, updated_at, created_by_partner_id, creator_name, creator_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertQueryValues
    );


    if (!result.insertId) {
      await connection.rollback();
      throw new Error('Falha ao criar OS: Nenhum insertId válido retornado.');
    }
    await connection.commit();

    const [createdOSRows] = await connection.query<RowDataPacket[]>(
      `SELECT ${OS_SELECT_QUERY_FIELDS}
       FROM os_table os
       JOIN clients c ON os.cliente_id = c.id
       LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
       WHERE os.id = ?`,
      [result.insertId]
    );
    if (createdOSRows.length === 0) {
      throw new Error('Falha ao buscar OS recém-criada.');
    }
    const createdOSForReturn = mapDbRowToOS(createdOSRows[0]);
    return createdOSForReturn;

  } catch (error: any) {
    if (connection) {
        await connection.rollback();
    }
    throw new Error(`Falha ao criar OS no banco: ${error.message || 'Erro desconhecido'}`);
  } finally {
    if (connection) {
        connection.release();
    }
  }
}


export async function updateOSInDB(osData: OS): Promise<OS | null> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM os_table WHERE id = ? FOR UPDATE',
      [osData.id]
    );
    if (currentOSRows.length === 0) {
      await connection.rollback();
      throw new Error(`OS com ID ${osData.id} não encontrada.`);
    }
    const currentOSFromDB = currentOSRows[0];

    const client = await findOrCreateClientByName(osData.cliente, null, connection);
    if (!client || !client.id) {
      await connection.rollback();
      throw new Error('Falha ao obter ID do cliente para atualização.');
    }
    let executionPartnerIdSQL: number | null = null;
    if (osData.parceiro && osData.parceiro.trim() !== '') {
      const execPartner = await findOrCreatePartnerByName(osData.parceiro, connection);
      if (!execPartner || !execPartner.id) {
        await connection.rollback();
        throw new Error('Falha ao obter ID do parceiro de execução.');
      }
       const parsedExecPartnerId = parseInt(execPartner.id, 10);
        if (isNaN(parsedExecPartnerId)) {
            await connection.rollback();
            throw new Error(`ID do parceiro de execução inválido ao atualizar: ${execPartner.id}`);
        }
      executionPartnerIdSQL = parsedExecPartnerId;
    }

    const now = new Date();
    let newStatus = osData.status;
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataFinalizacaoSQL: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (newStatus !== currentOSFromDB.status) {
      if (newStatus === OSStatus.EM_PRODUCAO) {
        if (!newDataInicioProducaoAtualSQL) {
          newDataInicioProducaoAtualSQL = now;
          if (!newDataInicioProducaoHistoricoSQL) newDataInicioProducaoHistoricoSQL = now;
        }
      } else {
        if (newDataInicioProducaoAtualSQL) {
          const currentSessionSeconds = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
          newTempoGastoProducaoSegundosSQL += currentSessionSeconds;
          newDataInicioProducaoAtualSQL = null;
        }
      }
      if (newStatus === OSStatus.FINALIZADO && !newDataFinalizacaoSQL) {
        newDataFinalizacaoSQL = now;
      } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) {
        newDataFinalizacaoSQL = null; // Reabrindo OS finalizada
      }
    }


    let programadoParaSQL: string | null = null;
    if (osData.programadoPara && osData.programadoPara.trim() !== '') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(osData.programadoPara)) {
        const parsedDate = parseISO(osData.programadoPara); // Não precisa adicionar T00:00:00Z aqui, já que o formato é só data
        if (isValid(parsedDate)) {
             programadoParaSQL = osData.programadoPara;
        }
      }
    }


    let checklistJsonToSave: string | null = null;
    if (osData.checklist && Array.isArray(osData.checklist) && osData.checklist.length > 0) {
        const checklistToStore = osData.checklist.map(item => ({
            text: item.text.trim(),
            completed: item.completed
        })).filter(item => item.text !== '');
        if (checklistToStore.length > 0) {
            checklistJsonToSave = JSON.stringify(checklistToStore);
        }
    }

    const clienteIdSQL = parseInt(client.id, 10);
    if (isNaN(clienteIdSQL)) {
        await connection.rollback();
        throw new Error(`ID do cliente inválido ao atualizar: ${client.id}`);
    }


    const updateQuery = `
      UPDATE os_table SET
        cliente_id = ?, parceiro_id = ?, projeto = ?, tarefa = ?, observacoes = ?, checklist_json = ?,
        status = ?, programadoPara = ?, isUrgent = ?,
        dataFinalizacao = ?, dataInicioProducao = ?,
        tempoGastoProducaoSegundos = ?, dataInicioProducaoAtual = ?, updated_at = NOW()
      WHERE id = ?`;
    const values = [
      clienteIdSQL, executionPartnerIdSQL, osData.projeto, osData.tarefa,
      osData.observacoes || '', checklistJsonToSave, newStatus,
      programadoParaSQL, osData.isUrgent, newDataFinalizacaoSQL,
      newDataInicioProducaoHistoricoSQL, newTempoGastoProducaoSegundosSQL,
      newDataInicioProducaoAtualSQL, parseInt(osData.id, 10)
    ];


    await connection.execute<ResultSetHeader>(updateQuery, values);
    await connection.commit();


    const [updatedOSRows] = await connection.query<RowDataPacket[]>(
      `SELECT ${OS_SELECT_QUERY_FIELDS}
       FROM os_table os
       JOIN clients c ON os.cliente_id = c.id
       LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
       WHERE os.id = ?`,
      [osData.id]
    );
    if (updatedOSRows.length === 0) {
      throw new Error('Falha ao buscar OS atualizada.');
    }
    const updatedOSForReturn = mapDbRowToOS(updatedOSRows[0]);
    return updatedOSForReturn;

  } catch (error: any) {
    if (connection) {
        await connection.rollback();
    }
    // Retorne null ou lance o erro dependendo da sua estratégia de tratamento de erros no store
    return null;
  } finally {
    if (connection) {
        connection.release();
    }
  }
}


export async function getAllOSFromDB(): Promise<OS[]> {
  const connection = await db.getConnection();
  try {
    const query = `
      SELECT ${OS_SELECT_QUERY_FIELDS}
      FROM os_table os
      JOIN clients c ON os.cliente_id = c.id
      LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
      ORDER BY os.isUrgent DESC,
               CASE os.status
                 WHEN '${OSStatus.AGUARDANDO_APROVACAO}' THEN 1
                 WHEN '${OSStatus.RECUSADA}' THEN 3
                 ELSE 2
               END,
               os.dataAbertura DESC
    `;
    const [rows] = await connection.query<RowDataPacket[]>(query);

    return rows.map(mapDbRowToOS);
  } catch (error: any) {
    throw new Error(`Falha ao buscar lista de OS do banco: ${error.message || 'Erro desconhecido'}`);
  } finally {
    if (connection) connection.release();
  }
}

export async function updateOSStatusInDB(osId: string, newStatus: OSStatus, adminApproverName?: string): Promise<OS | null> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [currentOSRows] = await connection.query<RowDataPacket[]>(
        `SELECT
            os.*,
            creator_p.name as creator_partner_name,
            creator_p.email as creator_partner_email,
            exec_p.name as execution_partner_name,
            exec_p.email as execution_partner_email
        FROM os_table os
        LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
        LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
        WHERE os.id = ? FOR UPDATE`,
        [osId]
    );

    if (currentOSRows.length === 0) {
      await connection.rollback();
      throw new Error(`OS ID ${osId} não encontrada.`);
    }
    const currentOSFromDB = currentOSRows[0];
    const originalStatus = currentOSFromDB.status as OSStatus;

    if (originalStatus === newStatus) {
        await connection.rollback(); // No change needed
        const osToReturn = mapDbRowToOS(currentOSFromDB);
        return osToReturn;
    }

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
        newTempoGastoProducaoSegundosSQL = (currentOSFromDB.tempoGastoProducaoSegundos || 0) + differenceInSeconds(now, newDataInicioProducaoAtualSQL);
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

    await connection.execute<ResultSetHeader>(sql, values);
    const osDataForEmail = mapDbRowToOS(currentOSFromDB);

    // --- Start Email Logic ---
    if (originalStatus === OSStatus.AGUARDANDO_APROVACAO && (newStatus === OSStatus.NA_FILA || newStatus === OSStatus.RECUSADA)) {
        const partnerEmail = currentOSFromDB.creator_partner_email;
        const partnerName = currentOSFromDB.creator_partner_name;
        if (partnerEmail && partnerName) {
            await sendOSApprovalEmail(partnerEmail, partnerName, osDataForEmail, newStatus, adminApproverName || 'um administrador');
        }
    } else { // Handle general status changes
        const partnerEmail = currentOSFromDB.execution_partner_email || currentOSFromDB.creator_partner_email;
        const partnerName = currentOSFromDB.execution_partner_name || currentOSFromDB.creator_partner_name;

        if(partnerEmail && partnerName) {
             await sendGeneralStatusUpdateEmail(partnerEmail, partnerName, osDataForEmail, originalStatus, newStatus, adminApproverName || 'um administrador');
        }
    }
    // --- End Email Logic ---

    await connection.commit();

    const [updatedOSRows] = await connection.query<RowDataPacket[]>(
        `SELECT ${OS_SELECT_QUERY_FIELDS}
         FROM os_table os
         JOIN clients c ON os.cliente_id = c.id
         LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
         WHERE os.id = ?`,
        [osId]
    );
    if (updatedOSRows.length === 0) throw new Error('Falha ao buscar OS atualizada após mudança de status.');

    const updatedOSForReturn = mapDbRowToOS(updatedOSRows[0]);

    return updatedOSForReturn;

  } catch (error: any) {
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}

export async function toggleOSProductionTimerInDB(osId: string, action: 'play' | 'pause'): Promise<OS | null> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      `SELECT ${OS_SELECT_QUERY_FIELDS}
       FROM os_table os
       JOIN clients c ON os.cliente_id = c.id
       LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
       WHERE os.id = ? FOR UPDATE`, [osId]
    );
    if (currentOSRows.length === 0) {
      await connection.rollback();
      throw new Error(`OS ID ${osId} não encontrada.`);
    }
    const currentOSFromDB = currentOSRows[0];

    if ((currentOSFromDB.status === OSStatus.FINALIZADO || currentOSFromDB.status === OSStatus.AGUARDANDO_APROVACAO || currentOSFromDB.status === OSStatus.RECUSADA) && action === 'play') {
      await connection.rollback(); // Não faz nada se a OS estiver finalizada, aguardando aprovação ou recusada
      return mapDbRowToOS(currentOSFromDB);
    }

    const now = new Date();
    let newStatus = currentOSFromDB.status as OSStatus;
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (action === 'play') {
      if (!newDataInicioProducaoAtualSQL) { // Só inicia se não estiver rodando
        newDataInicioProducaoAtualSQL = now;
        newStatus = OSStatus.EM_PRODUCAO; // Muda status para Em Produção
        if (!newDataInicioProducaoHistoricoSQL) { // Se for o primeiro play, registra o início histórico
          newDataInicioProducaoHistoricoSQL = now;
        }
      } else {
          // Já está rodando, não faz nada, apenas retorna o estado atual
          await connection.rollback();
          return mapDbRowToOS(currentOSFromDB);
      }
    } else if (action === 'pause') {
      if (newDataInicioProducaoAtualSQL) { // Só pausa se estiver rodando
        newTempoGastoProducaoSegundosSQL = (currentOSFromDB.tempoGastoProducaoSegundos || 0) + differenceInSeconds(now, newDataInicioProducaoAtualSQL);
        newDataInicioProducaoAtualSQL = null;
        // Ao pausar, volta para "Na Fila" se estava "Em Produção"
        if (newStatus === OSStatus.EM_PRODUCAO) {
            newStatus = OSStatus.NA_FILA;
        }
      } else {
         // Não estava rodando, não faz nada, apenas retorna o estado atual
         await connection.rollback();
         return mapDbRowToOS(currentOSFromDB);
      }
    }

    const updateQuery = `UPDATE os_table SET status = ?, tempoGastoProducaoSegundos = ?, dataInicioProducaoAtual = ?, dataInicioProducao = ?, updated_at = NOW() WHERE id = ?`;
    const values = [newStatus, newTempoGastoProducaoSegundosSQL, newDataInicioProducaoAtualSQL, newDataInicioProducaoHistoricoSQL, parseInt(osId, 10)];
    await connection.execute<ResultSetHeader>(updateQuery, values);
    await connection.commit();

    const [updatedOSRowsAgain] = await connection.query<RowDataPacket[]>(
        `SELECT ${OS_SELECT_QUERY_FIELDS}
         FROM os_table os
         JOIN clients c ON os.cliente_id = c.id
         LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
         WHERE os.id = ?`, [osId]
      );
    if (updatedOSRowsAgain.length === 0) throw new Error('Falha ao buscar OS atualizada pós-toggle do timer.');
    return mapDbRowToOS(updatedOSRowsAgain[0]);

  } catch (error: any) {
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}
