
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData } from '@/lib/types';
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

    let programadoParaDate: string | null = null; // YYYY-MM-DD format for DB
    if (data.programadoPara && data.programadoPara.trim() !== '') {
      try {
        // Assuming data.programadoPara is already in YYYY-MM-DD from an <input type="date">
        if (/^\d{4}-\d{2}-\d{2}$/.test(data.programadoPara)) {
            const parsedDate = parseISO(data.programadoPara + "T00:00:00.000Z"); // Treat as UTC date part
            if (isValidDate(parsedDate)) {
                programadoParaDate = data.programadoPara; // Store as YYYY-MM-DD
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
      dataAbertura: now, // Store as full DATETIME
      programadoPara: programadoParaDate, // Store as DATE (YYYY-MM-DD)
      isUrgent: data.isUrgent || false,
      dataFinalizacao: null,
      dataInicioProducao: data.status === OSStatus.EM_PRODUCAO ? now : null, // First time production starts
      tempoProducaoMinutos: null, // Deprecated
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
      console.error('[OSAction createOSInDB] Falha ao criar OS: insertId é 0 ou não foi retornado. Verifique se a coluna `id` é AUTO_INCREMENT na tabela `os_table` ou se há outras restrições no DB.', result);
      await connection.rollback();
      throw new Error('Falha ao criar OS: Nenhum insertId válido retornado do DB. Verifique a configuração da tabela.');
    }
    await connection.commit();
    console.log('[OSAction createOSInDB] OS criada e transação commitada. ID:', result.insertId);

    // Fetch the created OS to return the full object including client/partner names
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
      tempoTrabalhado: createdOSRow.tempoTrabalhado,
      status: createdOSRow.status as OSStatus,
      dataAbertura: new Date(createdOSRow.dataAbertura).toISOString(),
      programadoPara: createdOSRow.programadoPara ? formatDateFns(new Date(createdOSRow.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined, // Ensure correct format
      isUrgent: Boolean(createdOSRow.isUrgent),
      dataFinalizacao: createdOSRow.dataFinalizacao ? new Date(createdOSRow.dataFinalizacao).toISOString() : undefined,
      dataInicioProducao: createdOSRow.dataInicioProducao ? new Date(createdOSRow.dataInicioProducao).toISOString() : undefined,
      tempoProducaoMinutos: createdOSRow.tempoProducaoMinutos, // Keep if exists, but prefer seconds
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

    // 1. Fetch current OS state from DB
    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM os_table WHERE id = ? FOR UPDATE', // Lock row for update
      [osData.id]
    );
    if (currentOSRows.length === 0) {
      await connection.rollback();
      throw new Error(`OS com ID ${osData.id} não encontrada para atualização.`);
    }
    const currentOSFromDB = currentOSRows[0];
    console.log('[OSAction updateOSInDB] Estado atual da OS no DB:', JSON.stringify(currentOSFromDB, null, 2));


    // 2. Resolve Client and Partner
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


    // 3. Prepare data for update, including timer logic
    const now = new Date();
    let newStatus = osData.status;
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataFinalizacaoSQL: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    // Logic for status change affecting timer
    if (newStatus !== currentOSFromDB.status) {
      console.log(`[OSAction updateOSInDB] Status mudou de ${currentOSFromDB.status} para ${newStatus} para OS ID: ${osData.id}`);
      if (newStatus === OSStatus.EM_PRODUCAO) {
        if (!newDataInicioProducaoAtualSQL) { // If not already running (e.g., was paused or other status)
          newDataInicioProducaoAtualSQL = now;
          if (!newDataInicioProducaoHistoricoSQL) { // If this is the very first time it enters production
            newDataInicioProducaoHistoricoSQL = now;
          }
          console.log(`[OSAction updateOSInDB] Iniciando timer: dataInicioProducaoAtual = ${newDataInicioProducaoAtualSQL?.toISOString()}, dataInicioProducaoHistorico = ${newDataInicioProducaoHistoricoSQL?.toISOString()}`);
        }
      } else { // Changing to a status other than EM_PRODUCAO
        if (newDataInicioProducaoAtualSQL) { // If it was running, stop it and accumulate time
          const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
          newTempoGastoProducaoSegundosSQL += secondsElapsed;
          newDataInicioProducaoAtualSQL = null;
          console.log(`[OSAction updateOSInDB] Pausando timer por mudança de status. Segundos acumulados: ${secondsElapsed}. Total agora: ${newTempoGastoProducaoSegundosSQL}`);
        }
      }

      if (newStatus === OSStatus.FINALIZADO) {
        if (!newDataFinalizacaoSQL) newDataFinalizacaoSQL = now; // Set finalization date if not already set
        console.log(`[OSAction updateOSInDB] OS Finalizada. DataFinalizacao = ${newDataFinalizacaoSQL?.toISOString()}`);
      } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) {
        newDataFinalizacaoSQL = null; // OS "reopened", clear finalization date
        console.log(`[OSAction updateOSInDB] OS Reaberta. DataFinalizacao removida.`);
      }
    }


    let programadoParaSQL: string | null = null; // YYYY-MM-DD format
    if (osData.programadoPara && osData.programadoPara.trim() !== '') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(osData.programadoPara)) { // Check if it's YYYY-MM-DD
            const parsedDate = parseISO(osData.programadoPara + "T00:00:00.000Z");
            if (isValid(parsedDate)) programadoParaSQL = osData.programadoPara;
        } else { // Try to parse if it's a full ISO string
            try {
                const parsedDate = parseISO(osData.programadoPara);
                if (isValid(parsedDate)) programadoParaSQL = formatDateFns(parsedDate, 'yyyy-MM-dd');
            } catch (e) { console.warn(`[OSAction updateOSInDB] Erro ao parsear programadoPara ISO "${osData.programadoPara}" para update.`); }
        }
    }
    console.log(`[OSAction updateOSInDB] ProgramadoPara para SQL: ${programadoParaSQL}`);

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
    console.log('[OSAction updateOSInDB] Resultado da execução do Update:', result);
    
    if (result.affectedRows === 0 && result.changedRows === 0) {
        console.warn(`[OSAction updateOSInDB] Nenhuma linha foi alterada para OS ID: ${osData.id}. Isso pode acontecer se os dados enviados forem idênticos aos existentes ou se o ID não corresponder.`);
        // Consider if this should be an error or just a warning. If ID is correct, it means no actual change was needed.
    }
    
    await connection.commit();
    console.log(`[OSAction updateOSInDB] Transação commitada para OS ID: ${osData.id}`);

    // Fetch the updated OS to return the full object
    const [updatedOSRows] = await connection.query<RowDataPacket[]>(
       `SELECT os.*, c.name as cliente_name, p.name as partner_name
        FROM os_table os
        JOIN clients c ON os.cliente_id = c.id
        LEFT JOIN partners p ON os.parceiro_id = p.id
        WHERE os.id = ?`,
        [osData.id]
    );
     if (updatedOSRows.length === 0) {
        await connection.rollback(); // Should not happen if update was successful, but as a safeguard
        throw new Error('Falha ao buscar OS atualizada após o update.');
    }
    const updatedOSRow = updatedOSRows[0];

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
      tempoTrabalhado: updatedOSRow.tempoTrabalhado,
      status: updatedOSRow.status as OSStatus,
      dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
      programadoPara: updatedOSRow.programadoPara ? formatDateFns(new Date(updatedOSRow.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
      isUrgent: Boolean(updatedOSRow.isUrgent),
      dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined,
      dataInicioProducao: updatedOSRow.dataInicioProducao ? new Date(updatedOSRow.dataInicioProducao).toISOString() : undefined,
      tempoProducaoMinutos: updatedOSRow.tempoProducaoMinutos,
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
        os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.tempoTrabalhado, os.status,
        os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
        os.dataInicioProducao, os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual,
        c.id as clientId, c.name as cliente_name,
        p.id as partnerId, p.name as partner_name
      FROM os_table os
      JOIN clients c ON os.cliente_id = c.id
      LEFT JOIN partners p ON os.parceiro_id = p.id
      ORDER BY os.isUrgent DESC, os.dataAbertura DESC
    `;
    const [rows] = await connection.query<RowDataPacket[]>(query);
    console.log(`[OSAction getAllOSFromDB] ${rows.length} OSs encontradas.`);
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
      programadoPara: row.programadoPara ? formatDateFns(new Date(row.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined, // Stored as DATE, convert to YYYY-MM-DD
      isUrgent: Boolean(row.isUrgent),
      dataInicioProducao: row.dataInicioProducao ? new Date(row.dataInicioProducao).toISOString() : undefined,
      tempoProducaoMinutos: row.tempoGastoProducaoSegundos ? Math.floor(row.tempoGastoProducaoSegundos / 60) : undefined,
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
    } else { 
      if (newDataInicioProducaoAtualSQL) { 
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
    } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) {
      newDataFinalizacaoSQL = null; // OS "reopened"
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
        // Fetch the full OS object to return
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
            tempoTrabalhado: updatedOSRow.tempoTrabalhado,
            status: newStatus, 
            dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
            programadoPara: updatedOSRow.programadoPara ? formatDateFns(new Date(updatedOSRow.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(updatedOSRow.isUrgent),
            dataFinalizacao: newDataFinalizacaoSQL ? newDataFinalizacaoSQL.toISOString() : undefined,
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
            tempoProducaoMinutos: Math.floor(newTempoGastoProducaoSegundosSQL / 60),
        };
        console.log(`[OSAction updateOSStatusInDB] OS atualizada retornada para o store:`, JSON.stringify(updatedOS, null, 2));
        return updatedOS;
    }
    // Se affectedRows e changedRows forem 0, significa que o status já era o mesmo ou ID não encontrado.
    // Neste caso, é melhor retornar null ou o estado atual sem modificação, dependendo da preferência.
    // Por ora, retornando null se nada mudou, para indicar que a operação de "mudança" não teve efeito.
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
        // Retornar o estado atual sem modificação
        const osAtual: OS = {
            id: osId,
            numero: currentOSFromDB.numero,
            cliente: '', // Precisa buscar nome do cliente
            parceiro: undefined, // Precisa buscar nome do parceiro
            clientId: String(currentOSFromDB.cliente_id),
            partnerId: currentOSFromDB.parceiro_id ? String(currentOSFromDB.parceiro_id) : undefined,
            projeto: currentOSFromDB.projeto,
            tarefa: currentOSFromDB.tarefa,
            observacoes: currentOSFromDB.observacoes,
            tempoTrabalhado: currentOSFromDB.tempoTrabalhado,
            status: currentOSFromDB.status as OSStatus,
            dataAbertura: new Date(currentOSFromDB.dataAbertura).toISOString(),
            programadoPara: currentOSFromDB.programadoPara ? formatDateFns(new Date(currentOSFromDB.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(currentOSFromDB.isUrgent),
            dataFinalizacao: currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao).toISOString() : undefined,
            dataInicioProducao: currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao).toISOString() : undefined,
            tempoGastoProducaoSegundos: currentOSFromDB.tempoGastoProducaoSegundos || 0,
            dataInicioProducaoAtual: currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual).toISOString() : null,
            tempoProducaoMinutos: Math.floor((currentOSFromDB.tempoGastoProducaoSegundos || 0) / 60),
        };
        // Para preencher cliente/parceiro corretamente, precisaríamos de mais uma query aqui ou buscar do store
        // Por simplicidade, retornaremos null indicando que a operação não foi permitida
        return null; 
    }


    const now = new Date();
    let newStatus = currentOSFromDB.status as OSStatus;
    let newDataInicioProducaoAtualSQL = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundosSQL = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataInicioProducaoHistoricoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (action === 'play') {
      if (!newDataInicioProducaoAtualSQL) { // Only start if not already running
        newDataInicioProducaoAtualSQL = now;
        newStatus = OSStatus.EM_PRODUCAO; // Force status to EM_PRODUCAO on play
        if (!newDataInicioProducaoHistoricoSQL) { // If this is the very first time it enters production
             newDataInicioProducaoHistoricoSQL = now;
        }
        console.log(`[OSAction toggleOSProductionTimerInDB] Timer iniciado para OS ${osId}. Novo status: ${newStatus}.`);
      } else {
        console.log(`[OSAction toggleOSProductionTimerInDB] Timer para OS ${osId} já estava rodando. Nenhuma ação tomada.`);
        await connection.rollback(); // Release lock and exit
        // Retornar o estado atual sem modificação
        const [clientRows] = await connection.query<RowDataPacket[]>('SELECT name FROM clients WHERE id = ?', [currentOSFromDB.cliente_id]);
        const clientName = clientRows.length > 0 ? clientRows[0].name : 'Cliente Desconhecido';
        let partnerName: string | undefined = undefined;
        if (currentOSFromDB.parceiro_id) {
            const [partnerRows] = await connection.query<RowDataPacket[]>('SELECT name FROM partners WHERE id = ?', [currentOSFromDB.parceiro_id]);
            partnerName = partnerRows.length > 0 ? partnerRows[0].name : undefined;
        }
        const osAtual: OS = {
            id: osId, numero: currentOSFromDB.numero, cliente: clientName, parceiro: partnerName,
            clientId: String(currentOSFromDB.cliente_id), partnerId: currentOSFromDB.parceiro_id ? String(currentOSFromDB.parceiro_id) : undefined,
            projeto: currentOSFromDB.projeto, tarefa: currentOSFromDB.tarefa, observacoes: currentOSFromDB.observacoes,
            tempoTrabalhado: currentOSFromDB.tempoTrabalhado, status: currentOSFromDB.status as OSStatus,
            dataAbertura: new Date(currentOSFromDB.dataAbertura).toISOString(),
            programadoPara: currentOSFromDB.programadoPara ? formatDateFns(new Date(currentOSFromDB.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(currentOSFromDB.isUrgent),
            dataFinalizacao: currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao).toISOString() : undefined,
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
            tempoProducaoMinutos: Math.floor(newTempoGastoProducaoSegundosSQL / 60),
        };
        return osAtual; // Return current state as no change was made
      }
    } else if (action === 'pause') {
      if (newDataInicioProducaoAtualSQL) { // Only pause if currently running
        const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtualSQL);
        newTempoGastoProducaoSegundosSQL = (currentOSFromDB.tempoGastoProducaoSegundos || 0) + secondsElapsed;
        newDataInicioProducaoAtualSQL = null;
        // Pausing manually does NOT change the status from EM_PRODUCAO.
        // If user wants to change status, they use the dropdown.
        console.log(`[OSAction toggleOSProductionTimerInDB] Timer pausado para OS ${osId}. Segundos nesta sessão: ${secondsElapsed}. Total acumulado: ${newTempoGastoProducaoSegundosSQL}. Status permanece: ${newStatus}`);
      } else {
         console.log(`[OSAction toggleOSProductionTimerInDB] Timer para OS ${osId} já estava pausado. Nenhuma ação tomada.`);
         await connection.rollback(); // Release lock and exit
         // Retornar o estado atual sem modificação (similar ao 'play' quando já rodando)
        const [clientRows] = await connection.query<RowDataPacket[]>('SELECT name FROM clients WHERE id = ?', [currentOSFromDB.cliente_id]);
        const clientName = clientRows.length > 0 ? clientRows[0].name : 'Cliente Desconhecido';
        let partnerName: string | undefined = undefined;
        if (currentOSFromDB.parceiro_id) {
            const [partnerRows] = await connection.query<RowDataPacket[]>('SELECT name FROM partners WHERE id = ?', [currentOSFromDB.parceiro_id]);
            partnerName = partnerRows.length > 0 ? partnerRows[0].name : undefined;
        }
        const osAtual: OS = {
            id: osId, numero: currentOSFromDB.numero, cliente: clientName, parceiro: partnerName,
            clientId: String(currentOSFromDB.cliente_id), partnerId: currentOSFromDB.parceiro_id ? String(currentOSFromDB.parceiro_id) : undefined,
            projeto: currentOSFromDB.projeto, tarefa: currentOSFromDB.tarefa, observacoes: currentOSFromDB.observacoes,
            tempoTrabalhado: currentOSFromDB.tempoTrabalhado, status: currentOSFromDB.status as OSStatus,
            dataAbertura: new Date(currentOSFromDB.dataAbertura).toISOString(),
            programadoPara: currentOSFromDB.programadoPara ? formatDateFns(new Date(currentOSFromDB.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(currentOSFromDB.isUrgent),
            dataFinalizacao: currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao).toISOString() : undefined,
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
            tempoProducaoMinutos: Math.floor(newTempoGastoProducaoSegundosSQL / 60),
        };
        return osAtual;
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
        // Fetch the full OS object to return
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
            tempoTrabalhado: updatedOSRow.tempoTrabalhado,
            status: newStatus, 
            dataAbertura: new Date(updatedOSRow.dataAbertura).toISOString(),
            programadoPara: updatedOSRow.programadoPara ? formatDateFns(new Date(updatedOSRow.programadoPara + 'T00:00:00Z'), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(updatedOSRow.isUrgent),
            dataFinalizacao: updatedOSRow.dataFinalizacao ? new Date(updatedOSRow.dataFinalizacao).toISOString() : undefined, 
            dataInicioProducao: newDataInicioProducaoHistoricoSQL ? newDataInicioProducaoHistoricoSQL.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundosSQL,
            dataInicioProducaoAtual: newDataInicioProducaoAtualSQL ? newDataInicioProducaoAtualSQL.toISOString() : null,
            tempoProducaoMinutos: Math.floor(newTempoGastoProducaoSegundosSQL / 60),
        };
        console.log(`[OSAction toggleOSProductionTimerInDB] OS atualizada retornada para o store:`, JSON.stringify(updatedOS, null, 2));
        return updatedOS;
    }
    // Nenhuma linha afetada, provavelmente o estado já era o desejado (ex: tentar pausar um timer já pausado)
    console.warn(`[OSAction toggleOSProductionTimerInDB] Nenhuma linha alterada para OS ${osId} ao tentar ${action} o timer. Retornando null.`);
    await connection.rollback(); // Não houve mudança efetiva
    return null;

  } catch (error: any) {
    console.error(`[OSAction toggleOSProductionTimerInDB] Erro ao alternar timer para OS ID ${osId}:`, error.message, error.stack, error.code, error.sqlMessage);
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}
