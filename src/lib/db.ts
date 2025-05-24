
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD?.trim(), // Ensure password is trimmed
  database: process.env.DB_DATABASE || 'freelaos-db',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  ssl: process.env.DB_SSL_ENABLED === 'true'
    ? { 
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        // ca: process.env.DB_SSL_CA ? Buffer.from(process.env.DB_SSL_CA, 'base64').toString('ascii') : undefined,
        // key: process.env.DB_SSL_KEY ? Buffer.from(process.env.DB_SSL_KEY, 'base64').toString('ascii') : undefined,
        // cert: process.env.DB_SSL_CERT ? Buffer.from(process.env.DB_SSL_CERT, 'base64').toString('ascii') : undefined,
      }
    : undefined,
  // timezone: 'Z', // Example: UTC
};

// Log DB config details, masking password
const loggableDbConfig = { ...dbConfig, password: dbConfig.password ? '********' : 'Not Set' };
console.log('[DB Config] Initializing MySQL connection pool with effective configuration:', loggableDbConfig);

let pool: mysql.Pool;
try {
  pool = mysql.createPool(dbConfig);
  console.log(`[DB Pool] Pool de conexões MySQL criado com sucesso para database: '${dbConfig.database}' no host: '${dbConfig.host}'.`);
} catch (error) {
  console.error('[DB Pool] FALHA CRÍTICA ao criar pool de conexões MySQL:', error);
  throw error;
}


pool.on('error', (err) => {
  console.error('[DB Pool Error] Erro inesperado em cliente ocioso do pool:', err);
  // Potentially handle reconnection or logging to a monitoring service
});

// Test connection function
export const testConnection = async () => {
  let connection;
  try {
    console.log(`[DB Test] Tentando conectar com: host=${dbConfig.host}, port=${dbConfig.port}, user=${dbConfig.user}, database=${dbConfig.database}`);
    connection = await pool.getConnection();
    console.log('✅ [DB Test] Conectado ao banco MySQL com sucesso usando o pool.');
    await connection.query('SELECT 1');
    console.log('✅ [DB Test] Query de teste ("SELECT 1") executada com sucesso.');
    return true;
  } catch (error: any) {
    console.error('❌ [DB Test] Erro ao conectar ao banco MySQL usando o pool.');
    console.error(`   Erro: ${error.message}`);
    if (error.code) {
      console.error(`   Código do Erro: ${error.code}`);
      if (error.code === 'ECONNREFUSED') {
        console.error(`   👉 ECONNREFUSED: Verifique se o servidor MySQL está rodando e acessível em ${dbConfig.host}:${dbConfig.port}.`);
        console.error(`   👉 Verifique também as configurações de firewall e se o 'bind-address' no MySQL permite conexões de onde sua aplicação está rodando.`);
      } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error(`   👉 ER_ACCESS_DENIED_ERROR: Verifique as credenciais (usuário '${dbConfig.user}') e permissões para o host '${dbConfig.host}'.`);
      } else if (error.code === 'ER_BAD_DB_ERROR') {
        console.error(`   👉 ER_BAD_DB_ERROR: O banco de dados "${dbConfig.database}" não existe ou o usuário não tem permissão para acessá-lo.`);
      } else if (error.code === 'ER_SECURE_TRANSPORT_REQUIRED') {
        console.error(`   👉 ER_SECURE_TRANSPORT_REQUIRED: O MySQL exige uma conexão segura (SSL), mas a aplicação não está configurada para isso ou falhou ao tentar. Verifique as configurações de SSL no MySQL e na aplicação (DB_SSL_ENABLED, etc.).`);
      } else {
        console.error(`   👉 Outro erro de banco de dados: ${error.code} - ${error.sqlMessage || error.message}`);
      }
    }
    if (error.errno) console.error(`   Número do Erro (errno): ${error.errno}`);
    if (error.sqlState) console.error(`   SQLState: ${error.sqlState}`);
    return false;
  } finally {
    if (connection) {
      connection.release();
      console.log('🔚 [DB Test] Conexão de teste com o banco liberada.');
    }
  }
};

const db = pool;
export default db;
