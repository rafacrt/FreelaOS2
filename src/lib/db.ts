
import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD?.trim() || undefined,
  database: process.env.DB_DATABASE || 'freelaos',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

export const testConnection = async () => {
  let connection;
  try {
    // Log the configuration being used, but be careful with passwords in real production logs.
    // For local dev, this is fine.
    console.log(`[DB Test] Tentando conectar com: host=${dbConfig.host}, port=${dbConfig.port}, user=${dbConfig.user}, database=${dbConfig.database}`);
    connection = await pool.getConnection();
    console.log('✅ Conectado ao banco MySQL com sucesso usando o pool.');
    return true;
  } catch (error: any) { 
    console.error('❌ Erro ao conectar ao banco MySQL usando o pool.');
    console.error(`   Erro: ${error.message}`);
    if (error.code) {
        console.error(`   Código do Erro: ${error.code}`);
        if (error.code === 'ECONNREFUSED') {
            console.error(`   👉 ECONNREFUSED: Verifique se o servidor MySQL está rodando e acessível em ${dbConfig.host}:${dbConfig.port}.`);
            console.error('      Confira também as configurações de firewall e se o MySQL está escutando no endereço e porta corretos.');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error(`   👉 ER_ACCESS_DENIED_ERROR: Verifique as credenciais (usuário '${dbConfig.user}') e as permissões do usuário MySQL para o host '${dbConfig.host}'.`);
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error(`   👉 ER_BAD_DB_ERROR: O banco de dados "${dbConfig.database}" não existe. Verifique o nome do banco.`);
        }
    }
    if (error.errno) console.error(`   Número do Erro: ${error.errno}`);
    if (error.sqlState) console.error(`   SQLState: ${error.sqlState}`);
    return false;
  } finally {
    if (connection) {
      connection.release();
      console.log('🔚 Conexão com o banco liberada.');
    }
  }
};

export default pool;
