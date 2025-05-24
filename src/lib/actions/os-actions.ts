
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData, OSStatus } from '@/lib/types';
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import { parseISO, differenceInMinutes, isValid as isValidDate } from 'date-fns';

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
        // Assume data.programadoPara is YYYY-MM-DD from date input
        const parsedDate = parseISO(data.programadoPara + "T00:00:00.000Z"); // Treat as UTC midnight
        if (isValidDate(parsedDate)) {
          programadoParaDate = data.programadoPara; // Store as YYYY-MM-DD
        } else {
          console.warn(`[OSAction createOSInDB] String de data programadoPara inválida: "${data.programadoPara}". Definindo como null.`);
        }
      } catch (e) {
        console.warn(`[OSAction createOSInDB] Erro ao parsear programadoPara: "${data.programadoPara}". Definindo como null. Erro:`, e);
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
      status: data.status,
      dataAbertura: new Date(), // DATETIME
      programadoPara: programadoParaDate, // DATE (YYYY-MM-DD)
      isUrgent: data.isUrgent || false,
      dataFinalizacao: null, // DATETIME
      dataInicioProducao: null, // DATETIME
      tempoProducaoMinutos: null, // INT
    };
    console.log('[OSAction createOSInDB] Dados da OS para o DB:', JSON.stringify(osDataForDB, null, 2));

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

    if (!result.insertId) {
      console.error('[OSAction createOSInDB] Falha ao criar OS: insertId é 0. Verifique AUTO_INCREMENT em os_table.id ou outras constraints. Resultado:', result);
      await connection.rollback();
      throw new Error('Falha ao criar OS: Nenhum insertId válido retornado do DB. Verifique se `id` é AUTO_INCREMENT ou se a tabela permite todos os valores fornecidos.');
    }
    console.log(`[OSAction createOSInDB] OS inserida com ID: ${result.insertId}`);
    await connection.commit();
    console.log('[OSAction createOSInDB] Transação commitada.');

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
      dataAbertura: osDataForDB.dataAbertura.toISOString(), // Convert to ISO string for consistency
      programadoPara: programadoParaDate ? programadoParaDate : undefined, // Keep as YYYY-MM-DD string
      isUrgent: data.isUrgent || false,
      dataFinalizacao: undefined,
      dataInicioProducao: undefined,
      tempoProducaoMinutos: undefined,
    };
    console.log('[OSAction createOSInDB] Objeto OS retornado:', JSON.stringify(createdOS, null, 2));
    return createdOS;

  } catch (error: any) {
    console.error('[OSAction createOSInDB] Erro durante a criação da OS. Rollback será tentado.', error.message, error.stack, error.code, error.sqlMessage);
    if (connection) await connection.rollback();
    // Re-throw a more generic error or the specific one if needed by frontend
    throw new Error(`Falha ao criar OS no banco de dados: ${error.message}`);
  } finally {
    if (connection) connection.release();
    console.log('[OSAction createOSInDB] Conexão liberada.');
  }
}


export async function updateOSInDB(osData: OS): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log(`[OSAction updateOSInDB] Iniciando atualização para OS ID: ${osData.id}. Dados recebidos:`, JSON.stringify(osData, null, 2));
  try {
    await connection.beginTransaction();
    console.log(`[OSAction updateOSInDB] Transação iniciada para OS ID: ${osData.id}`);

    const client = await findOrCreateClientByName(osData.cliente, connection);
    if (!client || !client.id) {
      console.error(`[OSAction updateOSInDB] Falha ao obter ID do cliente para: "${osData.cliente}" durante update.`);
      await connection.rollback();
      throw new Error('Falha ao obter ID do cliente para atualização.');
    }
    console.log(`[OSAction updateOSInDB] Cliente resolvido para update: ID ${client.id}, Nome ${client.name}`);

    let partnerIdSQL: number | null = null;
    let partnerNameForReturn: string | undefined = undefined;
    if (osData.parceiro && osData.parceiro.trim() !== '') {
      const partner = await findOrCreatePartnerByName(osData.parceiro, connection);
      if (!partner || !partner.id) {
        console.error(`[OSAction updateOSInDB] Falha ao obter ID do parceiro para: "${osData.parceiro}" durante update.`);
        await connection.rollback();
        throw new Error('Falha ao obter ID do parceiro para atualização.');
      }
      partnerIdSQL = parseInt(partner.id, 10);
      partnerNameForReturn = partner.name;
      console.log(`[OSAction updateOSInDB] Parceiro resolvido para update: ID ${partner.id}, Nome ${partner.name}`);
    }

    let programadoParaSQL: string | null = null;
    if (osData.programadoPara && osData.programadoPara.trim() !== '') {
        try {
            // Input should be YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(osData.programadoPara)) {
                programadoParaSQL = osData.programadoPara;
            } else {
                 console.warn(`[OSAction updateOSInDB] Formato de data programadoPara inválido: "${osData.programadoPara}", esperado YYYY-MM-DD. Será salvo como NULL.`);
            }
        } catch (e) {
            console.warn(`[OSAction updateOSInDB] Erro ao processar programadoPara "${osData.programadoPara}":`, e, "Será salvo como NULL.");
        }
    }
    console.log(`[OSAction updateOSInDB] programadoParaSQL para DB: ${programadoParaSQL}`);

    // Fetch current OS state from DB for date logic
    const [currentOSRows] = await connection.query<RowDataPacket[]>('SELECT status, dataInicioProducao, dataFinalizacao FROM os_table WHERE id = ?', [osData.id]);
    if (currentOSRows.length === 0) {
        console.error(`[OSAction updateOSInDB] OS com ID ${osData.id} não encontrada no banco para atualização.`);
        await connection.rollback();
        throw new Error(`OS com ID ${osData.id} não encontrada para atualização.`);
    }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction updateOSInDB] Estado atual da OS ID ${osData.id} no DB:`, currentOSFromDB);

    let dataInicioProducaoSQL: string | null = osData.dataInicioProducao ? new Date(osData.dataInicioProducao).toISOString() : null;
    let tempoProducaoMinutosSQL: number | null | undefined = osData.tempoProducaoMinutos ?? null;
    let dataFinalizacaoSQL: string | null = osData.dataFinalizacao ? new Date(osData.dataFinalizacao).toISOString() : null;
    const nowISO = new Date().toISOString();

    if (osData.status === OSStatus.EM_PRODUCAO && currentOSFromDB.status !== OSStatus.EM_PRODUCAO && !currentOSFromDB.dataInicioProducao) {
        dataInicioProducaoSQL = nowISO;
        console.log(`[OSAction updateOSInDB] Status mudando para EM_PRODUCAO, definindo dataInicioProducaoSQL: ${dataInicioProducaoSQL}`);
    } else if (dataInicioProducaoSQL === null && currentOSFromDB.dataInicioProducao) {
        // If UI clears it but DB had it, respect clearing or keep DB if it's logic based
        dataInicioProducaoSQL = null; // Assuming if UI sends null/undefined, it means clear
        console.log(`[OSAction updateOSInDB] dataInicioProducaoSQL recebido como null/undefined, setando para null no DB.`);
    }


    if (osData.status === OSStatus.FINALIZADO && currentOSFromDB.status !== OSStatus.FINALIZADO) {
        dataFinalizacaoSQL = nowISO;
        const startProdForCalc = dataInicioProducaoSQL || (currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao).toISOString() : null);
        if (startProdForCalc) {
            try {
                tempoProducaoMinutosSQL = differenceInMinutes(parseISO(dataFinalizacaoSQL), parseISO(startProdForCalc));
                console.log(`[OSAction updateOSInDB] Status mudando para FINALIZADO, dataFinalizacaoSQL: ${dataFinalizacaoSQL}, tempoProducaoMinutosSQL: ${tempoProducaoMinutosSQL}`);
            } catch (e) {
                console.error("[OSAction updateOSInDB] Erro ao calcular tempo de produção na finalização:", e);
                tempoProducaoMinutosSQL = null;
            }
        } else {
            tempoProducaoMinutosSQL = null;
             console.log(`[OSAction updateOSInDB] Status mudando para FINALIZADO, mas sem data de início de produção para calcular tempo. tempoProducaoMinutosSQL: null`);
        }
    } else if (osData.status !== OSStatus.FINALIZADO && currentOSFromDB.status === OSStatus.FINALIZADO) {
        dataFinalizacaoSQL = null;
        tempoProducaoMinutosSQL = null;
        console.log(`[OSAction updateOSInDB] Status saindo de FINALIZADO, resetando dataFinalizacaoSQL e tempoProducaoMinutosSQL para null.`);
    }


    const updateQuery = `
      UPDATE os_table SET
        cliente_id = ?,
        parceiro_id = ?,
        projeto = ?,
        tarefa = ?,
        observacoes = ?,
        tempoTrabalhado = ?,
        status = ?,
        programadoPara = ?,
        isUrgent = ?,
        dataFinalizacao = ?,
        dataInicioProducao = ?,
        tempoProducaoMinutos = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    const values = [
      client.id, // Já é string, mas o driver mysql2 lida com a conversão para INT se necessário
      partnerIdSQL,
      osData.projeto,
      osData.tarefa,
      osData.observacoes || '',
      osData.tempoTrabalhado || null,
      osData.status,
      programadoParaSQL, // YYYY-MM-DD string or null
      osData.isUrgent,
      dataFinalizacaoSQL, // ISO string or null
      dataInicioProducaoSQL, // ISO string or null
      tempoProducaoMinutosSQL,
      osData.id
    ];

    console.log('[OSAction updateOSInDB] Query de Update:', updateQuery.trim().replace(/\s+/g, ' '));
    console.log('[OSAction updateOSInDB] Valores para Update:', JSON.stringify(values, null, 2));

    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);
    console.log('[OSAction updateOSInDB] Resultado da execução do Update:', result);

    if (result.affectedRows === 0) {
      console.warn(`[OSAction updateOSInDB] Nenhuma linha afetada ao atualizar OS ID: ${osData.id}. A OS pode não existir ou os dados são os mesmos.`);
      // Não é necessariamente um erro se os dados forem os mesmos, mas pode ser se o ID não existir.
    }

    await connection.commit();
    console.log(`[OSAction updateOSInDB] Transação commitada para OS ID: ${osData.id}`);

    const updatedOSForReturn: OS = {
        ...osData,
        clientId: client.id,
        cliente: client.name, // Ensure client name is updated from resolved client
        parceiro: partnerNameForReturn, 
        partnerId: partnerIdSQL ? String(partnerIdSQL) : undefined,
        programadoPara: programadoParaSQL ?? undefined, // YYYY-MM-DD string
        dataFinalizacao: dataFinalizacaoSQL ?? undefined, // ISO string
        dataInicioProducao: dataInicioProducaoSQL ?? undefined, // ISO string
        tempoProducaoMinutos: tempoProducaoMinutosSQL === null ? undefined : tempoProducaoMinutosSQL, // number or undefined
    };

    console.log('[OSAction updateOSInDB] OS atualizada retornada para o store:', JSON.stringify(updatedOSForReturn, null, 2));
    return updatedOSForReturn;

  } catch (error: any) {
    console.error(`[OSAction updateOSInDB] Erro ao atualizar OS ID ${osData.id}. Rollback será tentado. Erro:`, error.message, error.stack, error.code, error.sqlMessage);
    if (connection) {
        try {
            await connection.rollback();
            console.log(`[OSAction updateOSInDB] Rollback da transação para OS ID ${osData.id} bem-sucedido.`);
        } catch (rollbackError: any) {
            console.error(`[OSAction updateOSInDB] Erro durante o rollback da transação para OS ID ${osData.id}:`, rollbackError.message);
        }
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
  console.log('[OSAction getAllOSFromDB] Buscando todas as OS do DB...');
  try {
    const [rows] = await connection.query<RowDataPacket[]>(`
      SELECT
        os.id, os.numero, os.projeto, os.tarefa, os.observacoes, os.tempoTrabalhado, os.status,
        os.dataAbertura, os.dataFinalizacao, os.programadoPara, os.isUrgent,
        os.dataInicioProducao, os.tempoProducaoMinutos,
        c.id as clientId, c.name as cliente_name,
        p.id as partnerId, p.name as partner_name,
        os.created_at, os.updated_at
      FROM os_table os
      JOIN clients c ON os.cliente_id = c.id
      LEFT JOIN partners p ON os.parceiro_id = p.id
      ORDER BY os.isUrgent DESC, os.dataAbertura DESC
    `);
    console.log(`[OSAction getAllOSFromDB] Encontradas ${rows.length} OSs.`);
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
      programadoPara: row.programadoPara ? format(new Date(row.programadoPara), 'yyyy-MM-dd') : undefined, // Ensure YYYY-MM-DD
      isUrgent: Boolean(row.isUrgent),
      dataInicioProducao: row.dataInicioProducao ? new Date(row.dataInicioProducao).toISOString() : undefined,
      tempoProducaoMinutos: row.tempoProducaoMinutos === null ? undefined : row.tempoProducaoMinutos,
    }));
  } catch (error: any) {
    console.error('[OSAction getAllOSFromDB] Erro original do DB:', error.message, error.stack, error.code, error.sqlMessage);
    throw new Error(`Falha ao buscar lista de OS do banco: ${error.message}`);
  } finally {
    if (connection) connection.release();
    console.log('[OSAction getAllOSFromDB] Conexão liberada.');
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
  console.log(`[OSAction updateOSStatusInDB] Atualizando OS ID ${osId} para status ${newStatus} com dados:`, JSON.stringify(updateData, null, 2));
  try {
    await connection.beginTransaction();
    console.log(`[OSAction updateOSStatusInDB] Transação iniciada para OS ID: ${osId}`);

    // Fetch current OS state for logic based on previous state
    const [currentOSRows] = await connection.query<RowDataPacket[]>('SELECT status, dataInicioProducao FROM os_table WHERE id = ?', [osId]);
    if (currentOSRows.length === 0) {
        console.error(`[OSAction updateOSStatusInDB] OS com ID ${osId} não encontrada no banco para atualização de status.`);
        await connection.rollback();
        return false;
    }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction updateOSStatusInDB] Estado atual (antes de mudar status) da OS ID ${osId} no DB:`, currentOSFromDB);


    const fieldsToUpdate: string[] = ['status = ?'];
    const values: (string | number | null | boolean)[] = [newStatus];
    const nowISO = new Date().toISOString();

    let finalDataFinalizacao = updateData.dataFinalizacao;
    let finalDataInicioProducao = updateData.dataInicioProducao;
    let finalTempoProducaoMinutos = updateData.tempoProducaoMinutos;

    // If status is changing to EM_PRODUCAO and there's no dataInicioProducao yet
    if (newStatus === OSStatus.EM_PRODUCAO && !currentOSFromDB.dataInicioProducao) {
        finalDataInicioProducao = nowISO;
        console.log(`[OSAction updateOSStatusInDB] Status para EM_PRODUCAO, setando dataInicioProducao: ${finalDataInicioProducao}`);
    }

    // If status is changing to FINALIZADO
    if (newStatus === OSStatus.FINALIZADO) {
        finalDataFinalizacao = nowISO;
        const startProdForCalc = finalDataInicioProducao || (currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao).toISOString() : null);
        if (startProdForCalc) {
            try {
                finalTempoProducaoMinutos = differenceInMinutes(parseISO(finalDataFinalizacao), parseISO(startProdForCalc));
                 console.log(`[OSAction updateOSStatusInDB] Status para FINALIZADO, setando dataFinalizacao: ${finalDataFinalizacao}, tempoProducao: ${finalTempoProducaoMinutos}`);
            } catch (e) {
                console.error("[OSAction updateOSStatusInDB] Erro ao calcular tempo de produção na finalização (updateOSStatusInDB):", e);
                finalTempoProducaoMinutos = null;
            }
        } else {
            finalTempoProducaoMinutos = null;
             console.log(`[OSAction updateOSStatusInDB] Status para FINALIZADO, mas sem data de início de produção para calcular tempo. tempoProducaoMinutos: null`);
        }
    } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) {
        // If OS is being reopened
        finalDataFinalizacao = null;
        finalTempoProducaoMinutos = null;
        console.log(`[OSAction updateOSStatusInDB] OS reaberta (de FINALIZADO para ${newStatus}), resetando dataFinalizacao e tempoProducaoMinutos.`);
    }


    if (finalDataFinalizacao !== undefined) { // Allow null to be set
      fieldsToUpdate.push('dataFinalizacao = ?');
      values.push(finalDataFinalizacao);
    }
    if (finalDataInicioProducao !== undefined) { // Allow null to be set
      fieldsToUpdate.push('dataInicioProducao = ?');
      values.push(finalDataInicioProducao);
    }
    if (finalTempoProducaoMinutos !== undefined) { // Allow null to be set
      fieldsToUpdate.push('tempoProducaoMinutos = ?');
      values.push(finalTempoProducaoMinutos);
    }

    fieldsToUpdate.push('updated_at = NOW()');
    values.push(osId); // For the WHERE clause

    const sql = `UPDATE os_table SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    console.log(`[OSAction updateOSStatusInDB] SQL: ${sql.trim().replace(/\s+/g, ' ')} Valores:`, values);

    const [result] = await connection.execute<ResultSetHeader>(sql, values);

    await connection.commit();
    console.log(`[OSAction updateOSStatusInDB] Status da OS ID ${osId} atualizado para ${newStatus}. Linhas afetadas: ${result.affectedRows}`);
    return result.affectedRows > 0;
  } catch (error: any) {
    console.error(`[OSAction updateOSStatusInDB] Erro ao atualizar status da OS para ID ${osId} para ${newStatus}:`, error.message, error.stack, error.code, error.sqlMessage);
    if (connection) {
        try {
            await connection.rollback();
            console.log(`[OSAction updateOSStatusInDB] Rollback da transação para OS ID ${osId} (mudança de status) bem-sucedido.`);
        } catch (rollbackError: any) {
             console.error(`[OSAction updateOSStatusInDB] Erro durante o rollback da transação para OS ID ${osId} (mudança de status):`, rollbackError.message);
        }
    }
    // Não relance o erro aqui, retorne false para o store tratar
    return false;
  } finally {
    if (connection) connection.release();
     console.log(`[OSAction updateOSStatusInDB] Conexão liberada para OS ID: ${osId}`);
  }
}
