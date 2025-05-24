
'use server';

import db from '@/lib/db';
import type { OS, CreateOSData } from '@/lib/types';
import { OSStatus } from '@/lib/types';
import { findOrCreateClientByName } from './client-actions';
import { findOrCreatePartnerByName } from './partner-actions';
import type { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';
import { parseISO, differenceInMinutes, isValid as isValidDate, format as formatDateFns, differenceInSeconds } from 'date-fns';

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
      dataInicioProducao: null, // Histórico, não usado ativamente pelo cronômetro de sessão
      tempoProducaoMinutos: null, // Calculado na finalização, pode ser depreciado em favor de tempoGastoProducaoSegundos
      tempoGastoProducaoSegundos: 0, // Novo campo
      dataInicioProducaoAtual: data.status === OSStatus.EM_PRODUCAO ? new Date() : null, // Novo campo
      created_at: new Date(),
      updated_at: new Date(),
    };
    console.log('[OSAction createOSInDB] Dados da OS para o DB:', JSON.stringify(osDataForDB, null, 2));

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO os_table (numero, cliente_id, parceiro_id, projeto, tarefa, observacoes, tempoTrabalhado, status, dataAbertura, programadoPara, isUrgent, dataFinalizacao, dataInicioProducao, tempoProducaoMinutos, tempoGastoProducaoSegundos, dataInicioProducaoAtual, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
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
        osDataForDB.dataInicioProducao, // Mantém para compatibilidade, mas não é o primário para o cronômetro
        osDataForDB.tempoProducaoMinutos, // Idem
        osDataForDB.tempoGastoProducaoSegundos,
        osDataForDB.dataInicioProducaoAtual,
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
      dataInicioProducao: undefined, // Histórico
      tempoProducaoMinutos: undefined, // Histórico
      tempoGastoProducaoSegundos: osDataForDB.tempoGastoProducaoSegundos,
      dataInicioProducaoAtual: osDataForDB.dataInicioProducaoAtual ? osDataForDB.dataInicioProducaoAtual.toISOString() : null,
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
            if (/^\d{4}-\d{2}-\d{2}$/.test(osData.programadoPara)) {
                const parsedDate = parseISO(osData.programadoPara + "T00:00:00.000Z");
                if (isValidDate(parsedDate)) {
                    programadoParaSQL = osData.programadoPara;
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

    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      'SELECT status, dataAbertura, dataInicioProducao, dataFinalizacao, tempoProducaoMinutos, tempoGastoProducaoSegundos, dataInicioProducaoAtual FROM os_table WHERE id = ?',
      [osData.id]
    );
    if (currentOSRows.length === 0) {
      console.error(`[OSAction updateOSInDB] OS com ID ${osData.id} não encontrada no banco para atualização.`);
      await connection.rollback();
      throw new Error(`OS com ID ${osData.id} não encontrada para atualização.`);
    }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction updateOSInDB] Estado atual da OS ID ${osData.id} no DB:`, currentOSFromDB);

    const now = new Date();
    let newStatus = osData.status;
    let newDataInicioProducaoAtual = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundos = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataFinalizacao: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let newDataInicioProducaoHistorico: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    // Lógica do cronômetro baseada na mudança de status
    if (newStatus !== currentOSFromDB.status) {
        console.log(`[OSAction updateOSInDB] Status mudou de ${currentOSFromDB.status} para ${newStatus}`);
        if (newStatus === OSStatus.EM_PRODUCAO) {
            if (!newDataInicioProducaoAtual) { // Só inicia se já não estiver rodando
                newDataInicioProducaoAtual = now;
                console.log(`[OSAction updateOSInDB] Iniciando cronômetro (via status): dataInicioProducaoAtual = ${newDataInicioProducaoAtual.toISOString()}`);
                if (!newDataInicioProducaoHistorico) { // Guarda o primeiro início de produção
                    newDataInicioProducaoHistorico = now;
                }
            }
        } else { // Status mudou para algo que não é EM_PRODUCAO
            if (newDataInicioProducaoAtual) { // Se estava rodando, pausa e acumula
                const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtual);
                newTempoGastoProducaoSegundos += secondsElapsed;
                newDataInicioProducaoAtual = null;
                console.log(`[OSAction updateOSInDB] Pausando cronômetro (via status): ${secondsElapsed}s adicionados. Total: ${newTempoGastoProducaoSegundos}s. dataInicioProducaoAtual = null`);
            }
        }

        // Lógica para data de finalização
        if (newStatus === OSStatus.FINALIZADO) {
            newDataFinalizacao = now;
            console.log(`[OSAction updateOSInDB] Status mudando para FINALIZADO. Data Finalização: ${newDataFinalizacao.toISOString()}`);
        } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) {
            // OS Reaberta
            newDataFinalizacao = null;
            console.log("[OSAction updateOSInDB] OS reaberta, resetando dataFinalizacao.");
        }
    }
    
    // Persistir os valores calculados/atuais do cronômetro mesmo que o status não mude (ex: play/pause manual)
    // Isso é feito pela action toggleOSProductionTimerInDB, mas aqui garantimos que os campos sejam atualizados
    // se forem passados em osData (embora a fonte da verdade para eles deva vir da lógica do cronômetro).
    // Para a atualização geral, priorizamos a lógica acima baseada na mudança de status.
    // Se `osData` trouxer valores para os campos do cronômetro, eles refletiriam o estado da UI que pode não ser o mais atual
    // se o backend estiver fazendo cálculos.
    // A forma mais segura é a action de update geral focar nos campos gerais, e actions específicas (como play/pause)
    // cuidarem dos campos do cronômetro.
    // No entanto, se osData.dataInicioProducaoAtual e osData.tempoGastoProducaoSegundos forem passados, eles devem ser respeitados,
    // assumindo que uma action específica de timer já os atualizou no objeto OS antes de chamar updateOSInDB.
    // Por agora, vamos confiar na lógica acima baseada na mudança de status para esses campos.

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
        dataInicioProducao = ?, -- data do primeiro início de produção (histórico)
        tempoGastoProducaoSegundos = ?,
        dataInicioProducaoAtual = ?,
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
      newStatus,
      programadoParaSQL,
      osData.isUrgent,
      newDataFinalizacao,
      newDataInicioProducaoHistorico, // Persiste a data do primeiro início de produção
      newTempoGastoProducaoSegundos,
      newDataInicioProducaoAtual,
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
      ...osData, // Começa com os dados da UI
      clientId: client.id,
      cliente: client.name,
      parceiro: partnerNameForReturn,
      partnerId: partnerIdSQL ? String(partnerIdSQL) : undefined,
      programadoPara: programadoParaSQL ?? undefined,
      dataAbertura: currentOSFromDB.dataAbertura ? new Date(currentOSFromDB.dataAbertura).toISOString() : new Date().toISOString(),
      status: newStatus, // Status atualizado
      dataFinalizacao: newDataFinalizacao ? newDataFinalizacao.toISOString() : undefined,
      dataInicioProducao: newDataInicioProducaoHistorico ? newDataInicioProducaoHistorico.toISOString() : undefined,
      tempoGastoProducaoSegundos: newTempoGastoProducaoSegundos,
      dataInicioProducaoAtual: newDataInicioProducaoAtual ? newDataInicioProducaoAtual.toISOString() : null,
      // tempoProducaoMinutos não é mais o campo principal, mas pode ser calculado de tempoGastoProducaoSegundos se necessário.
      tempoProducaoMinutos: Math.floor(newTempoGastoProducaoSegundos / 60),
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
        os.tempoGastoProducaoSegundos, os.dataInicioProducaoAtual
      FROM os_table os
      JOIN clients c ON os.cliente_id = c.id
      LEFT JOIN partners p ON os.parceiro_id = p.id
      ORDER BY os.isUrgent DESC, os.dataAbertura DESC
    `;
    const [rows] = await connection.query<RowDataPacket[]>(query);
    console.log(`[OSAction getAllOSFromDB] Encontradas ${rows.length} OSs.`);
    return rows.map(row => ({
      id: String(row.id),
      numero: row.numero,
      cliente: row.cliente_name || 'Cliente Desconhecido', // Fallback se c.name não for selecionado corretamente
      parceiro: row.partner_name || undefined,
      clientId: String(row.clientId), // Assumindo que clientId e partnerId foram selecionados com alias
      partnerId: row.partnerId ? String(row.partnerId) : undefined,
      projeto: row.projeto,
      tarefa: row.tarefa,
      observacoes: row.observacoes,
      tempoTrabalhado: row.tempoTrabalhado,
      status: row.status as OSStatus,
      dataAbertura: new Date(row.dataAbertura).toISOString(),
      dataFinalizacao: row.dataFinalizacao ? new Date(row.dataFinalizacao).toISOString() : undefined,
      programadoPara: row.programadoPara ? formatDateFns(new Date(row.programadoPara + "T00:00:00Z"), 'yyyy-MM-dd') : undefined, // Adiciona Z para tratar como UTC
      isUrgent: Boolean(row.isUrgent),
      dataInicioProducao: row.dataInicioProducao ? new Date(row.dataInicioProducao).toISOString() : undefined,
      tempoProducaoMinutos: row.tempoProducaoMinutos === null ? undefined : row.tempoProducaoMinutos,
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
    console.log(`[OSAction updateOSStatusInDB] Transação iniciada para OS ID: ${osId}`);

    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      'SELECT id, status, dataAbertura, dataInicioProducao, dataFinalizacao, tempoProducaoMinutos, tempoGastoProducaoSegundos, dataInicioProducaoAtual, cliente_id, parceiro_id, projeto, tarefa, observacoes, tempoTrabalhado, programadoPara, isUrgent, numero FROM os_table WHERE id = ?',
      [osId]
    );
    if (currentOSRows.length === 0) {
      console.error(`[OSAction updateOSStatusInDB] OS com ID ${osId} não encontrada no banco para atualização de status.`);
      await connection.rollback();
      return null;
    }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction updateOSStatusInDB] Estado atual (antes de mudar status) da OS ID ${osId} no DB:`, currentOSFromDB);

    const now = new Date();
    let newDataInicioProducaoAtual = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundos = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataFinalizacao: Date | null = currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao) : null;
    let newDataInicioProducaoHistorico: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;


    if (newStatus === OSStatus.EM_PRODUCAO) {
      if (!newDataInicioProducaoAtual) { // Só inicia se já não estiver rodando
          newDataInicioProducaoAtual = now;
          console.log(`[OSAction updateOSStatusInDB] Status para EM_PRODUCAO, setando dataInicioProducaoAtual para: ${newDataInicioProducaoAtual.toISOString()}`);
          if (!newDataInicioProducaoHistorico) {
              newDataInicioProducaoHistorico = now;
          }
      }
    } else { // Status mudou para algo que não é EM_PRODUCAO
      if (newDataInicioProducaoAtual) { // Se estava rodando, pausa e acumula
          const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtual);
          newTempoGastoProducaoSegundos += secondsElapsed;
          newDataInicioProducaoAtual = null;
          console.log(`[OSAction updateOSStatusInDB] Pausando cronômetro (status não é EM_PRODUCAO): ${secondsElapsed}s adicionados. Total: ${newTempoGastoProducaoSegundos}s. dataInicioProducaoAtual = null`);
      }
    }

    if (newStatus === OSStatus.FINALIZADO) {
      newDataFinalizacao = now;
      console.log(`[OSAction updateOSStatusInDB] Status para FINALIZADO, setando dataFinalizacao para: ${newDataFinalizacao.toISOString()}`);
      // O tempo já foi acumulado acima se estava em produção.
    } else if (currentOSFromDB.status === OSStatus.FINALIZADO && newStatus !== OSStatus.FINALIZADO) {
      // OS Reaberta
      newDataFinalizacao = null; // Limpa data de finalização
      console.log("[OSAction updateOSStatusInDB] OS reaberta, resetando dataFinalizacao.");
    }

    const sql = `
      UPDATE os_table SET
        status = ?,
        dataFinalizacao = ?,
        dataInicioProducao = ?, 
        tempoGastoProducaoSegundos = ?,
        dataInicioProducaoAtual = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    const values = [
      newStatus,
      newDataFinalizacao,
      newDataInicioProducaoHistorico,
      newTempoGastoProducaoSegundos,
      newDataInicioProducaoAtual,
      parseInt(osId, 10)
    ];
    console.log(`[OSAction updateOSStatusInDB] SQL: ${sql.trim().replace(/\s+/g, ' ')}`);
    console.log(`[OSAction updateOSStatusInDB] Valores (datas como objetos Date):`, values.map(v => v instanceof Date ? v.toISOString() : v));

    const [result] = await connection.execute<ResultSetHeader>(sql, values);

    await connection.commit();
    console.log(`[OSAction updateOSStatusInDB] Status da OS ID ${osId} atualizado para ${newStatus}. Linhas afetadas: ${result.affectedRows}`);
    
    if (result.affectedRows > 0) {
        // Fetch client and partner names for the return object
        const [clientRows] = await connection.query<RowDataPacket[]>('SELECT name FROM clients WHERE id = ?', [currentOSFromDB.cliente_id]);
        const clientName = clientRows.length > 0 ? clientRows[0].name : 'Cliente Desconhecido';
        let partnerName: string | undefined = undefined;
        if (currentOSFromDB.parceiro_id) {
            const [partnerRows] = await connection.query<RowDataPacket[]>('SELECT name FROM partners WHERE id = ?', [currentOSFromDB.parceiro_id]);
            partnerName = partnerRows.length > 0 ? partnerRows[0].name : undefined;
        }

        const updatedOS: OS = {
            id: osId,
            numero: currentOSFromDB.numero,
            cliente: clientName,
            parceiro: partnerName,
            clientId: String(currentOSFromDB.cliente_id),
            partnerId: currentOSFromDB.parceiro_id ? String(currentOSFromDB.parceiro_id) : undefined,
            projeto: currentOSFromDB.projeto,
            tarefa: currentOSFromDB.tarefa,
            observacoes: currentOSFromDB.observacoes,
            tempoTrabalhado: currentOSFromDB.tempoTrabalhado,
            status: newStatus,
            dataAbertura: new Date(currentOSFromDB.dataAbertura).toISOString(),
            programadoPara: currentOSFromDB.programadoPara ? formatDateFns(new Date(currentOSFromDB.programadoPara + "T00:00:00Z"), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(currentOSFromDB.isUrgent),
            dataFinalizacao: newDataFinalizacao ? newDataFinalizacao.toISOString() : undefined,
            dataInicioProducao: newDataInicioProducaoHistorico ? newDataInicioProducaoHistorico.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundos,
            dataInicioProducaoAtual: newDataInicioProducaoAtual ? newDataInicioProducaoAtual.toISOString() : null,
            tempoProducaoMinutos: Math.floor(newTempoGastoProducaoSegundos / 60),
        };
        return updatedOS;
    }
    return null;

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
    return null;
  } finally {
    if (connection) connection.release();
    console.log(`[OSAction updateOSStatusInDB] Conexão liberada para OS ID: ${osId}`);
  }
}

export async function toggleOSProductionTimerInDB(osId: string, action: 'play' | 'pause'): Promise<OS | null> {
  const connection = await db.getConnection();
  console.log(`[OSAction toggleOSProductionTimerInDB] OS ID: ${osId}, Ação: ${action}`);
  try {
    await connection.beginTransaction();

    const [currentOSRows] = await connection.query<RowDataPacket[]>(
      'SELECT id, status, dataAbertura, dataInicioProducao, dataFinalizacao, tempoProducaoMinutos, tempoGastoProducaoSegundos, dataInicioProducaoAtual, cliente_id, parceiro_id, projeto, tarefa, observacoes, tempoTrabalhado, programadoPara, isUrgent, numero FROM os_table WHERE id = ?',
      [osId]
    );
    if (currentOSRows.length === 0) {
      console.error(`[OSAction toggleOSProductionTimerInDB] OS ID ${osId} não encontrada.`);
      await connection.rollback();
      return null;
    }
    const currentOSFromDB = currentOSRows[0];
    console.log(`[OSAction toggleOSProductionTimerInDB] Estado atual da OS ID ${osId}:`, currentOSFromDB);

    const now = new Date();
    let newStatus = currentOSFromDB.status as OSStatus;
    let newDataInicioProducaoAtual = currentOSFromDB.dataInicioProducaoAtual ? new Date(currentOSFromDB.dataInicioProducaoAtual) : null;
    let newTempoGastoProducaoSegundos = currentOSFromDB.tempoGastoProducaoSegundos || 0;
    let newDataInicioProducaoHistorico: Date | null = currentOSFromDB.dataInicioProducao ? new Date(currentOSFromDB.dataInicioProducao) : null;

    if (action === 'play') {
      if (!newDataInicioProducaoAtual) { // Só inicia se não estiver rodando
        newDataInicioProducaoAtual = now;
        newStatus = OSStatus.EM_PRODUCAO; // Força o status para EM_PRODUCAO
        console.log(`[OSAction toggleOSProductionTimerInDB] Play: dataInicioProducaoAtual = ${newDataInicioProducaoAtual.toISOString()}, status = ${newStatus}`);
        if (!newDataInicioProducaoHistorico) {
             newDataInicioProducaoHistorico = now;
        }
      } else {
        console.log(`[OSAction toggleOSProductionTimerInDB] Play: Timer já estava rodando. Nenhuma mudança.`);
      }
    } else if (action === 'pause') {
      if (newDataInicioProducaoAtual) { // Só pausa se estiver rodando
        const secondsElapsed = differenceInSeconds(now, newDataInicioProducaoAtual);
        newTempoGastoProducaoSegundos += secondsElapsed;
        newDataInicioProducaoAtual = null;
        // Não mudamos o status aqui ao pausar manualmente, o usuário fará isso pelo dropdown se necessário.
        // Se mudar o status para algo que não seja EM_PRODUCAO, a lógica de updateOSInDB ou updateOSStatusInDB cuidará disso.
        console.log(`[OSAction toggleOSProductionTimerInDB] Pause: ${secondsElapsed}s adicionados. Total: ${newTempoGastoProducaoSegundos}s. dataInicioProducaoAtual = null`);
      } else {
         console.log(`[OSAction toggleOSProductionTimerInDB] Pause: Timer já estava pausado. Nenhuma mudança.`);
      }
    }

    const updateQuery = `
      UPDATE os_table SET
        status = ?,
        tempoGastoProducaoSegundos = ?,
        dataInicioProducaoAtual = ?,
        dataInicioProducao = ?,
        updated_at = NOW()
      WHERE id = ?
    `;
    const values = [
      newStatus,
      newTempoGastoProducaoSegundos,
      newDataInicioProducaoAtual,
      newDataInicioProducaoHistorico,
      parseInt(osId, 10)
    ];

    console.log('[OSAction toggleOSProductionTimerInDB] Query:', updateQuery.trim().replace(/\s+/g, ' '));
    console.log('[OSAction toggleOSProductionTimerInDB] Valores:', values.map(v => v instanceof Date ? v.toISOString() : v));
    const [result] = await connection.execute<ResultSetHeader>(updateQuery, values);

    await connection.commit();
    console.log(`[OSAction toggleOSProductionTimerInDB] Timer da OS ID ${osId} atualizado. Linhas afetadas: ${result.affectedRows}`);

    if (result.affectedRows > 0) {
        const [clientRows] = await connection.query<RowDataPacket[]>('SELECT name FROM clients WHERE id = ?', [currentOSFromDB.cliente_id]);
        const clientName = clientRows.length > 0 ? clientRows[0].name : 'Cliente Desconhecido';
        let partnerName: string | undefined = undefined;
        if (currentOSFromDB.parceiro_id) {
            const [partnerRows] = await connection.query<RowDataPacket[]>('SELECT name FROM partners WHERE id = ?', [currentOSFromDB.parceiro_id]);
            partnerName = partnerRows.length > 0 ? partnerRows[0].name : undefined;
        }
        const updatedOS: OS = {
            id: osId,
            numero: currentOSFromDB.numero,
            cliente: clientName,
            parceiro: partnerName,
            clientId: String(currentOSFromDB.cliente_id),
            partnerId: currentOSFromDB.parceiro_id ? String(currentOSFromDB.parceiro_id) : undefined,
            projeto: currentOSFromDB.projeto,
            tarefa: currentOSFromDB.tarefa,
            observacoes: currentOSFromDB.observacoes,
            tempoTrabalhado: currentOSFromDB.tempoTrabalhado,
            status: newStatus, // Status atualizado
            dataAbertura: new Date(currentOSFromDB.dataAbertura).toISOString(),
            programadoPara: currentOSFromDB.programadoPara ? formatDateFns(new Date(currentOSFromDB.programadoPara + "T00:00:00Z"), 'yyyy-MM-dd') : undefined,
            isUrgent: Boolean(currentOSFromDB.isUrgent),
            dataFinalizacao: currentOSFromDB.dataFinalizacao ? new Date(currentOSFromDB.dataFinalizacao).toISOString() : undefined, // Não alterado por esta action
            dataInicioProducao: newDataInicioProducaoHistorico ? newDataInicioProducaoHistorico.toISOString() : undefined,
            tempoGastoProducaoSegundos: newTempoGastoProducaoSegundos,
            dataInicioProducaoAtual: newDataInicioProducaoAtual ? newDataInicioProducaoAtual.toISOString() : null,
            tempoProducaoMinutos: Math.floor(newTempoGastoProducaoSegundos / 60),
        };
        return updatedOS;
    }
    return null;

  } catch (error: any) {
    console.error(`[OSAction toggleOSProductionTimerInDB] Erro ao alternar timer para OS ID ${osId}:`, error.message, error.stack);
    if (connection) await connection.rollback();
    return null;
  } finally {
    if (connection) connection.release();
  }
}
