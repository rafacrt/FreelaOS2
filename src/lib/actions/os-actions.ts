
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData, ChecklistItem } from '@/lib/types';
import { OSStatus } from '@/lib/types'; 
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import { parseISO, differenceInSeconds, format as formatDateFns, isValid } from 'date-fns'; 
import { ptBR } from 'date-fns/locale';

const generateNewOSNumero = async (connection: PoolConnection): Promise<string> => {
  console.log('[OSAction generateNewOSNumero] Gerando novo número de OS...');
  const [rows] = await connection.query<RowDataPacket[]>("SELECT MAX(CAST(numero AS UNSIGNED)) as maxNumero FROM os_table");
  const maxNumero = rows[0]?.maxNumero || 0;
  const newNumeroInt = Number(maxNumero) + 1;
  const newNumeroStr = String(newNumeroInt).padStart(6, '0');
  console.log(`[OSAction generateNewOSNumero] Novo número gerado: ${newNumeroStr}`);
  return newNumeroStr;
};

// Updated to accept createdByPartnerId
export async function createOSInDB(data: CreateOSData, createdByPartnerId?: string): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log('[OSAction createOSInDB] Iniciando com dados:', JSON.stringify(data, null, 2), `CreatedByPartnerID: ${createdByPartnerId}`);
  try {
    await connection.beginTransaction();
    console.log('[OSAction createOSInDB] Transação iniciada.');

    const client = await findOrCreateClientByName(data.cliente, connection);
    if (!client || !client.id) {
      console.error('[OSAction createOSInDB] Falha ao obter ID do cliente para:', data.cliente);
      await connection.rollback();
      throw new Error('Falha ao obter ID do cliente.');
    }
    console.log(`[OSAction createOSInDB] Cliente resolvido: ID ${client.id}, Nome ${client.name}`);

    let executionPartnerId: string | null = null; // Partner responsible for execution
    let executionPartnerName: string | undefined = undefined;
    if (data.parceiro && data.parceiro.trim() !== '') {
      const execPartner = await findOrCreatePartnerByName(data.parceiro, connection);
      if (!execPartner || !execPartner.id) {
        await connection.rollback();
        throw new Error('Falha ao obter ID do parceiro de execução.');
      }
      executionPartnerId = execPartner.id;
      executionPartnerName = execPartner.name;
      console.log(`[OSAction createOSInDB] Parceiro de execução resolvido: ID ${executionPartnerId}, Nome ${executionPartnerName}`);
    }

    const newOsNumero = await generateNewOSNumero(connection);
    let programadoParaDate: string | null = null;
    if (data.programadoPara && data.programadoPara.trim() !== '') {
      try {
        if (/^\d{4}-\d{2}-\d{2}$/.test(data.programadoPara)) {
          const parsedDate = parseISO(data.programadoPara + "T00:00:00.000Z"); 
          if (isValid(parsedDate)) {
            programadoParaDate = data.programadoPara;
          }
        }
      } catch (e) {
        console.warn(`[OSAction createOSInDB] Erro ao parsear programadoPara: "${data.programadoPara}". Definindo como null. Erro:`, e);
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
    const osDataForDB = {
      numero: newOsNumero,
      cliente_id: parseInt(client.id, 10),
      parceiro_id: executionPartnerId ? parseInt(executionPartnerId, 10) : null, // Execution partner
      created_by_partner_id: createdByPartnerId ? parseInt(createdByPartnerId, 10) : null, // Creator partner
      projeto: data.projeto,
      tarefa: data.tarefa,
      observacoes: data.observacoes || '',
      checklist_json: checklistJsonForDB,
      status: data.status,
      dataAbertura: now,
      programadoPara: programadoParaDate,
      isUrgent: data.isUrgent || false,
      dataFinalizacao: null,
      dataInicioProducao: data.status === OSStatus.EM_PRODUCAO ? now : null,
      tempoGastoProducaoSegundos: 0,
      dataInicioProducaoAtual: data.status === OSStatus.EM_PRODUCAO ? now : null,
      created_at: now,
      updated_at: now,
    };
    console.log('[OSAction createOSInDB] Dados da OS para o DB:', JSON.stringify(osDataForDB, null, 2));

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO os_table (numero, cliente_id, parceiro_id, created_by_partner_id, projeto, tarefa, observacoes, checklist_json, status, dataAbertura, programadoPara, isUrgent, dataFinalizacao, dataInicioProducao, tempoGastoProducaoSegundos, dataInicioProducaoAtual, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        osDataForDB.numero, osDataForDB.cliente_id, osDataForDB.parceiro_id, osDataForDB.created_by_partner_id, 
        osDataForDB.projeto, osDataForDB.tarefa, osDataForDB.observacoes, osDataForDB.checklist_json, 
        osDataForDB.status, osDataForDB.dataAbertura, osDataForDB.programadoPara, osDataForDB.isUrgent, 
        osDataForDB.dataFinalizacao, osDataForDB.dataInicioProducao, osDataForDB.tempoGastoProducaoSegundos,
        osDataForDB.dataInicioProducaoAtual, osDataForDB.created_at, osDataForDB.updated_at
      ]
    );

    if (!result.insertId) {
      await connection.rollback();
      throw new Error('Falha ao criar OS: Nenhum insertId válido retornado.');
    }
    await connection.commit();
    console.log('[OSAction createOSInDB] OS criada e transação commitada. ID:', result.insertId);

    // Fetch the newly created OS along with related names
    const [createdOSRows] = await connection.query<RowDataPacket[]>(
      `SELECT 
         os.*, 
         c.name as cliente_name, 
         exec_p.name as execution_partner_name,
         creator_p.name as creator_partner_name 
       FROM os_table os
       JOIN clients c ON os.cliente_id = c.id
       LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
       LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
       WHERE os.id = ?`,
      [result.insertId]
    );
    if (createdOSRows.length === 0) {
      throw new Error('Falha ao buscar OS recém-criada.');
    }
    const createdOSRow = createdOSRows[0];
    let parsedChecklist: ChecklistItem[] = [];
    if (createdOSRow.checklist_json) {
      try {
        const rawChecklist = JSON.parse(createdOSRow.checklist_json);
        if (Array.isArray(rawChecklist)) {
          parsedChecklist = rawChecklist.map((item, index) => ({
            id: `db-item-${createdOSRow.id}-${index}`,
            text: item.text || '',
            completed: item.completed || false,
          }));
        }
      } catch (e) {
        console.error(`[OSAction createOSInDB] Erro ao parsear checklist_json da OS ID ${createdOSRow.id}:`, e);
      }
    }

    const createdOSForReturn: OS = {
      id: String(createdOSRow.id),
      numero: createdOSRow.numero,
      cliente: createdOSRow.cliente_name,
      parceiro: createdOSRow.execution_partner_name || undefined, // Execution partner
      clientId: String(createdOSRow.cliente_id),
      partnerId: createdOSRow.parceiro_id ? String(createdOSRow.parceiro_id) : undefined,
      createdByPartnerId: createdOSRow.created_by_partner_id ? String(createdOSRow.created_by_partner_id) : undefined,
      createdByPartnerName: createdOSRow.creator_partner_name || undefined,
      projeto: createdOSRow.projeto,
      tarefa: createdOSRow.tarefa,
      observacoes: createdOSRow.observacoes,
      checklist: parsedChecklist,
      status: createdOSRow.status as OSStatus,
      dataAbertura: new Date(createdOSRow.dataAbertura).toISOString(),
      programadoPara: createdOSRow.programadoPara ? formatDateFns(parseISO(createdOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
      isUrgent: Boolean(createdOSRow.isUrgent),
      dataFinalizacao: createdOSRow.dataFinalizacao ? new Date(createdOSRow.dataFinalizacao).toISOString() : undefined,
      dataInicioProducao: createdOSRow.dataInicioProducao ? new Date(createdOSRow.dataInicioProducao).toISOString() : undefined,
      tempoGastoProducaoSegundos: createdOSRow.tempoGastoProducaoSegundos || 0,
      dataInicioProducaoAtual: createdOSRow.dataInicioProducaoAtual ? new Date(createdOSRow.dataInicioProducaoAtual).toISOString() : null,
    };
    console.log('[OSAction createOSInDB] OS formatada para retorno:', JSON.stringify(createdOSForReturn, null, 2));
    return createdOSForReturn;

  } catch (error: any) {
    console.error('[OSAction createOSInDB] Erro durante a criação da OS:', error.message, error.stack);
    if (connection) await connection.rollback();
    throw new Error(`Falha ao criar OS no banco: ${error.message || 'Erro desconhecido'}`);
  } finally {
    if (connection) connection.release();
  }
}


export async function updateOSInDB(osData: OS): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log(`[OSAction updateOSInDB] Iniciando atualização para OS ID: ${osData.id}. Dados recebidos:`, JSON.stringify(osData, null, 2));
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

    const client = await findOrCreateClientByName(osData.cliente, connection);
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
      executionPartnerIdSQL = parseInt(execPartner.id, 10);
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
          newTempoGastoProducaoSegundosSQL += differenceInSeconds(now, newDataInicioProducaoAtualSQL);
          newDataInicioProducaoAtualSQL = null;
        }
      }
      if (newStatus === OSStatus.FINALIZADO && !newDataFinalizacaoSQL) newDataFinalizacaoSQL = now;
      else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) newDataFinalizacaoSQL = null;
    }

    let programadoParaSQL: string | null = null;
    if (osData.programadoPara && osData.programadoPara.trim() !== '') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(osData.programadoPara)) {
        const parsedDate = parseISO(osData.programadoPara); 
        if (isValid(parsedDate)) programadoParaSQL = osData.programadoPara;
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
    // created_by_partner_id is set on creation and typically not updated.
    // If it needs to be updatable, add it to the SET clause and values.
    const updateQuery = `
      UPDATE os_table SET
        cliente_id = ?, parceiro_id = ?, projeto = ?, tarefa = ?, observacoes = ?, checklist_json = ?,
        status = ?, programadoPara = ?, isUrgent = ?,
        dataFinalizacao = ?, dataInicioProducao = ?,
        tempoGastoProducaoSegundos = ?, dataInicioProducaoAtual = ?, updated_at = NOW()
      WHERE id = ?`;
    const values = [
      parseInt(client.id, 10), executionPartnerIdSQL, osData.projeto, osData.tarefa,
      osData.observacoes || '', checklistJsonToSave, newStatus,
      programadoParaSQL, osData.isUrgent, newDataFinalizacaoSQL,
      newDataInicioProducaoHistoricoSQL, newTempoGastoProducaoSegundosSQL,
      newDataInicioProducaoAtualSQL, parseInt(osData.id, 10)
    ];
    
    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);
    await connection.commit();

    // Fetch the updated OS along with related names
    const [updatedOSRows] = await connection.query<RowDataPacket[]>(
      `SELECT 
         os.*, 
         c.name as cliente_name, 
         exec_p.name as execution_partner_name,
         creator_p.name as creator_partner_name 
       FROM os_table os
       JOIN clients c ON os.cliente_id = c.id
       LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
       LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
       WHERE os.id = ?`,
      [osData.id]
    );
    if (updatedOSRows.length === 0) {
      throw new Error('Falha ao buscar OS atualizada.');
    }
    const updatedOSRow = updatedOSRows[0];
    let parsedChecklistUpdate: ChecklistItem[] = [];
    if (updatedOSRow.checklist_json) {
      try {
        const rawChecklist = JSON.parse(updatedOSRow.checklist_json);
        if (Array.isArray(rawChecklist)) {
          parsedChecklistUpdate = rawChecklist.map((item, index) => ({
            id: `db-item-${updatedOSRow.id}-${index}`,
            text: item.text || '',
            completed: item.completed || false,
          }));
        }
      } catch (e) {
        console.error(`[OSAction updateOSInDB] Erro ao parsear checklist_json da OS ID ${updatedOSRow.id} após update:`, e);
      }
    }

    const updatedOSForReturn: OS = {
      id: String(updatedOSRow.id),
      numero: updatedOSRow.numero,
      cliente: updatedOSRow.cliente_name,
      parceiro: updatedOSRow.execution_partner_name || undefined,
      clientId: String(updatedOSRow.cliente_id),
      partnerId: updatedOSRow.parceiro_id ? String(updatedOSRow.parceiro_id) : undefined,
      createdByPartnerId: updatedOSRow.created_by_partner_id ? String(updatedOSRow.created_by_partner_id) : undefined,
      createdByPartnerName: updatedOSRow.creator_partner_name || undefined,
      projeto: updatedOSRow.projeto,
      tarefa: updatedOSRow.tarefa,
      observacoes: updatedOSRow.observacoes,
      checklist: parsedChecklistUpdate,
      status: updatedOSRow.status as OSStatus,
      dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
      programadoPara: updatedOSRow.programadoPara ? formatDateFns(parseISO(updatedOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
      isUrgent: Boolean(updatedOSRow.isUrgent),
      dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined,
      dataInicioProducao: updatedOSRow.dataInicioProducao ? new Date(updatedOSRow.dataInicioProducao).toISOString() : undefined,
      tempoGastoProducaoSegundos: updatedOSRow.tempoGastoProducaoSegundos || 0,
      dataInicioProducaoAtual: updatedOSRow.dataInicioProducaoAtual ? new Date(updatedOSRow.dataInicioProducaoAtual).toISOString() : null,
    };
    return updatedOSForReturn;

  } catch (error: any) {
    console.error(`[OSAction updateOSInDB] Erro ao atualizar OS ID ${osData.id}:`, error.message, error.stack);
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}


export async function getAllOSFromDB(): Promise<OS[]> {
  const connection = await db.getConnection();
  try {
    console.log('[OSAction getAllOSFromDB] Buscando todas as OS do banco...');
    const query = `
      SELECT
        os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.checklist_json, os.status,
        os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
        os.dataInicioProducao, os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual,
        os.created_by_partner_id, creator_p.name as creator_partner_name,
        c.name as cliente_name, c.id as cliente_id_val,
        exec_p.name as execution_partner_name, exec_p.id as execution_partner_id_val
      FROM os_table os
      JOIN clients c ON os.cliente_id = c.id
      LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
      LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
      ORDER BY os.isUrgent DESC, os.dataAbertura DESC
    `;
    const [rows] = await connection.query<RowDataPacket[]>(query);
    console.log(`[OSAction getAllOSFromDB] ${rows.length} OSs encontradas.`);
    
    return rows.map(row => {
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
          console.error(`[OSAction getAllOSFromDB] Erro ao parsear checklist_json da OS ID ${row.id}:`, e);
        }
      }

      let dataAberturaISO: string;
      const dataAberturaParsed = new Date(row.dataAbertura);
      if (isValid(dataAberturaParsed)) {
        dataAberturaISO = dataAberturaParsed.toISOString();
      } else {
        console.error(`[OSAction getAllOSFromDB] CRITICAL: Invalid dataAbertura for OS ID ${row.id}: "${row.dataAbertura}". Falling back to epoch.`);
        dataAberturaISO = new Date(0).toISOString(); 
      }

      let dataFinalizacaoISO: string | undefined = undefined;
      if (row.dataFinalizacao) {
        const parsed = new Date(row.dataFinalizacao);
        if (isValid(parsed)) dataFinalizacaoISO = parsed.toISOString();
      }

      let programadoParaFormatted: string | undefined = undefined;
      if (row.programadoPara && typeof row.programadoPara === 'string') {
        const parsed = parseISO(row.programadoPara); 
        if (isValid(parsed)) programadoParaFormatted = formatDateFns(parsed, 'yyyy-MM-dd');
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
        clientId: String(row.cliente_id_val),
        partnerId: row.execution_partner_id_val ? String(row.execution_partner_id_val) : undefined,
        createdByPartnerId: row.created_by_partner_id ? String(row.created_by_partner_id) : undefined,
        createdByPartnerName: row.creator_partner_name || undefined,
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
      };
    });
  } catch (error: any) {
    console.error('[OSAction getAllOSFromDB] Erro original do DB:', error.message, error.stack);
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
      'SELECT * FROM os_table WHERE id = ? FOR UPDATE',
      [osId]
    );
    if (currentOSRows.length === 0) {
      await connection.rollback();
      throw new Error(`OS ID ${osId} não encontrada.`);
    }
    const currentOSFromDB = currentOSRows[0];

    const now = new Date();
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataFinalizacaoSQL: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (newStatus === OSStatus.EM_PRODUCAO) {
      if (!newDataInicioProducaoAtualSQL) { 
        newDataInicioProducaoAtualSQL = now;
        if (!newDataInicioProducaoHistoricoSQL) newDataInicioProducaoHistoricoSQL = now;
      }
    } else { 
      if (newDataInicioProducaoAtualSQL) { 
        newTempoGastoProducaoSegundosSQL = (currentOSFromDB.tempoGastoProducaoSegundos || 0) + differenceInSeconds(now, newDataInicioProducaoAtualSQL);
        newDataInicioProducaoAtualSQL = null;
      }
    }

    if (newStatus === OSStatus.FINALIZADO && !newDataFinalizacaoSQL) {
        newDataFinalizacaoSQL = now;
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
    
    const [result] = await connection.execute<ResultSetHeader>(sql, values);
    await connection.commit();

    if (result.affectedRows > 0 || result.changedRows > 0) {
      const [updatedOSRows] = await connection.query<RowDataPacket[]>(
        `SELECT os.*, c.name as cliente_name, exec_p.name as execution_partner_name, creator_p.name as creator_partner_name
         FROM os_table os
         JOIN clients c ON os.cliente_id = c.id
         LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
         LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
         WHERE os.id = ?`,
        [osId]
      );
      if (updatedOSRows.length === 0) throw new Error('Falha ao buscar OS atualizada.');
      const updatedOSRow = updatedOSRows[0];
      let parsedChecklistStatus: ChecklistItem[] = [];
      if (updatedOSRow.checklist_json) {
        try {
          const rawChecklist = JSON.parse(updatedOSRow.checklist_json);
          if (Array.isArray(rawChecklist)) {
            parsedChecklistStatus = rawChecklist.map((item, index) => ({
              id: `db-item-${updatedOSRow.id}-${index}`,
              text: item.text || '',
              completed: item.completed || false,
            }));
          }
        } catch (e) { console.error(`[OSAction updateOSStatusInDB] Erro parse checklist ${updatedOSRow.id}:`, e); }
      }

      const updatedOS: OS = {
        id: osId,
        numero: updatedOSRow.numero,
        cliente: updatedOSRow.cliente_name,
        parceiro: updatedOSRow.execution_partner_name || undefined,
        clientId: String(updatedOSRow.cliente_id),
        partnerId: updatedOSRow.parceiro_id ? String(updatedOSRow.parceiro_id) : undefined,
        createdByPartnerId: updatedOSRow.created_by_partner_id ? String(updatedOSRow.created_by_partner_id) : undefined,
        createdByPartnerName: updatedOSRow.creator_partner_name || undefined,
        projeto: updatedOSRow.projeto,
        tarefa: updatedOSRow.tarefa,
        observacoes: updatedOSRow.observacoes,
        checklist: parsedChecklistStatus,
        status: newStatus,
        dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
        programadoPara: updatedOSRow.programadoPara ? formatDateFns(parseISO(updatedOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
        isUrgent: Boolean(updatedOSRow.isUrgent),
        dataFinalizacao: newDataFinalizacaoSQL ? newDataFinalizacaoSQL.toISOString() : undefined,
        dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
        tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
        dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
      };
      return updatedOS;
    }
    await connection.rollback(); 
    return null;

  } catch (error: any) {
    console.error(`[OSAction updateOSStatusInDB] Erro OS ID ${osId} para ${newStatus}:`, error.message, error.stack);
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}

export async function toggleOSProductionTimerInDB(osId: string, action: 'play' | 'pause'): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log(`[OSAction toggleTimerInDB] OS ID: ${osId}, Ação: ${action}`);
  try {
    await connection.beginTransaction();
    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM os_table WHERE id = ? FOR UPDATE', [osId]
    );
    if (currentOSRows.length === 0) {
      await connection.rollback();
      throw new Error(`OS ID ${osId} não encontrada.`);
    }
    const currentOSFromDB = currentOSRows[0];

    if (currentOSFromDB.status === OSStatus.FINALIZADO && action === 'play') {
      await connection.rollback(); // No changes needed if finalized and trying to play
       // Re-fetch to return consistent data
      const finalOSRow = currentOSRows[0]; // Use the already fetched row
      let parsedChecklistFinal: ChecklistItem[] = [];
      if (finalOSRow.checklist_json) { try { const r = JSON.parse(finalOSRow.checklist_json); if (Array.isArray(r)) parsedChecklistFinal = r.map((item,idx)=>({id:`db-item-${finalOSRow.id}-${idx}`,text:item.text||'',completed:item.completed||false})); } catch(e){}}
      return {
          id: osId, numero: finalOSRow.numero, cliente: finalOSRow.cliente_name, parceiro: finalOSRow.partner_name || undefined,
          clientId: String(finalOSRow.cliente_id), partnerId: finalOSRow.parceiro_id ? String(finalOSRow.parceiro_id) : undefined,
          createdByPartnerId: finalOSRow.created_by_partner_id ? String(finalOSRow.created_by_partner_id) : undefined,
          createdByPartnerName: finalOSRow.creator_partner_name || undefined,
          projeto: finalOSRow.projeto, tarefa: finalOSRow.tarefa, observacoes: finalOSRow.observacoes,
          checklist: parsedChecklistFinal,
          status: finalOSRow.status as OSStatus,
          dataAbertura: new Date(finalOSRow.dataAbertura).toISOString(),
          programadoPara: finalOSRow.programadoPara ? formatDateFns(parseISO(finalOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
          isUrgent: Boolean(finalOSRow.isUrgent),
          dataFinalizacao: finalOSRow.dataFinalizacao ? new Date(finalOSRow.dataFinalizacao).toISOString() : undefined,
          dataInicioProducao: finalOSRow.dataInicioProducao ? new Date(finalOSRow.dataInicioProducao).toISOString() : undefined,
          tempoGastoProducaoSegundos: finalOSRow.tempoGastoProducaoSegundos || 0,
          dataInicioProducaoAtual: finalOSRow.dataInicioProducaoAtual ? new Date(finalOSRow.dataInicioProducaoAtual).toISOString() : null,
      };
    }

    const now = new Date();
    let newStatus = currentOSFromDB.status as OSStatus;
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (action === 'play') {
      if (!newDataInicioProducaoAtualSQL) {
        newDataInicioProducaoAtualSQL = now;
        newStatus = OSStatus.EM_PRODUCAO;
        if (!newDataInicioProducaoHistoricoSQL) newDataInicioProducaoHistoricoSQL = now;
      } else { // Already playing, no DB change, return current state
          await connection.rollback();
          // Re-fetch could be done here for consistency, or just map currentOSFromDB
          const noChangeOSRow = currentOSFromDB; // Assuming no concurrent changes
          let parsedChecklistNoChange: ChecklistItem[] = [];
          if (noChangeOSRow.checklist_json) { try { const r = JSON.parse(noChangeOSRow.checklist_json); if (Array.isArray(r)) parsedChecklistNoChange = r.map((item,idx)=>({id:`db-item-${noChangeOSRow.id}-${idx}`,text:item.text||'',completed:item.completed||false})); } catch(e){}}
           return {
                id: osId, numero: noChangeOSRow.numero, cliente: noChangeOSRow.cliente_name, parceiro: noChangeOSRow.partner_name || undefined,
                clientId: String(noChangeOSRow.cliente_id), partnerId: noChangeOSRow.parceiro_id ? String(noChangeOSRow.parceiro_id) : undefined,
                createdByPartnerId: noChangeOSRow.created_by_partner_id ? String(noChangeOSRow.created_by_partner_id) : undefined,
                createdByPartnerName: noChangeOSRow.creator_partner_name || undefined,
                projeto: noChangeOSRow.projeto, tarefa: noChangeOSRow.tarefa, observacoes: noChangeOSRow.observacoes,
                checklist: parsedChecklistNoChange, status: noChangeOSRow.status as OSStatus,
                dataAbertura: new Date(noChangeOSRow.dataAbertura).toISOString(),
                programadoPara: noChangeOSRow.programadoPara ? formatDateFns(parseISO(noChangeOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
                isUrgent: Boolean(noChangeOSRow.isUrgent),
                dataFinalizacao: noChangeOSRow.dataFinalizacao ? new Date(noChangeOSRow.dataFinalizacao).toISOString() : undefined,
                dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
                tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
                dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
            };
      }
    } else if (action === 'pause') {
      if (newDataInicioProducaoAtualSQL) {
        newTempoGastoProducaoSegundosSQL = (currentOSFromDB.tempoGastoProducaoSegundos || 0) + differenceInSeconds(now, newDataInicioProducaoAtualSQL);
        newDataInicioProducaoAtualSQL = null;
        if (newStatus === OSStatus.EM_PRODUCAO) newStatus = OSStatus.NA_FILA;
      } else { // Already paused, no DB change
         await connection.rollback();
         const noChangeOSRow = currentOSFromDB;
         let parsedChecklistNoChange: ChecklistItem[] = [];
         if (noChangeOSRow.checklist_json) { try { const r = JSON.parse(noChangeOSRow.checklist_json); if (Array.isArray(r)) parsedChecklistNoChange = r.map((item,idx)=>({id:`db-item-${noChangeOSRow.id}-${idx}`,text:item.text||'',completed:item.completed||false})); } catch(e){}}
         return {
            id: osId, numero: noChangeOSRow.numero, cliente: noChangeOSRow.cliente_name, parceiro: noChangeOSRow.partner_name || undefined,
            clientId: String(noChangeOSRow.cliente_id), partnerId: noChangeOSRow.parceiro_id ? String(noChangeOSRow.parceiro_id) : undefined,
            createdByPartnerId: noChangeOSRow.created_by_partner_id ? String(noChangeOSRow.created_by_partner_id) : undefined,
            createdByPartnerName: noChangeOSRow.creator_partner_name || undefined,
            projeto: noChangeOSRow.projeto, tarefa: noChangeOSRow.tarefa, observacoes: noChangeOSRow.observacoes,
            checklist: parsedChecklistNoChange, status: noChangeOSRow.status as OSStatus,
            dataAbertura: new Date(noChangeOSRow.dataAbertura).toISOString(),
            programadoPara: noChangeOSRow.programadoPara ? formatDateFns(parseISO(noChangeOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(noChangeOSRow.isUrgent),
            dataFinalizacao: noChangeOSRow.dataFinalizacao ? new Date(noChangeOSRow.dataFinalizacao).toISOString() : undefined,
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
         };
      }
    }

    const updateQuery = `UPDATE os_table SET status = ?, tempoGastoProducaoSegundos = ?, dataInicioProducaoAtual = ?, dataInicioProducao = ?, updated_at = NOW() WHERE id = ?`;
    const values = [newStatus, newTempoGastoProducaoSegundosSQL, newDataInicioProducaoAtualSQL, newDataInicioProducaoHistoricoSQL, parseInt(osId, 10)];
    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);
    await connection.commit();

    if (result.affectedRows > 0 || result.changedRows > 0) {
      const [updatedOSRows] = await connection.query<RowDataPacket[]>(
        `SELECT os.*, c.name as cliente_name, exec_p.name as execution_partner_name, creator_p.name as creator_partner_name
         FROM os_table os JOIN clients c ON os.cliente_id = c.id
         LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
         LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
         WHERE os.id = ?`, [osId]
      );
      if (updatedOSRows.length === 0) throw new Error('Falha ao buscar OS atualizada pós-toggle.');
      const updatedOSRow = updatedOSRows[0];
      let parsedChecklistToggle: ChecklistItem[] = [];
      if (updatedOSRow.checklist_json) { try { const r = JSON.parse(updatedOSRow.checklist_json); if (Array.isArray(r)) parsedChecklistToggle = r.map((item,idx)=>({id:`db-item-${updatedOSRow.id}-${idx}`,text:item.text||'',completed:item.completed||false})); } catch(e){}}
      const updatedOS: OS = {
        id: osId, numero: updatedOSRow.numero, cliente: updatedOSRow.cliente_name, parceiro: updatedOSRow.execution_partner_name || undefined,
        clientId: String(updatedOSRow.cliente_id), partnerId: updatedOSRow.parceiro_id ? String(updatedOSRow.parceiro_id) : undefined,
        createdByPartnerId: updatedOSRow.created_by_partner_id ? String(updatedOSRow.created_by_partner_id) : undefined,
        createdByPartnerName: updatedOSRow.creator_partner_name || undefined,
        projeto: updatedOSRow.projeto, tarefa: updatedOSRow.tarefa, observacoes: updatedOSRow.observacoes,
        checklist: parsedChecklistToggle, status: newStatus,
        dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
        programadoPara: updatedOSRow.programadoPara ? formatDateFns(parseISO(updatedOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
        isUrgent: Boolean(updatedOSRow.isUrgent),
        dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined,
        dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
        tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
        dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
      };
      return updatedOS;
    }
    await connection.rollback();
    return null;
  } catch (error: any) {
    console.error(`[OSAction toggleTimerInDB] Erro OS ID ${osId}:`, error.message, error.stack);
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}
