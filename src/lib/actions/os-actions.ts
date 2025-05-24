
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData } from '@/lib/types';
import { OSStatus } from '@/lib/types'; // <--- ADICIONADA A IMPORTAÇÃO CORRETA
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
        const parsedDate = parseISO(data.programadoPara + "T00:00:00.000Z");
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
      dataAbertura: new Date(),
      programadoPara: programadoParaDate,
      isUrgent: data.isUrgent || false,
      dataFinalizacao: null,
      dataInicioProducao: null,
      tempoProducaoMinutos: null,
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
      dataAbertura: osDataForDB.dataAbertura.toISOString(),
      programadoPara: programadoParaDate ? programadoParaDate : undefined,
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
    } else {
      console.log(`[OSAction updateOSInDB] Nome do parceiro está vazio ou não fornecido, será salvo como NULL no DB.`);
    }

    let programadoParaSQL: string | null = null;
    if (osData.programadoPara && osData.programadoPara.trim() !== '') {
        try {
            // Espera-se YYYY-MM-DD do input date
            if (/^\d{4}-\d{2}-\d{2}$/.test(osData.programadoPara)) {
                const parsedDate = parseISO(osData.programadoPara + "T00:00:00.000Z"); // Adiciona Z para tratar como UTC
                if (isValidDate(parsedDate)) {
                    programadoParaSQL = osData.programadoPara; // Mantém YYYY-MM-DD
                } else {
                    console.warn(`[OSAction updateOSInDB] Data programadoPara inválida (após parse): "${osData.programadoPara}", esperado YYYY-MM-DD. Será salvo como NULL.`);
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


    const [currentOSRows] = await connection.query<RowDataPacket[]>('SELECT status, dataAbertura, dataInicioProducao, dataFinalizacao, tempoProducaoMinutos FROM os_table WHERE id = ?', [osData.id]);
    if (currentOSRows.length === 0) {
      console.error(`[OSAction updateOSInDB] OS com ID ${osData.id} não encontrada no banco para atualização.`);
      await connection.rollback();
      throw new Error(`OS com ID ${osData.id} não encontrada para atualização.`);
    }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction updateOSInDB] Estado atual da OS ID ${osData.id} no DB:`, currentOSFromDB);

    let dataInicioProducaoSQL: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;
    let dataFinalizacaoSQL: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let tempoProducaoMinutosSQL: number | null | undefined = currentOSFromDB.tempoProducaoMinutos ?? null;
    const now = new Date();

    // Lógica para data de início de produção
    if (osData.status === OSStatus.EM_PRODUCAO && currentOSFromDB.status !== OSStatus.EM_PRODUCAO && !dataInicioProducaoSQL) {
      dataInicioProducaoSQL = now;
      console.log(`[OSAction updateOSInDB] Status mudando para EM_PRODUCAO e dataInicioProducao não existe, definindo para: ${dataInicioProducaoSQL.toISOString()}`);
    } else if (osData.status !== OSStatus.EM_PRODUCAO && osData.status !== OSStatus.FINALIZADO && dataInicioProducaoSQL && osData.status !== currentOSFromDB.status) {
      // Se saiu de EM_PRODUCAO/FINALIZADO para um estado anterior, e tinha data de início, mantemos por enquanto,
      // mas não calculamos tempo de produção se for finalizado novamente sem passar por EM_PRODUCAO.
      // Se o status foi explicitamente mudado para algo ANTES de "Em Produção", faz sentido limpar dataInicioProducaoSQL?
      // Por ora, vamos manter dataInicioProducaoSQL se já existia, a menos que o novo status seja anterior a "Em Produção".
      // Esta lógica pode precisar de mais refinamento com base nas regras de negócio.
      // Se o novo status é NA_FILA ou AGUARDANDO_CLIENTE/PARCEIRO, e antes estava EM_PRODUCAO ou FINALIZADO, resetamos.
      if ([OSStatus.NA_FILA, OSStatus.AGUARDANDO_CLIENTE, OSStatus.AGUARDANDO_PARCEIRO].includes(osData.status as OSStatus)) {
        console.log(`[OSAction updateOSInDB] OS ${osData.id} voltando para status anterior a EM_PRODUCAO. Resetando dataInicioProducao, dataFinalizacao e tempoProducaoMinutos.`);
        dataInicioProducaoSQL = null;
        dataFinalizacaoSQL = null;
        tempoProducaoMinutosSQL = null;
      }
    }

    // Lógica para data de finalização e tempo de produção
    if (osData.status === OSStatus.FINALIZADO && currentOSFromDB.status !== OSStatus.FINALIZADO) {
      dataFinalizacaoSQL = now;
      if (dataInicioProducaoSQL) {
        try {
          tempoProducaoMinutosSQL = differenceInMinutes(dataFinalizacaoSQL, dataInicioProducaoSQL);
          console.log(`[OSAction updateOSInDB] Status mudando para FINALIZADO. Data Finalização: ${dataFinalizacaoSQL.toISOString()}, Tempo Produção: ${tempoProducaoMinutosSQL} min`);
        } catch (e) {
          console.error("[OSAction updateOSInDB] Erro ao calcular tempo de produção na finalização:", e);
          tempoProducaoMinutosSQL = null;
        }
      } else {
        tempoProducaoMinutosSQL = null;
        console.log(`[OSAction updateOSInDB] Status mudando para FINALIZADO, mas sem data de início de produção para calcular tempo. Tempo Produção: null`);
      }
    } else if (osData.status !== OSStatus.FINALIZADO && currentOSFromDB.status === OSStatus.FINALIZADO) {
      // Se a OS está sendo reaberta (status mudou de FINALIZADO para outro)
      dataFinalizacaoSQL = null;
      // Mantemos o tempoProducaoMinutos anterior se quisermos um histórico, ou resetamos se a reabertura "zera" o tempo.
      // Para simplificar, vamos resetar.
      tempoProducaoMinutosSQL = null;
      console.log(`[OSAction updateOSInDB] Status saindo de FINALIZADO (reabertura). Resetando dataFinalizacao e tempoProducaoMinutos para null.`);
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
      programadoParaSQL, // YYYY-MM-DD string or null
      osData.isUrgent,
      dataFinalizacaoSQL, // Date object or null
      dataInicioProducaoSQL, // Date object or null
      tempoProducaoMinutosSQL,
      parseInt(osData.id, 10)
    ];

    console.log('[OSAction updateOSInDB] Query de Update:', updateQuery.trim().replace(/\s+/g, ' '));
    console.log('[OSAction updateOSInDB] Valores para Update (datas como objetos Date ou null):', values.map(v => v instanceof Date ? v.toISOString() : v));

    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);
    console.log('[OSAction updateOSInDB] Resultado da execução do Update:', result);

    if (result.affectedRows === 0) {
      console.warn(`[OSAction updateOSInDB] Nenhuma linha afetada ao atualizar OS ID: ${osData.id}. A OS pode não existir ou os dados são os mesmos.`);
    }

    await connection.commit();
    console.log(`[OSAction updateOSInDB] Transação commitada para OS ID: ${osData.id}`);

    const updatedOSForReturn: OS = {
      ...osData,
      clientId: client.id,
      cliente: client.name,
      parceiro: partnerNameForReturn,
      partnerId: partnerIdSQL ? String(partnerIdSQL) : undefined,
      programadoPara: programadoParaSQL ?? undefined,
      dataAbertura: currentOSFromDB.dataAbertura ? new Date(currentOSFromDB.dataAbertura).toISOString() : new Date().toISOString(), // Manter data de abertura original
      dataFinalizacao: dataFinalizacaoSQL ? dataFinalizacaoSQL.toISOString() : undefined,
      dataInicioProducao: dataInicioProducaoSQL ? dataInicioProducaoSQL.toISOString() : undefined,
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
  newStatus: OSStatus,
  // Adicionamos os campos de data calculados para consistência, embora o DB possa ter triggers
  updatePayload: {
    dataFinalizacao?: string | null; // ISO string
    dataInicioProducao?: string | null; // ISO string
    tempoProducaoMinutos?: number | null;
  }
): Promise<boolean> {
  const connection = await db.getConnection();
  console.log(`[OSAction updateOSStatusInDB] Atualizando OS ID ${osId} para status ${newStatus} com payload:`, updatePayload);
  try {
    await connection.beginTransaction();
    console.log(`[OSAction updateOSStatusInDB] Transação iniciada para OS ID: ${osId}`);

    // Pega o estado atual da OS do banco para tomar decisões sobre as datas.
    const [currentOSRows] = await connection.query<RowDataPacket[]>('SELECT status, dataInicioProducao, dataFinalizacao, tempoProducaoMinutos FROM os_table WHERE id = ?', [osId]);
    if (currentOSRows.length === 0) {
      console.error(`[OSAction updateOSStatusInDB] OS com ID ${osId} não encontrada no banco para atualização de status.`);
      await connection.rollback();
      return false;
    }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction updateOSStatusInDB] Estado atual (antes de mudar status) da OS ID ${osId} no DB:`, currentOSFromDB);

    const now = new Date();
    let finalDataInicioProducao: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;
    let finalDataFinalizacao: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let finalTempoProducaoMinutos: number | null = currentOSFromDB.tempoProducaoMinutos ?? null;

    if (newStatus === OSStatus.EM_PRODUCAO && currentOSFromDB.status !== OSStatus.EM_PRODUCAO && !finalDataInicioProducao) {
        finalDataInicioProducao = now;
        console.log(`[OSAction updateOSStatusInDB] Status para EM_PRODUCAO, setando dataInicioProducao para: ${finalDataInicioProducao.toISOString()}`);
    }

    if (newStatus === OSStatus.FINALIZADO && currentOSFromDB.status !== OSStatus.FINALIZADO) {
        finalDataFinalizacao = now;
        console.log(`[OSAction updateOSStatusInDB] Status para FINALIZADO, setando dataFinalizacao para: ${finalDataFinalizacao.toISOString()}`);
        if (finalDataInicioProducao) {
            try {
                finalTempoProducaoMinutos = differenceInMinutes(finalDataFinalizacao, finalDataInicioProducao);
                console.log(`[OSAction updateOSStatusInDB] Calculado tempoProducaoMinutos: ${finalTempoProducaoMinutos}`);
            } catch (e) {
                console.error("[OSAction updateOSStatusInDB] Erro ao calcular differenceInMinutes:", e);
                finalTempoProducaoMinutos = null;
            }
        } else {
            console.log("[OSAction updateOSStatusInDB] Não foi possível calcular tempoProducaoMinutos pois dataInicioProducao não está definida.");
            finalTempoProducaoMinutos = null;
        }
    } else if (newStatus !== OSStatus.FINALIZADO && currentOSFromDB.status === OSStatus.FINALIZADO) {
        // OS Reaberta
        finalDataFinalizacao = null;
        finalTempoProducaoMinutos = null; // Resetar tempo se reaberto
        console.log("[OSAction updateOSStatusInDB] OS reaberta, resetando dataFinalizacao e tempoProducaoMinutos.");
    }


    const sql = `
      UPDATE os_table SET
        status = ?,
        dataFinalizacao = ?,
        dataInicioProducao = ?,
        tempoProducaoMinutos = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    const values = [
      newStatus,
      finalDataFinalizacao,
      finalDataInicioProducao,
      finalTempoProducaoMinutos,
      parseInt(osId, 10)
    ];
    console.log(`[OSAction updateOSStatusInDB] SQL: ${sql.trim().replace(/\s+/g, ' ')}`);
    console.log(`[OSAction updateOSStatusInDB] Valores (datas como objetos Date):`, values.map(v => v instanceof Date ? v.toISOString() : v));

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

    