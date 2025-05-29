
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData, ChecklistItem } from '@/lib/types';
import { OSStatus, isValidDate } from '@/lib/types';
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import { parseISO, differenceInSeconds, format as formatDateFns, isValid } from 'date-fns';

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
            const parsedDate = parseISO(data.programadoPara + "T00:00:00.000Z"); 
            if (isValidDate(parsedDate)) {
                programadoParaDate = data.programadoPara;
            }
        }
      } catch (e) {
        console.warn(`[OSAction createOSInDB] Erro ao parsear programadoPara: "${data.programadoPara}". Definindo como null. Erro:`, e);
      }
    }

    let checklistJson: string | null = null;
    if (data.checklistItems && data.checklistItems.length > 0) {
        const checklistForDb: Omit<ChecklistItem, 'id'>[] = data.checklistItems
            .map(text => ({ text: text.trim(), completed: false }))
            .filter(item => item.text !== '');
        if (checklistForDb.length > 0) {
            checklistJson = JSON.stringify(checklistForDb);
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
      checklist_json: checklistJson,
      tempoTrabalhado: data.tempoTrabalhado || null,
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
      `INSERT INTO os_table (numero, cliente_id, parceiro_id, projeto, tarefa, observacoes, checklist_json, tempoTrabalhado, status, dataAbertura, programadoPara, isUrgent, dataFinalizacao, dataInicioProducao, tempoGastoProducaoSegundos, dataInicioProducaoAtual, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        osDataForDB.numero, osDataForDB.cliente_id, osDataForDB.parceiro_id, osDataForDB.projeto,
        osDataForDB.tarefa, osDataForDB.observacoes, osDataForDB.checklist_json, osDataForDB.tempoTrabalhado, osDataForDB.status,
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
                    id: `db-item-${createdOSRow.id}-${index}`, // Generate a stable ID
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
      checklist: parsedChecklist.length > 0 ? parsedChecklist : undefined,
      tempoTrabalhado: createdOSRow.tempoTrabalhado,
      status: createdOSRow.status as OSStatus,
      dataAbertura: new Date(createdOSRow.dataAbertura).toISOString(),
      programadoPara: createdOSRow.programadoPara ? formatDateFns(new Date(createdOSRow.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined, 
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
            const parsedDate = parseISO(osData.programadoPara + "T00:00:00.000Z");
            if (isValid(parsedDate)) programadoParaSQL = osData.programadoPara;
        } else { 
            try {
                const parsedDate = parseISO(osData.programadoPara);
                if (isValid(parsedDate)) programadoParaSQL = formatDateFns(parsedDate, 'yyyy-MM-dd');
            } catch (e) { console.warn(`[OSAction updateOSInDB] Erro ao parsear programadoPara ISO "${osData.programadoPara}" para update.`); }
        }
    }
    console.log(`[OSAction updateOSInDB] ProgramadoPara para SQL: ${programadoParaSQL}`);

    let checklistJsonSQL: string | null = null;
    if (osData.checklist && osData.checklist.length > 0) {
        // Strip 'id' for storage, as it's client-side only
        const checklistToStore = osData.checklist.map(item => ({ text: item.text, completed: item.completed }));
        checklistJsonSQL = JSON.stringify(checklistToStore);
    } else if (osData.checklist === undefined || osData.checklist.length === 0) {
        // If checklist is explicitly empty or undefined, store null or an empty array string
        checklistJsonSQL = null; // Or '[]' if you prefer to store an empty array string
    }


    const updateQuery = `
      UPDATE os_table SET
        cliente_id = ?, parceiro_id = ?, projeto = ?, tarefa = ?, observacoes = ?, checklist_json = ?,
        tempoTrabalhado = ?, status = ?, programadoPara = ?, isUrgent = ?,
        dataFinalizacao = ?, dataInicioProducao = ?, 
        tempoGastoProducaoSegundos = ?, dataInicioProducaoAtual = ?, updated_at = NOW()
      WHERE id = ?`;
    const values = [
      parseInt(client.id, 10), partnerIdSQL, osData.projeto, osData.tarefa,
      osData.observacoes || '', checklistJsonSQL, osData.tempoTrabalhado || null, newStatus,
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
      checklist: parsedChecklistUpdate.length > 0 ? parsedChecklistUpdate : undefined,
      tempoTrabalhado: updatedOSRow.tempoTrabalhado,
      status: updatedOSRow.status as OSStatus,
      dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
      programadoPara: updatedOSRow.programadoPara ? formatDateFns(new Date(updatedOSRow.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
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
        os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.checklist_json, os.tempoTrabalhado, os.status,
        os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
        os.dataInicioProducao, os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual
      FROM os_table os
      JOIN clients c ON os.cliente_id = c.id
      LEFT JOIN partners p ON os.parceiro_id = p.id
      ORDER BY os.isUrgent DESC, os.dataAbertura DESC
    `;
    // Adicionado os.created_at, os.updated_at se existirem e forem necessários
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
      return {
        id: String(row.id),
        numero: row.numero,
        cliente: row.cliente_name, // Este campo não está no SELECT, precisa buscar ou já ter. Assumindo que virá do JOIN.
        parceiro: row.partner_name || undefined, // idem
        clientId: String(row.cliente_id), // idem
        partnerId: row.parceiro_id ? String(row.parceiro_id) : undefined, // idem
        projeto: row.projeto,
        tarefa: row.tarefa,
        observacoes: row.observacoes,
        checklist: parsedChecklist.length > 0 ? parsedChecklist : undefined,
        tempoTrabalhado: row.tempoTrabalhado,
        status: row.status as OSStatus,
        dataAbertura: new Date(row.dataAbertura).toISOString(),
        dataFinalizacao: row.dataFinalizacao ? new Date(row.dataFinalizacao).toISOString() : undefined,
        programadoPara: row.programadoPara ? formatDateFns(new Date(row.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined, 
        isUrgent: Boolean(row.isUrgent),
        dataInicioProducao: row.dataInicioProducao ? new Date(row.dataInicioProducao).toISOString() : undefined,
        tempoGastoProducaoSegundos: row.tempoGastoProducaoSegundos || 0,
        dataInicioProducaoAtual: row.dataInicioProducaoAtual ? new Date(row.dataInicioProducaoAtual).toISOString() : null,
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
      if (!newDataInicioProducaoAtualSQL) { 
          newDataInicioProducaoAtualSQL = now;
          if (!newDataInicioProducaoHistoricoSQL) {
              newDataInicioProducaoHistoricoSQL = now;
          }
          console.log(`[OSAction updateOSStatusInDB] Timer iniciado para OS ${osId} devido à mudança para EM_PRODUCAO.`);
      }
    } else { // Mudando para qualquer status que NÃO seja EM_PRODUCAO
      if (newDataInicioProducaoAtualSQL) { // Se estava rodando, pare e acumule
          const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
          newTempoGastoProducaoSegundosSQL = (currentOSFromDB.tempoGastoProducaoSegundos || 0) + secondsElapsed;
          newDataInicioProducaoAtualSQL = null;
          console.log(`[OSAction updateOSStatusInDB] Timer pausado para OS ${osId}. Segundos nesta sessão: ${secondsElapsed}. Total acumulado: ${newTempoGastoProducaoSegundosSQL}`);
      }
    }

    if (newStatus === OSStatus.FINALIZADO) {
        if (!newDataFinalizacaoSQL) { 
            newDataFinalizacaoSQL = now;
            console.log(`[OSAction updateOSStatusInDB] OS ${osId} marcada como FINALIZADO. Data finalização: ${newDataFinalizacaoSQL.toISOString()}`);
        }
    } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) { // Reabrindo uma OS finalizada
      newDataFinalizacaoSQL = null; 
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
            checklist: parsedChecklistStatus.length > 0 ? parsedChecklistStatus : undefined,
            tempoTrabalhado: updatedOSRow.tempoTrabalhado,
            status: newStatus, 
            dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
            programadoPara: updatedOSRow.programadoPara ? formatDateFns(new Date(updatedOSRow.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
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
        return null; 
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
        if (!newDataInicioProducaoHistoricoSQL) { 
             newDataInicioProducaoHistoricoSQL = now;
        }
        console.log(`[OSAction toggleOSProductionTimerInDB] Timer iniciado para OS ${osId}. Novo status: ${newStatus}.`);
      } else {
        console.log(`[OSAction toggleOSProductionTimerInDB] Timer para OS ${osId} já estava rodando. Nenhuma ação tomada.`);
        await connection.rollback(); 
        // Fetch full OS object to return current state
        const [updatedOSRows] = await connection.query<RowDataPacket[]>(
           `SELECT os.*, c.name as cliente_name, p.name as partner_name
            FROM os_table os
            JOIN clients c ON os.cliente_id = c.id
            LEFT JOIN partners p ON os.parceiro_id = p.id
            WHERE os.id = ?`,
            [osId]
        );
        const updatedOSRow = updatedOSRows[0];
         let parsedChecklistTogglePlay: ChecklistItem[] = [];
        if (updatedOSRow.checklist_json) {
            try {
                const rawChecklist = JSON.parse(updatedOSRow.checklist_json);
                 if (Array.isArray(rawChecklist)) {
                    parsedChecklistTogglePlay = rawChecklist.map((item, index) => ({
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
            checklist: parsedChecklistTogglePlay.length > 0 ? parsedChecklistTogglePlay : undefined,
            tempoTrabalhado: updatedOSRow.tempoTrabalhado, status: updatedOSRow.status as OSStatus,
            dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
            programadoPara: updatedOSRow.programadoPara ? formatDateFns(new Date(updatedOSRow.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(updatedOSRow.isUrgent),
            dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined,
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
        };
      }
    } else if (action === 'pause') {
      if (newDataInicioProducaoAtualSQL) { 
        const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
        newTempoGastoProducaoSegundosSQL = (currentOSFromDB.tempoGastoProducaoSegundos || 0) + secondsElapsed;
        newDataInicioProducaoAtualSQL = null;
        console.log(`[OSAction toggleOSProductionTimerInDB] Timer pausado para OS ${osId}. Segundos nesta sessão: ${secondsElapsed}. Total acumulado: ${newTempoGastoProducaoSegundosSQL}. Status permanece: ${newStatus}`);
      } else {
         console.log(`[OSAction toggleOSProductionTimerInDB] Timer para OS ${osId} já estava pausado. Nenhuma ação tomada.`);
         await connection.rollback();
          const [updatedOSRows] = await connection.query<RowDataPacket[]>(
           `SELECT os.*, c.name as cliente_name, p.name as partner_name
            FROM os_table os
            JOIN clients c ON os.cliente_id = c.id
            LEFT JOIN partners p ON os.parceiro_id = p.id
            WHERE os.id = ?`,
            [osId]
        );
        const updatedOSRow = updatedOSRows[0];
        let parsedChecklistTogglePause: ChecklistItem[] = [];
        if (updatedOSRow.checklist_json) {
            try {
                const rawChecklist = JSON.parse(updatedOSRow.checklist_json);
                 if (Array.isArray(rawChecklist)) {
                    parsedChecklistTogglePause = rawChecklist.map((item, index) => ({
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
            checklist: parsedChecklistTogglePause.length > 0 ? parsedChecklistTogglePause : undefined,
            tempoTrabalhado: updatedOSRow.tempoTrabalhado, status: updatedOSRow.status as OSStatus,
            dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
            programadoPara: updatedOSRow.programadoPara ? formatDateFns(new Date(updatedOSRow.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(updatedOSRow.isUrgent),
            dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined,
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
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
            } catch (e) {/* ignore */}
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
            checklist: parsedChecklistToggleFinal.length > 0 ? parsedChecklistToggleFinal : undefined,
            tempoTrabalhado: updatedOSRow.tempoTrabalhado,
            status: newStatus, 
            dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
            programadoPara: updatedOSRow.programadoPara ? formatDateFns(new Date(updatedOSRow.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(updatedOSRow.isUrgent),
            dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined, 
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
        };
        console.log(`[OSAction toggleOSProductionTimerInDB] OS atualizada retornada para o store:`, JSON.stringify(updatedOS, null, 2));
        return updatedOS;
    }
    console.warn(`[OSAction toggleOSProductionTimerInDB] Nenhuma linha alterada para OS ${osId} ao tentar ${action} o timer. Retornando null.`);
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
