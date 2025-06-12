
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

// Helper function to map a DB row to an OS object
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
      console.error(`[OSAction mapDbRowToOS] Erro ao parsear checklist_json da OS ID ${row.id}:`, e);
    }
  }

  let dataAberturaISO: string;
  const dataAberturaParsed = new Date(row.dataAbertura);
  if (isValid(dataAberturaParsed)) {
    dataAberturaISO = dataAberturaParsed.toISOString();
  } else {
    console.error(`[OSAction mapDbRowToOS] CRITICAL: Invalid dataAbertura for OS ID ${row.id}: "${row.dataAbertura}". Falling back to epoch.`);
    dataAberturaISO = new Date(0).toISOString(); 
  }

  let dataFinalizacaoISO: string | undefined = undefined;
  if (row.dataFinalizacao) {
    const parsed = new Date(row.dataFinalizacao);
    if (isValid(parsed)) dataFinalizacaoISO = parsed.toISOString();
  }

  let programadoParaFormatted: string | undefined = undefined;
  // programadoPara is stored as DATE (YYYY-MM-DD) in DB, needs no time conversion for parseISO
  if (row.programadoPara && typeof row.programadoPara === 'string') {
    // Check if it's already in YYYY-MM-DD format, otherwise parse might fail or give wrong date
     if (/^\d{4}-\d{2}-\d{2}$/.test(row.programadoPara)) {
        const parsed = parseISO(row.programadoPara + "T00:00:00Z"); // Treat as UTC date part
        if (isValid(parsed)) {
            programadoParaFormatted = formatDateFns(parsed, 'yyyy-MM-dd');
        }
    } else { // If it's a full ISO string from old data or incorrect entry
        const parsed = parseISO(row.programadoPara);
        if (isValid(parsed)) {
             programadoParaFormatted = formatDateFns(parsed, 'yyyy-MM-dd');
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
};


export async function createOSInDB(data: CreateOSData, createdByPartnerId?: string): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log('[OSAction createOSInDB] SERVER LOG: Iniciando com dados:', JSON.stringify(data, null, 2), `CreatedByPartnerID: ${createdByPartnerId}`);
  try {
    await connection.beginTransaction();
    console.log('[OSAction createOSInDB] SERVER LOG: Transação iniciada.');

    console.log(`[OSAction createOSInDB] SERVER LOG: Resolvendo cliente: "${data.cliente}"`);
    const client = await findOrCreateClientByName(data.cliente, null, connection);
    if (!client || !client.id) {
      console.error('[OSAction createOSInDB] SERVER LOG: Falha ao obter ID do cliente para:', data.cliente);
      await connection.rollback();
      throw new Error('Falha ao obter ID do cliente.');
    }
    console.log(`[OSAction createOSInDB] SERVER LOG: Cliente resolvido: ID ${client.id}, Nome ${client.name}`);

    let executionPartnerId: string | null = null;
    let executionPartnerIdSQL: number | null = null;
    if (data.parceiro && data.parceiro.trim() !== '') {
      console.log(`[OSAction createOSInDB] SERVER LOG: Resolvendo parceiro de execução: "${data.parceiro}"`);
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
      console.log(`[OSAction createOSInDB] SERVER LOG: Parceiro de execução resolvido: ID ${executionPartnerIdSQL}`);
    } else {
      console.log('[OSAction createOSInDB] SERVER LOG: Nenhum parceiro de execução especificado.');
    }

    const newOsNumero = await generateNewOSNumero(connection);
    console.log(`[OSAction createOSInDB] SERVER LOG: Novo número de OS gerado: ${newOsNumero}`);

    let programadoParaDate: string | null = null;
    if (data.programadoPara && data.programadoPara.trim() !== '') {
      console.log(`[OSAction createOSInDB] SERVER LOG: Processando programadoPara: "${data.programadoPara}"`);
      if (/^\d{4}-\d{2}-\d{2}$/.test(data.programadoPara)) { // Valid YYYY-MM-DD string
          const parsedDate = parseISO(data.programadoPara + "T00:00:00.000Z"); // Add time for UTC interpretation
          if (isValid(parsedDate)) {
            programadoParaDate = data.programadoPara; // Store as YYYY-MM-DD
            console.log(`[OSAction createOSInDB] SERVER LOG: programadoParaDate definido como: ${programadoParaDate}`);
          } else {
            console.warn(`[OSAction createOSInDB] SERVER LOG: programadoPara "${data.programadoPara}" resultou em data inválida após parseISO.`);
          }
      } else {
         console.warn(`[OSAction createOSInDB] SERVER LOG: programadoPara "${data.programadoPara}" não está no formato YYYY-MM-DD.`);
      }
    } else {
        console.log('[OSAction createOSInDB] SERVER LOG: programadoPara não fornecido ou vazio.');
    }


    let checklistJsonForDB: string | null = null;
    if (data.checklistItems && data.checklistItems.length > 0) {
      const checklistToStore: Omit<ChecklistItem, 'id'>[] = data.checklistItems
        .map(text => ({ text: text.trim(), completed: false }))
        .filter(item => item.text !== '');
      if (checklistToStore.length > 0) {
        checklistJsonForDB = JSON.stringify(checklistToStore);
        console.log('[OSAction createOSInDB] SERVER LOG: Checklist JSON para DB:', checklistJsonForDB);
      }
    }

    const now = new Date();
    let initialStatus = data.status || OSStatus.NA_FILA; // Default para Na Fila se admin/parceiro aprovado
    let createdByPartnerIdSQL: number | null = null;

    if (createdByPartnerId) {
        console.log(`[OSAction createOSInDB] SERVER LOG: Processando createdByPartnerId: "${createdByPartnerId}"`);
        const parsedId = parseInt(createdByPartnerId, 10);
        if (!isNaN(parsedId) && parsedId > 0) {
            createdByPartnerIdSQL = parsedId;
            console.log(`[OSAction createOSInDB] SERVER LOG: createdByPartnerIdSQL definido como: ${createdByPartnerIdSQL}`);
            // Verificar se o parceiro criador está aprovado
            const [partnerRows] = await connection.query<RowDataPacket[]>('SELECT is_approved FROM partners WHERE id = ?', [createdByPartnerIdSQL]);
            if (partnerRows.length > 0 && !partnerRows[0].is_approved) {
                initialStatus = OSStatus.AGUARDANDO_APROVACAO;
                console.log(`[OSAction createOSInDB] SERVER LOG: Parceiro criador ID ${createdByPartnerIdSQL} não aprovado. Status inicial definido para AGUARDANDO_APROVACAO.`);
            } else if (partnerRows.length === 0) {
                 console.warn(`[OSAction createOSInDB] SERVER LOG: Parceiro criador ID ${createdByPartnerIdSQL} não encontrado no DB. Status seguirá o default ou o enviado.`);
            } else {
                console.log(`[OSAction createOSInDB] SERVER LOG: Parceiro criador ID ${createdByPartnerIdSQL} está aprovado. Status inicial: ${initialStatus}`);
            }
        } else {
            console.warn(`[OSAction createOSInDB] SERVER LOG: createdByPartnerId "${createdByPartnerId}" não é um número válido ou é <= 0. Será tratado como null. Status seguirá o default ou o enviado.`);
        }
    } else {
        console.log(`[OSAction createOSInDB] SERVER LOG: OS não criada por parceiro (createdByPartnerId nulo). Status inicial: ${initialStatus}`);
    }
    console.log(`[OSAction createOSInDB] SERVER LOG: Status inicial final definido como: ${initialStatus}`);


    const clienteIdSQL = parseInt(client.id, 10);
    if (isNaN(clienteIdSQL)) {
        await connection.rollback();
        throw new Error(`ID do cliente inválido: ${client.id}`);
    }

    const osDataForDB = {
      numero: newOsNumero,
      cliente_id: clienteIdSQL,
      parceiro_id: executionPartnerIdSQL, // Já é number ou null
      created_by_partner_id: createdByPartnerIdSQL, // Já é number ou null
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
    };
    console.log('[OSAction createOSInDB] SERVER LOG: Dados finais da OS para o DB:', JSON.stringify(osDataForDB, null, 2));

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
      console.error('[OSAction createOSInDB] SERVER LOG: Falha ao criar OS: Nenhum insertId válido retornado.');
      await connection.rollback();
      throw new Error('Falha ao criar OS: Nenhum insertId válido retornado.');
    }
    await connection.commit();
    console.log('[OSAction createOSInDB] SERVER LOG: OS criada e transação commitada. ID:', result.insertId);

    const [createdOSRows] = await connection.query<RowDataPacket[]>(
      `SELECT
         os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.checklist_json, os.status,
         os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
         os.dataInicioProducao, os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual,
         os.cliente_id, c.name as cliente_name,
         os.parceiro_id, exec_p.name as execution_partner_name,
         os.created_by_partner_id, creator_p.name as creator_partner_name
       FROM os_table os
       JOIN clients c ON os.cliente_id = c.id
       LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
       LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
       WHERE os.id = ?`,
      [result.insertId]
    );
    if (createdOSRows.length === 0) {
      console.error('[OSAction createOSInDB] SERVER LOG: Falha ao buscar OS recém-criada.');
      throw new Error('Falha ao buscar OS recém-criada.');
    }
    const createdOSForReturn = mapDbRowToOS(createdOSRows[0]);
    console.log('[OSAction createOSInDB] SERVER LOG: OS formatada para retorno:', JSON.stringify(createdOSForReturn, null, 2));
    return createdOSForReturn;

  } catch (error: any) {
    console.error('[OSAction createOSInDB] SERVER LOG: Erro durante a criação da OS:', error.message, error.stack);
    if (connection) {
        console.log('[OSAction createOSInDB] SERVER LOG: Rollback da transação devido a erro.');
        await connection.rollback();
    }
    throw new Error(`Falha ao criar OS no banco: ${error.message || 'Erro desconhecido'}`);
  } finally {
    if (connection) {
        console.log('[OSAction createOSInDB] SERVER LOG: Liberando conexão com o banco.');
        connection.release();
    }
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
      console.log(`[OSAction updateOSInDB] Status mudou de ${currentOSFromDB.status} para ${newStatus} para OS ID: ${osData.id}`);
      if (newStatus === OSStatus.EM_PRODUCAO) {
        if (!newDataInicioProducaoAtualSQL) {
          newDataInicioProducaoAtualSQL = now;
          if (!newDataInicioProducaoHistoricoSQL) newDataInicioProducaoHistoricoSQL = now;
           console.log(`[OSAction updateOSInDB] OS ${osData.id} entrando em produção. dataInicioProducaoAtual: ${newDataInicioProducaoAtualSQL}, dataInicioProducao: ${newDataInicioProducaoHistoricoSQL}`);
        }
      } else { 
        if (newDataInicioProducaoAtualSQL) { 
          const currentSessionSeconds = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
          newTempoGastoProducaoSegundosSQL += currentSessionSeconds;
          console.log(`[OSAction updateOSInDB] OS ${osData.id} saindo de produção. Sessão atual: ${currentSessionSeconds}s. Total: ${newTempoGastoProducaoSegundosSQL}s.`);
          newDataInicioProducaoAtualSQL = null;
        }
      }
      if (newStatus === OSStatus.FINALIZADO && !newDataFinalizacaoSQL) {
        newDataFinalizacaoSQL = now;
        console.log(`[OSAction updateOSInDB] OS ${osData.id} finalizada. dataFinalizacao: ${newDataFinalizacaoSQL}`);
      } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) {
        newDataFinalizacaoSQL = null; 
        console.log(`[OSAction updateOSInDB] OS ${osData.id} reaberta. dataFinalizacao removida.`);
      }
    }


    let programadoParaSQL: string | null = null;
    if (osData.programadoPara && osData.programadoPara.trim() !== '') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(osData.programadoPara)) {
        const parsedDate = parseISO(osData.programadoPara);
        if (isValid(parsedDate)) {
             programadoParaSQL = osData.programadoPara; // Armazena como YYYY-MM-DD
        } else {
            console.warn(`[OSAction updateOSInDB] programadoPara "${osData.programadoPara}" resultou em data inválida após parseISO para OS ID ${osData.id}.`)
        }
      } else {
          console.warn(`[OSAction updateOSInDB] programadoPara "${osData.programadoPara}" não está no formato YYYY-MM-DD para OS ID ${osData.id}.`)
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
    console.log(`[OSAction updateOSInDB] Checklist para OS ID ${osData.id}: ${checklistJsonToSave}`);

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
    console.log(`[OSAction updateOSInDB] Executando query de atualização para OS ID ${osData.id} com valores:`, JSON.stringify(values, null, 2).substring(0, 500) + "...");


    await connection.execute<ResultSetHeader>(updateQuery, values);
    await connection.commit();
    console.log(`[OSAction updateOSInDB] OS ID ${osData.id} atualizada e transação commitada.`);


    const [updatedOSRows] = await connection.query<RowDataPacket[]>(
      `SELECT
         os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.checklist_json, os.status,
         os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
         os.dataInicioProducao, os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual,
         os.cliente_id, c.name as cliente_name,
         os.parceiro_id, exec_p.name as execution_partner_name,
         os.created_by_partner_id, creator_p.name as creator_partner_name
       FROM os_table os
       JOIN clients c ON os.cliente_id = c.id
       LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
       LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
       WHERE os.id = ?`,
      [osData.id]
    );
    if (updatedOSRows.length === 0) {
      console.error(`[OSAction updateOSInDB] Falha ao buscar OS ID ${osData.id} após atualização.`);
      throw new Error('Falha ao buscar OS atualizada.');
    }
    const updatedOSForReturn = mapDbRowToOS(updatedOSRows[0]);
    console.log(`[OSAction updateOSInDB] OS ID ${osData.id} formatada para retorno:`, JSON.stringify(updatedOSForReturn, null, 2));
    return updatedOSForReturn;

  } catch (error: any) {
    console.error(`[OSAction updateOSInDB] Erro ao atualizar OS ID ${osData.id}:`, error.message, error.stack);
    if (connection) {
        console.log(`[OSAction updateOSInDB] Rollback da transação para OS ID ${osData.id} devido a erro.`);
        await connection.rollback();
    }
    return null; 
  } finally {
    if (connection) {
        console.log(`[OSAction updateOSInDB] Liberando conexão com o banco para OS ID ${osData.id}.`);
        connection.release();
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
        os.cliente_id, c.name as cliente_name,
        os.parceiro_id, exec_p.name as execution_partner_name,
        os.created_by_partner_id, creator_p.name as creator_partner_name
      FROM os_table os
      JOIN clients c ON os.cliente_id = c.id
      LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
      LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
      ORDER BY os.isUrgent DESC, 
               CASE os.status 
                 WHEN '${OSStatus.AGUARDANDO_APROVACAO}' THEN 1
                 WHEN '${OSStatus.RECUSADA}' THEN 3
                 ELSE 2 
               END, 
               os.dataAbertura DESC
    `;
    const [rows] = await connection.query<RowDataPacket[]>(query);
    console.log(`[OSAction getAllOSFromDB] ${rows.length} OSs encontradas.`);

    return rows.map(mapDbRowToOS);
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

    await connection.execute<ResultSetHeader>(sql, values);
    await connection.commit();

    const [updatedOSRows] = await connection.query<RowDataPacket[]>(
        `SELECT
           os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.checklist_json, os.status,
           os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
           os.dataInicioProducao, os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual,
           os.cliente_id, c.name as cliente_name,
           os.parceiro_id, exec_p.name as execution_partner_name,
           os.created_by_partner_id, creator_p.name as creator_partner_name
         FROM os_table os
         JOIN clients c ON os.cliente_id = c.id
         LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
         LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
         WHERE os.id = ?`,
        [osId]
    );
    if (updatedOSRows.length === 0) throw new Error('Falha ao buscar OS atualizada após mudança de status.');
    return mapDbRowToOS(updatedOSRows[0]);

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
      `SELECT
         os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.checklist_json, os.status,
         os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
         os.dataInicioProducao, os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual,
         os.cliente_id, c.name as cliente_name,
         os.parceiro_id, exec_p.name as execution_partner_name,
         os.created_by_partner_id, creator_p.name as creator_partner_name
       FROM os_table os
       JOIN clients c ON os.cliente_id = c.id
       LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
       LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
       WHERE os.id = ? FOR UPDATE`, [osId]
    );
    if (currentOSRows.length === 0) {
      await connection.rollback();
      throw new Error(`OS ID ${osId} não encontrada.`);
    }
    const currentOSFromDB = currentOSRows[0];

    if ((currentOSFromDB.status === OSStatus.FINALIZADO || currentOSFromDB.status === OSStatus.AGUARDANDO_APROVACAO || currentOSFromDB.status === OSStatus.RECUSADA) && action === 'play') {
      await connection.rollback(); 
      console.warn(`[OSAction toggleTimerInDB] Tentativa de iniciar timer para OS ${osId} com status ${currentOSFromDB.status}. Ação não permitida.`);
      return mapDbRowToOS(currentOSFromDB);
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
      } else {
          console.warn(`[OSAction toggleTimerInDB] Tentativa de iniciar timer para OS ${osId} que já está rodando.`);
          await connection.rollback(); 
          return mapDbRowToOS(currentOSFromDB); 
      }
    } else if (action === 'pause') {
      if (newDataInicioProducaoAtualSQL) { 
        newTempoGastoProducaoSegundosSQL = (currentOSFromDB.tempoGastoProducaoSegundos || 0) + differenceInSeconds(now, newDataInicioProducaoAtualSQL);
        newDataInicioProducaoAtualSQL = null;
        if (newStatus === OSStatus.EM_PRODUCAO) newStatus = OSStatus.NA_FILA; 
      } else {
         console.warn(`[OSAction toggleTimerInDB] Tentativa de pausar timer para OS ${osId} que não está rodando.`);
         await connection.rollback(); 
         return mapDbRowToOS(currentOSFromDB); 
      }
    }

    const updateQuery = `UPDATE os_table SET status = ?, tempoGastoProducaoSegundos = ?, dataInicioProducaoAtual = ?, dataInicioProducao = ?, updated_at = NOW() WHERE id = ?`;
    const values = [newStatus, newTempoGastoProducaoSegundosSQL, newDataInicioProducaoAtualSQL, newDataInicioProducaoHistoricoSQL, parseInt(osId, 10)];
    await connection.execute<ResultSetHeader>(updateQuery, values);
    await connection.commit();

    const [updatedOSRowsAgain] = await connection.query<RowDataPacket[]>(
        `SELECT
           os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.checklist_json, os.status,
           os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
           os.dataInicioProducao, os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual,
           os.cliente_id, c.name as cliente_name,
           os.parceiro_id, exec_p.name as execution_partner_name,
           os.created_by_partner_id, creator_p.name as creator_partner_name
         FROM os_table os
         JOIN clients c ON os.cliente_id = c.id
         LEFT JOIN partners exec_p ON os.parceiro_id = exec_p.id
         LEFT JOIN partners creator_p ON os.created_by_partner_id = creator_p.id
         WHERE os.id = ?`, [osId]
      );
    if (updatedOSRowsAgain.length === 0) throw new Error('Falha ao buscar OS atualizada pós-toggle do timer.');
    return mapDbRowToOS(updatedOSRowsAgain[0]);

  } catch (error: any) {
    console.error(`[OSAction toggleTimerInDB] Erro OS ID ${osId}:`, error.message, error.stack);
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}

