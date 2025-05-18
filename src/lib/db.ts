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
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conectado ao banco MySQL.');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco:', error);
    return false;
  }
};

export default pool;
