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

let pool: mysql.Pool;
try {
  pool = mysql.createPool(dbConfig);
} catch (error) {
  throw error;
}


pool.on('error', (err) => {
  // Potentially handle reconnection or logging to a monitoring service
});

// Test connection function
export const testConnection = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1');
    return true;
  } catch (error: any) {
    return false;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const db = pool;
export default db;
