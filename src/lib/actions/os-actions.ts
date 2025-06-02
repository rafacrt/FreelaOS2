
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData, ChecklistItem } from '@/lib/types';
import { OSStatus, isValidDate as isValidDateCustomUtil } from '@/lib/types'; // Renamed to avoid conflict with date-fns isValid
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import { parseISO, differenceInSeconds, format as formatDateFns, isValid } from 'date-fns'; // Import isValid from date-fns
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

export async function createOSInDB(data: CreateOSData): Promise<OS | null> {
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
          const parsedDate = parseISO(data.programadoPara + "T00:00:00.000Z"); // Treat as UTC date part
          if (isValid(parsedDate)) { // Use date-fns isValid
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
    console.log('[OSAction createOSInDB] Checklist para DB:', checklistJsonForDB);


    const now = new Date();
    const osDataForDB = {
      numero: newOsNumero,
      cliente_id: parseInt(client.id, 10),
      parceiro_id: partnerId ? parseInt(partnerId, 10) : null,
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
      `INSERT INTO os_table (numero, cliente_id, parceiro_id, projeto, tarefa, observacoes, checklist_json, status, dataAbertura, programadoPara, isUrgent, dataFinalizacao, dataInicioProducao, tempoGastoProducaoSegundos, dataInicioProducaoAtual, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        osDataForDB.numero, osDataForDB.cliente_id, osDataForDB.parceiro_id, osDataForDB.projeto,
        osDataForDB.tarefa, osDataForDB.observacoes, osDataForDB.checklist_json, osDataForDB.status,
        osDataForDB.dataAbertura, osDataForDB.programadoPara, osDataForDB.isUrgent, osDataForDB.dataFinalizacao,
        osDataForDB.dataInicioProducao, osDataForDB.tempoGastoProducaoSegundos,
        osDataForDB.dataInicioProducaoAtual, osDataForDB.created_at, osDataForDB.updated_at
      ]
    );

    if (!result.insertId) {
      console.error('[OSAction createOSInDB] Falha ao criar OS: insertId é 0 ou não foi retornado. Verifique se a coluna `id` é AUTO_INCREMENT na tabela `os_table` ou se há outras restrições no DB.', result);
      await connection.rollback();
      throw new Error('Falha ao criar OS: Nenhum insertId válido retornado do DB. Verifique a configuração da tabela.');
    }
    await connection.commit();
    console.log('[OSAction createOSInDB] OS criada e transação commitada. ID:', result.insertId);

    const [createdOSRows] = await connection.query<RowDataPacket[]>(
      `SELECT os.*, c.name as cliente_name, p.name as partner_name
       FROM os_table os
       JOIN clients c ON os.cliente_id = c.id
       LEFT JOIN partners p ON os.parceiro_id = p.id
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
      parceiro: createdOSRow.partner_name || undefined,
      clientId: String(createdOSRow.cliente_id),
      partnerId: createdOSRow.parceiro_id ? String(createdOSRow.parceiro_id) : undefined,
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
    console.error('[OSAction createOSInDB] Erro durante a criação da OS. Rollback será tentado.', error.message, error.stack, error.code, error.sqlMessage);
    if (connection) await connection.rollback();
    console.error('[OSAction createOSInDB] Rollback da transação bem-sucedido.');
    throw new Error(`Falha ao criar OS no banco de dados: ${error.message || 'Erro desconhecido'}`);
  } finally {
    if (connection) {
      connection.release();
      console.log('[OSAction createOSInDB] Conexão liberada.');
    }
  }
}


export async function updateOSInDB(osData: OS): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log(`[OSAction updateOSInDB] Iniciando atualização para OS ID: ${osData.id}. Dados recebidos:`, JSON.stringify(osData, null, 2));
  try {
    await connection.beginTransaction();
    console.log(`[OSAction updateOSInDB] Transação iniciada para OS ID: ${osData.id}`);

    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM os_table WHERE id = ? FOR UPDATE',
      [osData.id]
    );
    if (currentOSRows.length === 0) {
      await connection.rollback();
      throw new Error(`OS com ID ${osData.id} não encontrada para atualização.`);
    }
    const currentOSFromDB = currentOSRows[0];
    console.log('[OSAction updateOSInDB] Estado atual da OS no DB:', JSON.stringify(currentOSFromDB, null, 2));

    const client = await findOrCreateClientByName(osData.cliente, connection);
    if (!client || !client.id) {
      await connection.rollback();
      throw new Error('Falha ao obter ID do cliente para atualização.');
    }
    let partnerIdSQL: number | null = null;
    if (osData.parceiro && osData.parceiro.trim() !== '') {
      const partner = await findOrCreatePartnerByName(osData.parceiro, connection);
      if (!partner || !partner.id) {
        await connection.rollback();
        throw new Error('Falha ao obter ID do parceiro para atualização.');
      }
      partnerIdSQL = parseInt(partner.id, 10);
    }
    console.log(`[OSAction updateOSInDB] Cliente resolvido: ID ${client.id}. Parceiro ID: ${partnerIdSQL}`);

    const now = new Date();
    let newStatus = osData.status;
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataFinalizacaoSQL: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (newStatus !== currentOSFromDB.status) {
      console.log(`[OSAction updateOSInDB] Status mudou de ${currentOSFromDB.status} para ${newStatus} para OS ID: ${osData.id}`);
      if (newStatus === OSStatus.EM_PRODUCAO) {
        if (!newDataInicioProducaoAtualSQL) {
          newDataInicioProducaoAtualSQL = now;
          if (!newDataInicioProducaoHistoricoSQL) {
            newDataInicioProducaoHistoricoSQL = now;
          }
          console.log(`[OSAction updateOSInDB] Iniciando timer: dataInicioProducaoAtual = ${newDataInicioProducaoAtualSQL?.toISOString()}, dataInicioProducaoHistorico = ${newDataInicioProducaoHistoricoSQL?.toISOString()}`);
        }
      } else {
        if (newDataInicioProducaoAtualSQL) {
          const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
          newTempoGastoProducaoSegundosSQL += secondsElapsed;
          newDataInicioProducaoAtualSQL = null;
          console.log(`[OSAction updateOSInDB] Pausando timer por mudança de status. Segundos acumulados: ${secondsElapsed}. Total agora: ${newTempoGastoProducaoSegundosSQL}`);
        }
      }

      if (newStatus === OSStatus.FINALIZADO) {
        if (!newDataFinalizacaoSQL) newDataFinalizacaoSQL = now;
        console.log(`[OSAction updateOSInDB] OS Finalizada. DataFinalizacao = ${newDataFinalizacaoSQL?.toISOString()}`);
      } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) {
        newDataFinalizacaoSQL = null;
        console.log(`[OSAction updateOSInDB] OS Reaberta. DataFinalizacao removida.`);
      }
    }

    let programadoParaSQL: string | null = null;
    if (osData.programadoPara && osData.programadoPara.trim() !== '') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(osData.programadoPara)) {
        const parsedDate = parseISO(osData.programadoPara); // Directly parse YYYY-MM-DD
        if (isValid(parsedDate)) programadoParaSQL = osData.programadoPara;
      } else {
        try {
          const parsedDate = parseISO(osData.programadoPara);
          if (isValid(parsedDate)) programadoParaSQL = formatDateFns(parsedDate, 'yyyy-MM-dd');
        } catch (e) { console.warn(`[OSAction updateOSInDB] Erro ao parsear programadoPara ISO "${osData.programadoPara}" para update.`); }
      }
    }
    console.log(`[OSAction updateOSInDB] ProgramadoPara para SQL: ${programadoParaSQL}`);

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
    console.log('[OSAction updateOSInDB] Checklist JSON para salvar:', checklistJsonToSave);


    const updateQuery = `
      UPDATE os_table SET
        cliente_id = ?, parceiro_id = ?, projeto = ?, tarefa = ?, observacoes = ?, checklist_json = ?,
        status = ?, programadoPara = ?, isUrgent = ?,
        dataFinalizacao = ?, dataInicioProducao = ?,
        tempoGastoProducaoSegundos = ?, dataInicioProducaoAtual = ?, updated_at = NOW()
      WHERE id = ?`;
    const values = [
      parseInt(client.id, 10), partnerIdSQL, osData.projeto, osData.tarefa,
      osData.observacoes || '', checklistJsonToSave, newStatus,
      programadoParaSQL, osData.isUrgent, newDataFinalizacaoSQL,
      newDataInicioProducaoHistoricoSQL, newTempoGastoProducaoSegundosSQL,
      newDataInicioProducaoAtualSQL, parseInt(osData.id, 10)
    ];
    console.log('[OSAction updateOSInDB] Query de Update SQL:', updateQuery.trim().replace(/\s+/g, ' '));
    console.log('[OSAction updateOSInDB] Valores para Update:', values.map(v => v instanceof Date ? v.toISOString() : v));

    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);
    console.log('[OSAction updateOSInDB] Resultado da execução do Update:', result);

    if (result.affectedRows === 0 && result.changedRows === 0) {
      console.warn(`[OSAction updateOSInDB] Nenhuma linha foi alterada para OS ID: ${osData.id}. Isso pode acontecer se os dados enviados forem idênticos aos existentes ou se o ID não corresponder.`);
    }

    await connection.commit();
    console.log(`[OSAction updateOSInDB] Transação commitada para OS ID: ${osData.id}`);

    const [updatedOSRows] = await connection.query<RowDataPacket[]>(
      `SELECT os.*, c.name as cliente_name, p.name as partner_name
       FROM os_table os
       JOIN clients c ON os.cliente_id = c.id
       LEFT JOIN partners p ON os.parceiro_id = p.id
       WHERE os.id = ?`,
      [osData.id]
    );
    if (updatedOSRows.length === 0) {
      await connection.rollback();
      throw new Error('Falha ao buscar OS atualizada após o update.');
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
      parceiro: updatedOSRow.partner_name || undefined,
      clientId: String(updatedOSRow.cliente_id),
      partnerId: updatedOSRow.parceiro_id ? String(updatedOSRow.parceiro_id) : undefined,
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
    console.log('[OSAction updateOSInDB] OS atualizada retornada para o store:', JSON.stringify(updatedOSForReturn, null, 2));
    return updatedOSForReturn;

  } catch (error: any) {
    console.error(`[OSAction updateOSInDB] Erro ao atualizar OS ID ${osData.id}. Rollback será tentado. Erro:`, error.message, error.stack, error.code, error.sqlMessage);
    if (connection) {
      await connection.rollback();
      console.log(`[OSAction updateOSInDB] Rollback da transação para OS ID ${osData.id} bem-sucedido.`);
    }
    return null;
  } finally {
    if (connection) {
      connection.release();
      console.log(`[OSAction updateOSInDB] Conexão liberada para OS ID: ${osData.id}`);
    }
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
        c.name as cliente_name, c.id as cliente_id_val,
        p.name as partner_name, p.id as partner_id_val
      FROM os_table os
      JOIN clients c ON os.cliente_id = c.id
      LEFT JOIN partners p ON os.parceiro_id = p.id
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
        console.error(`[OSAction getAllOSFromDB] CRITICAL: Invalid dataAbertura for OS ID ${row.id}: "${row.dataAbertura}". Falling back to epoch. THIS INDICATES DATA CORRUPTION.`);
        dataAberturaISO = new Date(0).toISOString(); // Epoch as fallback
      }

      let dataFinalizacaoISO: string | undefined = undefined;
      if (row.dataFinalizacao) {
        const parsed = new Date(row.dataFinalizacao);
        if (isValid(parsed)) {
          dataFinalizacaoISO = parsed.toISOString();
        } else {
          console.warn(`[OSAction getAllOSFromDB] Invalid dataFinalizacao for OS ID ${row.id}: "${row.dataFinalizacao}".`);
        }
      }

      let programadoParaFormatted: string | undefined = undefined;
      if (row.programadoPara && typeof row.programadoPara === 'string') {
        const parsed = parseISO(row.programadoPara); // parseISO for 'YYYY-MM-DD'
        if (isValid(parsed)) {
          programadoParaFormatted = formatDateFns(parsed, 'yyyy-MM-dd');
        } else {
          console.warn(`[OSAction getAllOSFromDB] Invalid programadoPara for OS ID ${row.id}: "${row.programadoPara}".`);
        }
      } else if (row.programadoPara) {
          console.warn(`[OSAction getAllOSFromDB] programadoPara for OS ID ${row.id} is not a string: ${typeof row.programadoPara}, value: "${row.programadoPara}".`);
      }

      let dataInicioProducaoISO: string | undefined = undefined;
      if (row.dataInicioProducao) {
        const parsed = new Date(row.dataInicioProducao);
        if (isValid(parsed)) {
          dataInicioProducaoISO = parsed.toISOString();
        } else {
          console.warn(`[OSAction getAllOSFromDB] Invalid dataInicioProducao for OS ID ${row.id}: "${row.dataInicioProducao}".`);
        }
      }

      let dataInicioProducaoAtualISO: string | null = null;
      if (row.dataInicioProducaoAtual) {
        const parsed = new Date(row.dataInicioProducaoAtual);
        if (isValid(parsed)) {
          dataInicioProducaoAtualISO = parsed.toISOString();
        } else {
          console.warn(`[OSAction getAllOSFromDB] Invalid dataInicioProducaoAtual for OS ID ${row.id}: "${row.dataInicioProducaoAtual}".`);
        }
      }
      
      return {
        id: String(row.id),
        numero: row.numero,
        cliente: row.cliente_name,
        parceiro: row.partner_name || undefined,
        clientId: String(row.cliente_id_val),
        partnerId: row.partner_id_val ? String(row.partner_id_val) : undefined,
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
      'SELECT * FROM os_table WHERE id = ? FOR UPDATE',
      [osId]
    );
    if (currentOSRows.length === 0) {
      await connection.rollback();
      throw new Error(`OS ID ${osId} não encontrada.`);
    }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction updateOSStatusInDB] Estado atual (antes de mudar status) da OS ID ${osId} no DB:`, JSON.stringify(currentOSFromDB, null, 2));

    const now = new Date();
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataFinalizacaoSQL: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (newStatus === OSStatus.EM_PRODUCAO) {
      if (!newDataInicioProducaoAtualSQL) { // Only start if not already running
        newDataInicioProducaoAtualSQL = now;
        if (!newDataInicioProducaoHistoricoSQL) { // Set historical start if it's the very first time
          newDataInicioProducaoHistoricoSQL = now;
        }
        console.log(`[OSAction updateOSStatusInDB] Timer iniciado para OS ${osId} devido à mudança para EM_PRODUCAO.`);
      }
    } else { // If new status is NOT Em Produção
      if (newDataInicioProducaoAtualSQL) { // If it was running, stop it
        const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
        newTempoGastoProducaoSegundosSQL = (currentOSFromDB.tempoGastoProducaoSegundos || 0) + secondsElapsed;
        newDataInicioProducaoAtualSQL = null;
        console.log(`[OSAction updateOSStatusInDB] Timer pausado para OS ${osId}. Segundos nesta sessão: ${secondsElapsed}. Total acumulado: ${newTempoGastoProducaoSegundosSQL}`);
      }
    }

    if (newStatus === OSStatus.FINALIZADO) {
      if (!newDataFinalizacaoSQL) { // Only set if not already finalized
        newDataFinalizacaoSQL = now;
        console.log(`[OSAction updateOSStatusInDB] OS ${osId} marcada como FINALIZADO. Data finalização: ${newDataFinalizacaoSQL.toISOString()}`);
      }
    } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) { // Re-opening a finalized OS
      newDataFinalizacaoSQL = null; // Clear finalization date
      console.log(`[OSAction updateOSStatusInDB] OS ${osId} reaberta (status mudou de FINALIZADO). Data finalização removida.`);
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
    console.log(`[OSAction updateOSStatusInDB] Resultado do update para OS ${osId}:`, result);
    await connection.commit();
    console.log(`[OSAction updateOSStatusInDB] Transação commitada para OS ${osId}.`);

    if (result.affectedRows > 0 || result.changedRows > 0) {
      const [updatedOSRows] = await connection.query<RowDataPacket[]>(
        `SELECT os.*, c.name as cliente_name, p.name as partner_name
         FROM os_table os
         JOIN clients c ON os.cliente_id = c.id
         LEFT JOIN partners p ON os.parceiro_id = p.id
         WHERE os.id = ?`,
        [osId]
      );
      if (updatedOSRows.length === 0) {
        throw new Error('Falha ao buscar OS atualizada após update de status.');
      }
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
        } catch (e) {
          console.error(`[OSAction updateOSStatusInDB] Erro ao parsear checklist_json da OS ID ${updatedOSRow.id} após update de status:`, e);
        }
      }

      const updatedOS: OS = {
        id: osId,
        numero: updatedOSRow.numero,
        cliente: updatedOSRow.cliente_name,
        parceiro: updatedOSRow.partner_name || undefined,
        clientId: String(updatedOSRow.cliente_id),
        partnerId: updatedOSRow.parceiro_id ? String(updatedOSRow.parceiro_id) : undefined,
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
      console.log(`[OSAction updateOSStatusInDB] OS atualizada retornada para o store:`, JSON.stringify(updatedOS, null, 2));
      return updatedOS;
    }
    console.warn(`[OSAction updateOSStatusInDB] Nenhuma linha alterada para OS ${osId} ao tentar mudar status para ${newStatus}. Retornando null.`);
    await connection.rollback(); // Rollback if no changes were made, just in case.
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
      'SELECT * FROM os_table WHERE id = ? FOR UPDATE',
      [osId]
    );
    if (currentOSRows.length === 0) {
      await connection.rollback();
      throw new Error(`OS ID ${osId} não encontrada para toggle.`);
    }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction toggleOSProductionTimerInDB] Estado atual da OS ID ${osId}:`, JSON.stringify(currentOSFromDB, null, 2));

    if (currentOSFromDB.status === OSStatus.FINALIZADO && action === 'play') {
      console.warn(`[OSAction toggleOSProductionTimerInDB] Não é possível iniciar o timer para OS ${osId} pois ela já está FINALIZADA.`);
      await connection.rollback();
       const updatedOSRow = currentOSRows[0];
       let parsedChecklistTogglePlayFinalized: ChecklistItem[] = [];
       if (updatedOSRow.checklist_json) {
            try {
                const rawChecklist = JSON.parse(updatedOSRow.checklist_json);
                 if (Array.isArray(rawChecklist)) {
                    parsedChecklistTogglePlayFinalized = rawChecklist.map((item, index) => ({
                        id: `db-item-${updatedOSRow.id}-${index}`,
                        text: item.text || '',
                        completed: item.completed || false,
                    }));
                }
            } catch (e) {/* ignore */}
        }
        return {
            id: osId, numero: updatedOSRow.numero, cliente: updatedOSRow.cliente_name, parceiro: updatedOSRow.partner_name || undefined,
            clientId: String(updatedOSRow.cliente_id), partnerId: updatedOSRow.parceiro_id ? String(updatedOSRow.parceiro_id) : undefined,
            projeto: updatedOSRow.projeto, tarefa: updatedOSRow.tarefa, observacoes: updatedOSRow.observacoes,
            checklist: parsedChecklistTogglePlayFinalized,
            status: updatedOSRow.status as OSStatus,
            dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
            programadoPara: updatedOSRow.programadoPara ? formatDateFns(parseISO(updatedOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(updatedOSRow.isUrgent),
            dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined,
            dataInicioProducao: updatedOSRow.dataInicioProducao ? new Date(updatedOSRow.dataInicioProducao).toISOString() : undefined,
            tempoGastoProducaoSegundos: updatedOSRow.tempoGastoProducaoSegundos || 0,
            dataInicioProducaoAtual: updatedOSRow.dataInicioProducaoAtual ? new Date(updatedOSRow.dataInicioProducaoAtual).toISOString() : null,
        };
    }

    const now = new Date();
    let newStatus = currentOSFromDB.status as OSStatus;
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (action === 'play') {
      if (!newDataInicioProducaoAtualSQL) { // Only start if not already running
        newDataInicioProducaoAtualSQL = now;
        newStatus = OSStatus.EM_PRODUCAO; // Force status to Em Produção when timer starts
        if (!newDataInicioProducaoHistoricoSQL) { // Set historical start if it's the very first time
          newDataInicioProducaoHistoricoSQL = now;
        }
        console.log(`[OSAction toggleOSProductionTimerInDB] Timer iniciado para OS ${osId}. Novo status: ${newStatus}.`);
      } else {
        console.log(`[OSAction toggleOSProductionTimerInDB] Timer para OS ${osId} já estava rodando. Nenhuma ação tomada no DB, retornando estado atual.`);
        await connection.rollback();
        const updatedOSRow = currentOSRows[0];
        let parsedChecklistTogglePlayRunning: ChecklistItem[] = [];
        if (updatedOSRow.checklist_json) {
            try {
                const rawChecklist = JSON.parse(updatedOSRow.checklist_json);
                 if (Array.isArray(rawChecklist)) {
                    parsedChecklistTogglePlayRunning = rawChecklist.map((item, index) => ({
                        id: `db-item-${updatedOSRow.id}-${index}`,
                        text: item.text || '',
                        completed: item.completed || false,
                    }));
                }
            } catch (e) {/* ignore */}
        }
        return {
            id: osId, numero: updatedOSRow.numero, cliente: updatedOSRow.cliente_name, parceiro: updatedOSRow.partner_name || undefined,
            clientId: String(updatedOSRow.cliente_id), partnerId: updatedOSRow.parceiro_id ? String(updatedOSRow.parceiro_id) : undefined,
            projeto: updatedOSRow.projeto, tarefa: updatedOSRow.tarefa, observacoes: updatedOSRow.observacoes,
            checklist: parsedChecklistTogglePlayRunning,
            status: updatedOSRow.status as OSStatus, // Return current status
            dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
            programadoPara: updatedOSRow.programadoPara ? formatDateFns(parseISO(updatedOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(updatedOSRow.isUrgent),
            dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined,
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined, // May have been updated
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL, // Reflects current accumulated
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null, // Reflects it's running
        };
      }
    } else if (action === 'pause') {
      if (newDataInicioProducaoAtualSQL) { // Only pause if it was running
        const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
        newTempoGastoProducaoSegundosSQL = (currentOSFromDB.tempoGastoProducaoSegundos || 0) + secondsElapsed;
        newDataInicioProducaoAtualSQL = null;
        // When pausing, if the status was "Em Produção", revert to "Na Fila" or a more appropriate "paused" status if desired.
        // For now, let's assume if it was 'Em Produção', and user pauses, it might go to 'Na Fila' or user can manually set.
        // Let's revert to Na Fila if it was Em Produção.
        if (newStatus === OSStatus.EM_PRODUCAO) {
            newStatus = OSStatus.NA_FILA; // Or a new "Pausado" status if you add one
            console.log(`[OSAction toggleOSProductionTimerInDB] Timer pausado para OS ${osId}. Status revertido para ${newStatus}.`);
        } else {
            console.log(`[OSAction toggleOSProductionTimerInDB] Timer pausado para OS ${osId}. Status ${newStatus} mantido.`);
        }
        console.log(`[OSAction toggleOSProductionTimerInDB] Segundos nesta sessão: ${secondsElapsed}. Total acumulado: ${newTempoGastoProducaoSegundosSQL}.`);
      } else {
        console.log(`[OSAction toggleOSProductionTimerInDB] Timer para OS ${osId} já estava pausado. Nenhuma ação tomada no DB, retornando estado atual.`);
        await connection.rollback();
        const updatedOSRow = currentOSRows[0];
         let parsedChecklistTogglePauseAlready: ChecklistItem[] = [];
        if (updatedOSRow.checklist_json) {
            try {
                const rawChecklist = JSON.parse(updatedOSRow.checklist_json);
                 if (Array.isArray(rawChecklist)) {
                    parsedChecklistTogglePauseAlready = rawChecklist.map((item, index) => ({
                        id: `db-item-${updatedOSRow.id}-${index}`,
                        text: item.text || '',
                        completed: item.completed || false,
                    }));
                }
            } catch (e) {/* ignore */}
        }
        return {
            id: osId, numero: updatedOSRow.numero, cliente: updatedOSRow.cliente_name, parceiro: updatedOSRow.partner_name || undefined,
            clientId: String(updatedOSRow.cliente_id), partnerId: updatedOSRow.parceiro_id ? String(updatedOSRow.parceiro_id) : undefined,
            projeto: updatedOSRow.projeto, tarefa: updatedOSRow.tarefa, observacoes: updatedOSRow.observacoes,
            checklist: parsedChecklistTogglePauseAlready,
            status: updatedOSRow.status as OSStatus, // Return current status
            dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
            programadoPara: updatedOSRow.programadoPara ? formatDateFns(parseISO(updatedOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(updatedOSRow.isUrgent),
            dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined,
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL, // Reflects current accumulated
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null, // Reflects it's paused
        };
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

    console.log('[OSAction toggleOSProductionTimerInDB] Query de Update SQL:', updateQuery.trim().replace(/\s+/g, ' '));
    console.log('[OSAction toggleOSProductionTimerInDB] Valores para Update:', values.map(v => v instanceof Date ? v.toISOString() : v));
    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);
    console.log(`[OSAction toggleOSProductionTimerInDB] Resultado do update para OS ${osId}:`, result);

    await connection.commit();
    console.log(`[OSAction toggleOSProductionTimerInDB] Transação commitada para OS ${osId}.`);

    if (result.affectedRows > 0 || result.changedRows > 0) {
      const [updatedOSRows] = await connection.query<RowDataPacket[]>(
        `SELECT os.*, c.name as cliente_name, p.name as partner_name
         FROM os_table os
         JOIN clients c ON os.cliente_id = c.id
         LEFT JOIN partners p ON os.parceiro_id = p.id
         WHERE os.id = ?`,
        [osId]
      );
      if (updatedOSRows.length === 0) {
        throw new Error('Falha ao buscar OS atualizada após toggle do timer.');
      }
      const updatedOSRow = updatedOSRows[0];
      let parsedChecklistToggleFinal: ChecklistItem[] = [];
      if (updatedOSRow.checklist_json) {
        try {
          const rawChecklist = JSON.parse(updatedOSRow.checklist_json);
          if (Array.isArray(rawChecklist)) {
            parsedChecklistToggleFinal = rawChecklist.map((item, index) => ({
              id: `db-item-${updatedOSRow.id}-${index}`,
              text: item.text || '',
              completed: item.completed || false,
            }));
          }
        } catch (e) {/* ignore */ }
      }

      const updatedOS: OS = {
        id: osId,
        numero: updatedOSRow.numero,
        cliente: updatedOSRow.cliente_name,
        parceiro: updatedOSRow.partner_name || undefined,
        clientId: String(updatedOSRow.cliente_id),
        partnerId: updatedOSRow.parceiro_id ? String(updatedOSRow.parceiro_id) : undefined,
        projeto: updatedOSRow.projeto,
        tarefa: updatedOSRow.tarefa,
        observacoes: updatedOSRow.observacoes,
        checklist: parsedChecklistToggleFinal,
        status: newStatus, // Reflect updated status
        dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
        programadoPara: updatedOSRow.programadoPara ? formatDateFns(parseISO(updatedOSRow.programadoPara), 'yyyy-MM-dd') : undefined,
        isUrgent: Boolean(updatedOSRow.isUrgent),
        dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined,
        dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
        tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
        dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
      };
      console.log(`[OSAction toggleOSProductionTimerInDB] OS atualizada retornada para o store:`, JSON.stringify(updatedOS, null, 2));
      return updatedOS;
    }
    console.warn(`[OSAction toggleOSProductionTimerInDB] Nenhuma linha alterada para OS ${osId} ao tentar ${action} o timer. Retornando null após rollback.`);
    await connection.rollback(); // Rollback if no changes were made
    return null;

  } catch (error: any) {
    console.error(`[OSAction toggleOSProductionTimerInDB] Erro ao alternar timer para OS ID ${osId}:`, error.message, error.stack, error.code, error.sqlMessage);
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}

