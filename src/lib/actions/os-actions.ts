
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData, OSStatus } from '@/lib/types';
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import { parseISO, differenceInMinutes } from 'date-fns';

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
        const parsedDate = new Date(data.programadoPara + "T00:00:00"); // Adiciona hora para evitar problemas de fuso ao converter para ISO
        if (!isNaN(parsedDate.getTime())) {
          programadoParaDate = parsedDate.toISOString().split('T')[0];
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
      `INSERT INTO os_table (numero, cliente_id, parceiro_id, projeto, tarefa, observacoes, tempoTrabalhado, status, dataAbertura, programadoPara, isUrgent, dataFinalizacao, dataInicioProducao, tempoProducaoMinutos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      Object.values(osDataForDB)
    );

    if (!result.insertId) {
      console.error('[OSAction createOSInDB] Falha ao criar OS: insertId é 0. Verifique AUTO_INCREMENT em os_table.id ou outras constraints.', result);
      await connection.rollback();
      throw new Error('Falha ao criar OS: Nenhum insertId válido retornado do DB. Verifique se `id` é AUTO_INCREMENT.');
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
      programadoPara: programadoParaDate ? programadoParaDate : undefined, // Mantém como YYYY-MM-DD
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
    throw new Error(`Falha ao criar OS: ${error.message}`);
  } finally {
    if (connection) connection.release();
    console.log('[OSAction createOSInDB] Conexão liberada.');
  }
}


export async function updateOSInDB(osData: OS): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log('[OSAction updateOSInDB] Iniciando atualização da OS ID:', osData.id, 'Dados recebidos:', JSON.stringify(osData, null, 2));
  try {
    await connection.beginTransaction();
    console.log('[OSAction updateOSInDB] Transação iniciada para OS ID:', osData.id);

    // Resolver IDs de cliente e parceiro
    const client = await findOrCreateClientByName(osData.cliente, connection);
    if (!client || !client.id) {
      console.error(`[OSAction updateOSInDB] Falha ao obter ID do cliente para: "${osData.cliente}"`);
      await connection.rollback();
      throw new Error('Falha ao obter ID do cliente para atualização.');
    }
    console.log(`[OSAction updateOSInDB] Cliente resolvido para update: ID ${client.id}, Nome ${client.name}`);

    let partnerId: number | null = null;
    if (osData.parceiro && osData.parceiro.trim() !== '') {
      const partner = await findOrCreatePartnerByName(osData.parceiro, connection);
      if (!partner || !partner.id) {
        console.error(`[OSAction updateOSInDB] Falha ao obter ID do parceiro para: "${osData.parceiro}"`);
        await connection.rollback();
        throw new Error('Falha ao obter ID do parceiro para atualização.');
      }
      partnerId = parseInt(partner.id, 10);
      console.log(`[OSAction updateOSInDB] Parceiro resolvido para update: ID ${partner.id}, Nome ${partner.name}`);
    }

    let programadoParaSQL: string | null = null;
    if (osData.programadoPara) {
        try {
            const date = new Date(osData.programadoPara + "T00:00:00"); // Adiciona hora para evitar problemas de fuso
            if(!isNaN(date.getTime())) {
                programadoParaSQL = date.toISOString().split('T')[0];
            }
        } catch (e) {
            console.warn(`[OSAction updateOSInDB] Data programadoPara inválida: ${osData.programadoPara}`, e);
        }
    }

    // Lógica para dataInicioProducao e tempoProducaoMinutos
    let dataInicioProducaoSQL = osData.dataInicioProducao ? new Date(osData.dataInicioProducao).toISOString() : null;
    let tempoProducaoMinutosSQL = osData.tempoProducaoMinutos ?? null;
    let dataFinalizacaoSQL = osData.dataFinalizacao ? new Date(osData.dataFinalizacao).toISOString() : null;

    const currentOSFromDB = (await connection.query<RowDataPacket[]>('SELECT status, dataInicioProducao, dataFinalizacao FROM os_table WHERE id = ?', [osData.id]))[0][0];

    if (currentOSFromDB) {
        if (osData.status === OSStatus.EM_PRODUCAO && currentOSFromDB.status !== OSStatus.EM_PRODUCAO && !currentOSFromDB.dataInicioProducao) {
            dataInicioProducaoSQL = new Date().toISOString();
        } else if (osData.status !== OSStatus.EM_PRODUCAO && currentOSFromDB.status === OSStatus.EM_PRODUCAO && !dataInicioProducaoSQL) {
            // Se saiu de EM_PRODUCAO e não tem data de início, mantém a do banco se houver, ou null
            dataInicioProducaoSQL = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao).toISOString() : null;
        }


        if (osData.status === OSStatus.FINALIZADO && currentOSFromDB.status !== OSStatus.FINALIZADO) {
            dataFinalizacaoSQL = new Date().toISOString();
            const startProd = dataInicioProducaoSQL || (currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao).toISOString() : null);
            if (startProd) {
                try {
                    tempoProducaoMinutosSQL = differenceInMinutes(parseISO(dataFinalizacaoSQL), parseISO(startProd));
                } catch (e) {
                    console.error("[OSAction updateOSInDB] Erro ao calcular tempo de produção na finalização:", e);
                    tempoProducaoMinutosSQL = null;
                }
            }
        } else if (osData.status !== OSStatus.FINALIZADO && currentOSFromDB.status === OSStatus.FINALIZADO) {
            dataFinalizacaoSQL = null;
            tempoProducaoMinutosSQL = null; // Resetar se reabrir
        }
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
        tempoProducaoMinutos = ?
      WHERE id = ?
    `;
    const values = [
      parseInt(client.id, 10),
      partnerId,
      osData.projeto,
      osData.tarefa,
      osData.observacoes,
      osData.tempoTrabalhado || null,
      osData.status,
      programadoParaSQL,
      osData.isUrgent,
      dataFinalizacaoSQL,
      dataInicioProducaoSQL,
      tempoProducaoMinutosSQL,
      osData.id
    ];

    console.log('[OSAction updateOSInDB] Query de Update:', updateQuery);
    console.log('[OSAction updateOSInDB] Valores para Update:', JSON.stringify(values, null, 2));

    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);
    console.log('[OSAction updateOSInDB] Resultado da execução do Update:', result);

    if (result.affectedRows === 0) {
      console.warn(`[OSAction updateOSInDB] Nenhuma linha afetada ao atualizar OS ID: ${osData.id}. A OS pode não existir ou os dados são os mesmos.`);
      // Considerar se isso deve ser um erro ou não. Por enquanto, vamos continuar e retornar os dados como se tivessem sido atualizados.
    }

    await connection.commit();
    console.log(`[OSAction updateOSInDB] Transação commitada para OS ID: ${osData.id}`);

    // Retornar o objeto OS atualizado, refletindo as mudanças (especialmente as datas calculadas)
    const updatedOSForReturn: OS = {
        ...osData, // Começa com os dados que vieram da UI
        clientId: client.id,
        parceiro: osData.parceiro, // O nome já deve estar correto em osData
        partnerId: partnerId ? String(partnerId) : undefined,
        programadoPara: programadoParaSQL ?? undefined,
        dataFinalizacao: dataFinalizacaoSQL ?? undefined,
        dataInicioProducao: dataInicioProducaoSQL ?? undefined,
        tempoProducaoMinutos: tempoProducaoMinutosSQL ?? undefined,
    };

    console.log('[OSAction updateOSInDB] OS atualizada retornada:', JSON.stringify(updatedOSForReturn, null, 2));
    return updatedOSForReturn;

  } catch (error: any) {
    console.error(`[OSAction updateOSInDB] Erro ao atualizar OS ID ${osData.id}. Rollback será tentado.`, error.message, error.stack, error.code, error.sqlMessage);
    if (connection) await connection.rollback();
    return null; // Retorna null em caso de erro
  } finally {
    if (connection) connection.release();
    console.log(`[OSAction updateOSInDB] Conexão liberada para OS ID: ${osData.id}`);
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
        p.id as partnerId, p.name as partner_name
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
      programadoPara: row.programadoPara ? new Date(row.programadoPara).toISOString().split('T')[0] : undefined,
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

    const fieldsToUpdate: string[] = ['status = ?'];
    const values: (string | number | null | boolean)[] = [newStatus];

    // Adiciona campos ao update apenas se explicitamente fornecidos em updateData
    if (updateData.dataFinalizacao !== undefined) {
      fieldsToUpdate.push('dataFinalizacao = ?');
      values.push(updateData.dataFinalizacao);
    }
    if (updateData.dataInicioProducao !== undefined) {
      fieldsToUpdate.push('dataInicioProducao = ?');
      values.push(updateData.dataInicioProducao);
    }
    if (updateData.tempoProducaoMinutos !== undefined) {
      fieldsToUpdate.push('tempoProducaoMinutos = ?');
      values.push(updateData.tempoProducaoMinutos);
    }

    values.push(osId); // Para a cláusula WHERE

    const sql = `UPDATE os_table SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    console.log(`[OSAction updateOSStatusInDB] SQL: ${sql} Valores:`, values);

    const [result] = await connection.execute<ResultSetHeader>(sql, values);

    await connection.commit();
    console.log(`[OSAction updateOSStatusInDB] Status da OS ID ${osId} atualizado. Linhas afetadas: ${result.affectedRows}`);
    return result.affectedRows > 0;
  } catch (error: any) {
    console.error(`[OSAction updateOSStatusInDB] Erro ao atualizar status da OS para ID ${osId}:`, error.message, error.stack, error.code, error.sqlMessage);
    if (connection) await connection.rollback();
    throw new Error(`Falha ao atualizar status da OS no DB: ${error.message}`);
  } finally {
    if (connection) connection.release();
  }
}
