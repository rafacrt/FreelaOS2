
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData, OSStatus } from '@/lib/types'; // OSStatus importado aqui
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import { parseISO, differenceInMinutes, isValid as isValidDate, format as formatDateFns } from 'date-fns';

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
      `INSERT INTO os_table (numero, cliente_id, parceiro_id, projeto, tarefa, observacoes, tempoTrabalhado, status, dataAbertura, programadoPara, isUrgent, dataFinalizacao, dataInicioProducao, tempoProducaoMinutos, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
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
    throw new Error(`Falha ao criar OS no banco de dados: ${error.message || 'Erro desconhecido'}`);
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
        if (/^\d{4}-\d{2}-\d{2}$/.test(osData.programadoPara)) {
          const parsedDate = parseISO(osData.programadoPara + "T00:00:00.000Z");
          if (isValidDate(parsedDate)) {
            programadoParaSQL = osData.programadoPara;
          } else {
            console.warn(`[OSAction updateOSInDB] Formato de data programadoPara inválido (após parse): "${osData.programadoPara}", esperado YYYY-MM-DD. Será salvo como NULL.`);
          }
        } else {
          console.warn(`[OSAction updateOSInDB] Formato de data programadoPara não é YYYY-MM-DD: "${osData.programadoPara}". Tentando parsear como ISO...`);
          const parsedDate = parseISO(osData.programadoPara);
          if (isValidDate(parsedDate)) {
             programadoParaSQL = formatDateFns(parsedDate, 'yyyy-MM-dd');
             console.log(`[OSAction updateOSInDB] Data programadoPara parseada de ISO para YYYY-MM-DD: ${programadoParaSQL}`);
          } else {
            console.warn(`[OSAction updateOSInDB] String de data programadoPara totalmente inválida: "${osData.programadoPara}". Será salvo como NULL.`);
          }
        }
      } catch (e) {
        console.warn(`[OSAction updateOSInDB] Erro ao processar programadoPara "${osData.programadoPara}":`, e, "Será salvo como NULL.");
      }
    }
    console.log(`[OSAction updateOSInDB] programadoParaSQL para DB: ${programadoParaSQL}`);


    const [currentOSRows] = await connection.query<RowDataPacket[]>('SELECT status, dataInicioProducao, dataFinalizacao, tempoProducaoMinutos FROM os_table WHERE id = ?', [osData.id]);
    if (currentOSRows.length === 0) {
      console.error(`[OSAction updateOSInDB] OS com ID ${osData.id} não encontrada no banco para atualização.`);
      await connection.rollback();
      throw new Error(`OS com ID ${osData.id} não encontrada para atualização.`);
    }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction updateOSInDB] Estado atual da OS ID ${osData.id} no DB:`, currentOSFromDB);

    let dataInicioProducaoSQL: string | null = osData.dataInicioProducao ? parseISO(osData.dataInicioProducao).toISOString() : null;
    let tempoProducaoMinutosSQL: number | null | undefined = osData.tempoProducaoMinutos ?? null;
    let dataFinalizacaoSQL: string | null = osData.dataFinalizacao ? parseISO(osData.dataFinalizacao).toISOString() : null;
    const nowISO = new Date().toISOString();

    // Lógica para data de início de produção
    if (osData.status === OSStatus.EM_PRODUCAO && currentOSFromDB.status !== OSStatus.EM_PRODUCAO && !currentOSFromDB.dataInicioProducao) {
      dataInicioProducaoSQL = nowISO;
      console.log(`[OSAction updateOSInDB] Status mudando para EM_PRODUCAO e dataInicioProducao não existe, definindo para: ${dataInicioProducaoSQL}`);
    } else if (osData.status !== OSStatus.EM_PRODUCAO && osData.status !== OSStatus.FINALIZADO && currentOSFromDB.dataInicioProducao && !osData.dataInicioProducao) {
      // Se o usuário explicitamente limpou a data de início e não está finalizado/em produção, não resetamos automaticamente.
      // A UI deve controlar se quer limpar ou não, mas a action respeita o que vem.
      // No entanto, se o status volta para "Na Fila" ou "Aguardando", talvez resetar faça sentido.
      // Para este caso, vamos assumir que se osData.dataInicioProducao é null, ele deve ser null.
      console.log(`[OSAction updateOSInDB] dataInicioProducao está sendo setado para null via osData.`);
    } else if (dataInicioProducaoSQL === null && currentOSFromDB.dataInicioProducao && (osData.status === OSStatus.EM_PRODUCAO || osData.status === OSStatus.FINALIZADO)) {
      // Se a data de início foi limpa na UI, mas o status ainda é EM_PRODUCAO ou FINALIZADO, isso é estranho.
      // Mantemos o que está no banco para não perder o histórico, a menos que a UI explicitamente queira limpar (o que já está coberto por osData.dataInicioProducao ser null).
      dataInicioProducaoSQL = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao).toISOString() : null;
      console.log(`[OSAction updateOSInDB] dataInicioProducao foi limpo na UI, mas status é ${osData.status}. Mantendo valor do DB: ${dataInicioProducaoSQL}`);
    }


    // Lógica para data de finalização e tempo de produção
    if (osData.status === OSStatus.FINALIZADO && currentOSFromDB.status !== OSStatus.FINALIZADO) {
      dataFinalizacaoSQL = nowISO;
      const startProdForCalc = dataInicioProducaoSQL || (currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao).toISOString() : null);
      if (startProdForCalc) {
        try {
          tempoProducaoMinutosSQL = differenceInMinutes(parseISO(dataFinalizacaoSQL), parseISO(startProdForCalc));
          console.log(`[OSAction updateOSInDB] Status mudando para FINALIZADO. Data Finalização: ${dataFinalizacaoSQL}, Tempo Produção: ${tempoProducaoMinutosSQL} min`);
        } catch (e) {
          console.error("[OSAction updateOSInDB] Erro ao calcular tempo de produção na finalização:", e);
          tempoProducaoMinutosSQL = null;
        }
      } else {
        tempoProducaoMinutosSQL = null; // Não pode calcular sem data de início
        console.log(`[OSAction updateOSInDB] Status mudando para FINALIZADO, mas sem data de início de produção para calcular tempo. Tempo Produção: null`);
      }
    } else if (osData.status !== OSStatus.FINALIZADO && currentOSFromDB.status === OSStatus.FINALIZADO) {
      // Se a OS está sendo reaberta (status mudou de FINALIZADO para outro)
      dataFinalizacaoSQL = null;
      tempoProducaoMinutosSQL = null;
      console.log(`[OSAction updateOSInDB] Status saindo de FINALIZADO (reabertura). Resetando dataFinalizacao e tempoProducaoMinutos para null.`);
    } else if (osData.status === OSStatus.FINALIZADO && dataFinalizacaoSQL === null) {
      // Caso o status já seja FINALIZADO na UI, mas dataFinalizacaoSQL é null (veio como null da UI),
      // e DB já tinha uma data, usamos a do DB para não perder. Se DB não tinha, aí sim usamos nowISO.
      dataFinalizacaoSQL = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao).toISOString() : nowISO;
      tempoProducaoMinutosSQL = currentOSFromDB.tempoProducaoMinutos ?? tempoProducaoMinutosSQL; // Mantém o tempo se já existia
      console.log(`[OSAction updateOSInDB] Status já é FINALIZADO, dataFinalizacaoSQL era null, usando valor do DB ou atual: ${dataFinalizacaoSQL}`);
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
      parseInt(client.id, 10),
      partnerIdSQL,
      osData.projeto,
      osData.tarefa,
      osData.observacoes || '',
      osData.tempoTrabalhado || null,
      osData.status,
      programadoParaSQL,
      osData.isUrgent,
      dataFinalizacaoSQL,
      dataInicioProducaoSQL,
      tempoProducaoMinutosSQL,
      parseInt(osData.id, 10)
    ];

    console.log('[OSAction updateOSInDB] Query de Update:', updateQuery.trim().replace(/\s+/g, ' '));
    console.log('[OSAction updateOSInDB] Valores para Update:', JSON.stringify(values, null, 2));

    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);
    console.log('[OSAction updateOSInDB] Resultado da execução do Update:', result);

    if (result.affectedRows === 0) {
      console.warn(`[OSAction updateOSInDB] Nenhuma linha afetada ao atualizar OS ID: ${osData.id}. A OS pode não existir ou os dados são os mesmos.`);
    }

    await connection.commit();
    console.log(`[OSAction updateOSInDB] Transação commitada para OS ID: ${osData.id}`);

    const updatedOSForReturn: OS = {
      ...osData, // Começa com os dados da UI
      clientId: client.id,
      cliente: client.name,
      parceiro: partnerNameForReturn,
      partnerId: partnerIdSQL ? String(partnerIdSQL) : undefined,
      programadoPara: programadoParaSQL ?? undefined, // YYYY-MM-DD string ou undefined
      dataFinalizacao: dataFinalizacaoSQL ?? undefined, // ISO string ou undefined
      dataInicioProducao: dataInicioProducaoSQL ?? undefined, // ISO string ou undefined
      tempoProducaoMinutos: tempoProducaoMinutosSQL === null ? undefined : tempoProducaoMinutosSQL,
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
    const query = `
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
    `;
    // console.log('[OSAction getAllOSFromDB] Executando query:', query);
    const [rows] = await connection.query<RowDataPacket[]>(query);
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
      programadoPara: row.programadoPara ? formatDateFns(new Date(row.programadoPara), 'yyyy-MM-dd') : undefined,
      isUrgent: Boolean(row.isUrgent),
      dataInicioProducao: row.dataInicioProducao ? new Date(row.dataInicioProducao).toISOString() : undefined,
      tempoProducaoMinutos: row.tempoProducaoMinutos === null ? undefined : row.tempoProducaoMinutos,
    }));
  } catch (error: any) {
    console.error('[OSAction getAllOSFromDB] Erro original do DB:', error.message, error.stack, error.code, error.sqlMessage);
    throw new Error(`Falha ao buscar lista de OS do banco: ${error.message || 'Erro desconhecido'}`);
  } finally {
    if (connection) connection.release();
    // console.log('[OSAction getAllOSFromDB] Conexão liberada.');
  }
}

export async function updateOSStatusInDB(
  osId: string,
  newStatus: OSStatus
): Promise<boolean> {
  const connection = await db.getConnection();
  console.log(`[OSAction updateOSStatusInDB] Atualizando OS ID ${osId} para status ${newStatus}`);
  try {
    await connection.beginTransaction();
    console.log(`[OSAction updateOSStatusInDB] Transação iniciada para OS ID: ${osId}`);

    const [currentOSRows] = await connection.query<RowDataPacket[]>('SELECT status, dataInicioProducao, dataFinalizacao, tempoProducaoMinutos FROM os_table WHERE id = ?', [osId]);
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

    let dataFinalizacaoSQL: string | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao).toISOString() : null;
    let dataInicioProducaoSQL: string | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao).toISOString() : null;
    let tempoProducaoMinutosSQL: number | null = currentOSFromDB.tempoProducaoMinutos ?? null;

    if (newStatus === OSStatus.EM_PRODUCAO && currentOSFromDB.status !== OSStatus.EM_PRODUCAO && !dataInicioProducaoSQL) {
      dataInicioProducaoSQL = nowISO;
      console.log(`[OSAction updateOSStatusInDB] Status para EM_PRODUCAO, setando dataInicioProducao: ${dataInicioProducaoSQL}`);
    }

    if (newStatus === OSStatus.FINALIZADO && currentOSFromDB.status !== OSStatus.FINALIZADO) {
      dataFinalizacaoSQL = nowISO;
      const startProdForCalc = dataInicioProducaoSQL; // Se não houve início de produção, não calcula
      if (startProdForCalc) {
        try {
          tempoProducaoMinutosSQL = differenceInMinutes(parseISO(dataFinalizacaoSQL), parseISO(startProdForCalc));
          console.log(`[OSAction updateOSStatusInDB] Status para FINALIZADO, setando dataFinalizacao: ${dataFinalizacaoSQL}, tempoProducao: ${tempoProducaoMinutosSQL}`);
        } catch (e) {
          console.error("[OSAction updateOSStatusInDB] Erro ao calcular tempo de produção na finalização (updateOSStatusInDB):", e);
          tempoProducaoMinutosSQL = null;
        }
      } else {
        tempoProducaoMinutosSQL = null;
        console.log(`[OSAction updateOSStatusInDB] Status para FINALIZADO, mas sem data de início de produção para calcular tempo. tempoProducaoMinutos: null`);
      }
    } else if (newStatus !== OSStatus.FINALIZADO && currentOSFromDB.status === OSStatus.FINALIZADO) {
      dataFinalizacaoSQL = null;
      tempoProducaoMinutosSQL = null;
      console.log(`[OSAction updateOSStatusInDB] OS reaberta (de FINALIZADO para ${newStatus}), resetando dataFinalizacao e tempoProducaoMinutos.`);
    }

    fieldsToUpdate.push('dataFinalizacao = ?');
    values.push(dataFinalizacaoSQL);
    fieldsToUpdate.push('dataInicioProducao = ?');
    values.push(dataInicioProducaoSQL);
    fieldsToUpdate.push('tempoProducaoMinutos = ?');
    values.push(tempoProducaoMinutosSQL);

    fieldsToUpdate.push('updated_at = NOW()');
    values.push(parseInt(osId,10)); // For the WHERE clause

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
    return false;
  } finally {
    if (connection) connection.release();
    console.log(`[OSAction updateOSStatusInDB] Conexão liberada para OS ID: ${osId}`);
  }
}
