import mysql from 'mysql2/promise';
// import 'dotenv/config'; // Removed: Next.js handles .env.local automatically for local dev. For production, set env vars on the host.

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD?.trim(), // Ensure password is trimmed if it comes from env
  database: process.env.DB_DATABASE || 'freelaos-db',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : undefined,
};

// Log DB config only during build or if explicitly enabled, to avoid leaking in production logs frequently
if (process.env.NODE_ENV === 'development' || process.env.DEBUG_DB_CONFIG === 'true') {
  console.log('[DB Config] Using database configuration:', {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database,
    ssl_rejectUnauthorized: dbConfig.ssl?.rejectUnauthorized,
    password_set: dbConfig.password ? 'Yes' : 'No (or empty)',
  });
}


const pool = mysql.createPool(dbConfig);

pool.on('error', (err) => {
  console.error('[DB Pool Error] Unexpected error on idle client', err);
  // Optional: implement logic to attempt to re-establish pool or parts of it
});

export const testConnection = async () => {
  let connection;
  try {
    console.log(`[DB Test] Attempting to connect with: host=${dbConfig.host}, port=${dbConfig.port}, user=${dbConfig.user}, database=${dbConfig.database}`);
    connection = await pool.getConnection();
    console.log('✅ Conectado ao banco MySQL com sucesso usando o pool.');
    await connection.query('SELECT 1');
    console.log('✅ Query de teste ("SELECT 1") executada com sucesso.');
    return true;
  } catch (error: any) {
    console.error('❌ Erro ao conectar ao banco MySQL usando o pool.');
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
      }
    }
    if (error.errno) console.error(`   Número do Erro (errno): ${error.errno}`);
    if (error.sqlState) console.error(`   SQLState: ${error.sqlState}`);
    return false;
  } finally {
    if (connection) {
      connection.release();
      console.log('🔚 Conexão de teste com o banco liberada.');
    }
  }
};

// Export the pool as 'db' for use in other modules
const db = pool;
export default db;
